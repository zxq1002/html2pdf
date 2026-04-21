/**
 * 网页导出 PDF 插件 - 内容脚本
 * 负责在网页上下文中执行 PDF 生成
 */

// 防止重复注入
if (window.__pdfExporterInjected) {
  console.log("[PDF Exporter] 已经注入，跳过");
} else {
  window.__pdfExporterInjected = true;
  console.log("[PDF Exporter] 内容脚本已注入");

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "exportPDF") {
      handleExportPDF(request, sendResponse);
      return true;
    }
    if (request.action === "EXTRACT_CONTENT") {
      // 执行提取并导出
      handleExportPDF({ ...request, config: { ...request.config, mode: 'readable' } }, sendResponse);
      return true;
    }
    if (request.action === "ping") {
      sendResponse({ success: true });
      return false;
    }
  });
}

/**
 * 向 Popup 发送进度更新
 */
function sendProgress(percent, message) {
  try {
    chrome.runtime.sendMessage({
      action: "PROGRESS_UPDATE",
      percent,
      message
    }).catch(() => {
      // 如果 Popup 已关闭，sendMessage 会报错，忽略即可
    });
  } catch (e) {
    // 忽略
  }
}

/**
 * 处理 PDF 导出请求
 */
async function handleExportPDF(request, sendResponse) {
  try {
    const { config, pageTitle, pageUrl } = request;

    console.log("[PDF Exporter] 开始导出:", {
      mode: config.mode,
      url: pageUrl,
    });

    sendProgress(10, "正在准备内容...");

    let contentElement;
    let extractedTitle = pageTitle;

    if (config.mode === "readable") {
      const result = await extractReadableContent();
      contentElement = result.element;
      extractedTitle = result.extractedTitle;
    } else {
      contentElement = await cloneDocumentForExport(config);
    }

    sendProgress(30, "内容准备完成，开始渲染...");

    console.log("[PDF Exporter] 内容准备完成，开始生成 PDF");

    const pdfResult = await generatePDF(contentElement, {
      ...config,
      pageTitle,
      extractedTitle,
      pageUrl,
    });

    console.log("[PDF Exporter] PDF 生成完成:", pdfResult.filename);

    sendResponse({
      success: true,
      dataUrl: pdfResult.dataUrl,
      filename: pdfResult.filename,
    });
  } catch (error) {
    console.error("[PDF Exporter] 导出失败:", error);
    sendResponse({
      success: false,
      error: error.message || "未知错误",
    });
  }
}

/**
 * 提取可阅读内容
 */
async function extractReadableContent() {
  try {
    // 使用 src/extractor.js 提供的 extract 函数（基于 Readability.js）
    if (typeof extract !== "function") {
      throw new Error("提取模块未正确加载");
    }

    const article = extract(document);

    const container = document.createElement("div");
    container.className = "pdf-readable-content";
    container.style.cssText = `
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      font-family: "Charter", "Georgia", "Source Serif Pro", serif;
      line-height: 1.8;
      color: #333;
      background: #fff;
    `;

    const title = document.createElement("h1");
    title.textContent = article.title || document.title;
    title.style.cssText = `
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #1a1a1a;
      line-height: 1.3;
    `;
    container.appendChild(title);

    if (article.byline) {
      const author = document.createElement("p");
      author.textContent = article.byline;
      author.style.cssText = `
        font-size: 16px;
        color: #555;
        margin-bottom: 8px;
        font-weight: 500;
      `;
      container.appendChild(author);
    }

    const source = document.createElement("p");
    source.innerHTML = `<a href="${window.location.href}" style="color: #666; text-decoration: none; border-bottom: 1px solid #ccc;">${window.location.hostname}</a>`;
    source.style.cssText = `
      font-size: 13px;
      color: #999;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    `;
    container.appendChild(source);

    const content = document.createElement("div");
    content.innerHTML = article.content;
    
    // 清理内容样式
    content.querySelectorAll("*").forEach(el => {
      el.style.maxWidth = "100%";
      el.style.height = "auto";
    });

    container.appendChild(content);

    return {
      element: container,
      extractedTitle: article.title || document.title
    };
  } catch (error) {
    console.error("[PDF Exporter] 提取失败:", error);
    throw error;
  }
}

/**
 * 克隆整个文档用于导出
 */
function cloneDocumentForExport(config) {
  return new Promise((resolve, reject) => {
    try {
      const container = document.createElement("div");
      container.className = "pdf-export-container";
      container.style.cssText = `
        width: 100%;
        min-height: 100vh;
        background: white;
        padding: 20px;
      `;

      const bodyClone = document.body.cloneNode(true);
      bodyClone.querySelectorAll("script").forEach((el) => el.remove());

      if (!config.includeImages) {
        bodyClone.querySelectorAll("img").forEach((el) => {
          el.style.display = "none";
        });
      } else {
        // 为图片添加跨域支持 (Task 1)
        bodyClone.querySelectorAll("img").forEach((el) => {
          if (el.src && !el.src.startsWith("data:") && !el.src.startsWith("blob:")) {
            el.crossOrigin = "anonymous";
          }
        });
      }

      container.innerHTML = bodyClone.innerHTML;

      resolve(container);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 生成 PDF
 */
async function generatePDF(element, options) {
  await loadLibraries();

  const { pageTitle, extractedTitle, pageUrl, scale, fontSize, margin, quality, forceLightMode } = options;

  // 优先使用提取的标题
  const displayTitle = extractedTitle || pageTitle || "未命名页面";
  
  const safeTitle =
    displayTitle
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, " ")
      .trim();

  const filename = `${safeTitle}.pdf`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 1200px;
    height: 100vh;
    border: none;
    z-index: 999999;
    background: white;
    visibility: hidden;
  `;
  document.body.appendChild(iframe);

  await new Promise((resolve) => setTimeout(resolve, 50));

  const htmlContent = `
    <!DOCTYPE html>
    <html ${forceLightMode ? 'style="color-scheme: light !important;"' : ''}>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: "Charter", "Georgia", "Source Serif Pro", serif;
          font-size: ${typeof fontSize === 'number' ? fontSize + 'px' : (fontSize || '16px')};
          line-height: 1.6;
          color: #333;
          background: white;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
        }
        ${forceLightMode ? `
          :root { color-scheme: light !important; }
          body { background: white !important; color: #000 !important; }
          /* 覆盖常见的深色模式变量 */
          [data-theme='dark'], .dark, .dark-mode {
            background-color: #fff !important;
            color: #000 !important;
          }
        ` : ''}
        img { max-width: 100%; height: auto; display: block; margin: 10px auto; }
        .pdf-readable-content { padding: 0; }
        h1 { margin-top: 0; }
      </style>
    </head>
    <body>
      ${element.innerHTML}
    </body>
    </html>
  `;

  iframe.contentDocument.open();
  iframe.contentDocument.write(htmlContent);
  iframe.contentDocument.close();

  const images = iframe.contentDocument.querySelectorAll("img");
  
  // 增强图片处理逻辑 (Task 1)
  sendProgress(50, "正在处理跨域图片...");
  
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise(async (resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          const timeout = setTimeout(() => {
            console.warn("[PDF Exporter] 图片加载超时:", img.src);
            resolve();
          }, 5000);

          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          img.onerror = async () => {
            clearTimeout(timeout);
            // 如果加载失败，尝试通过 fetch 转换为 DataURL (Task 1)
            if (img.src && !img.src.startsWith("data:") && !img.src.startsWith("blob:")) {
              try {
                const response = await fetch(img.src).catch(() => null);
                if (response && response.ok) {
                  const blob = await response.blob();
                  img.src = await blobToDataURL(blob);
                  // 重新加载 DataURL 不需要很长时间
                  img.onload = resolve;
                  img.onerror = resolve;
                  return;
                }
              } catch (e) {
                console.warn("[PDF Exporter] 修复图片失败:", img.src);
              }
            }
            resolve();
          };

          // 触发加载
          if (img.src) {
            const currentSrc = img.src;
            img.src = "";
            img.src = currentSrc;
          } else {
            resolve();
          }
        }),
    ),
  );

  // 映射页边距配置 (D-05)
  let marginConfig = [15, 15, 15, 15]; // 默认 normal
  if (margin === 'narrow' || margin === 5) {
    marginConfig = [5, 5, 5, 5];
  } else if (margin === 'wide' || margin === 25 || margin === 30) {
    marginConfig = [30, 30, 30, 30];
  } else if (typeof margin === 'number') {
    marginConfig = [margin, margin, margin, margin];
  } else if (Array.isArray(margin)) {
    marginConfig = margin;
  }

  const opt = {
    margin: marginConfig,
    filename: filename,
    image: { type: "jpeg", quality: quality || 0.95 },
    html2canvas: {
      scale: scale || 2,
      useCORS: true,
      allowTaint: false,
      letterRendering: true,
      backgroundColor: "#ffffff",
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true
    },
  };

  try {
    console.log("[PDF Exporter] 生成 PDF...");
    sendProgress(70, "正在生成 PDF 页面...");

    const pdfBlob = await html2pdf()
      .set(opt)
      .from(iframe.contentDocument.body)
      .output("blob");

    sendProgress(90, "正在处理文件...");

    console.log("[PDF Exporter] PDF 大小:", (pdfBlob.size / 1024).toFixed(2), "KB");

    const dataUrl = await blobToDataURL(pdfBlob);

    iframe.remove();

    sendProgress(100, "生成完成！");

    return {
      filename,
      dataUrl,
      blob: pdfBlob,
    };
  } catch (error) {
    console.error("[PDF Exporter] 错误:", error);
    if (iframe.parentNode) iframe.remove();
    throw error;
  }
}

/**
 * Blob 转 Data URL
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 动态加载必要的库
 */
async function loadLibraries() {
  if (window.html2pdf) {
    return;
  }

  await loadScript(chrome.runtime.getURL("lib/html2pdf.bundle.min.js"));

  if (!window.html2pdf) {
    throw new Error("无法加载 html2pdf 库");
  }
}

/**
 * 动态加载脚本
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`无法加载: ${src}`));
    document.head.appendChild(script);
  });
}
