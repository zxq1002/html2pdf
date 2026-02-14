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
    if (request.action === "ping") {
      sendResponse({ success: true });
      return false;
    }
  });
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

    let contentElement;

    if (config.mode === "readable") {
      contentElement = await extractReadableContent();
    } else {
      contentElement = await cloneDocumentForExport(config);
    }

    console.log("[PDF Exporter] 内容准备完成，开始生成 PDF");

    const pdfResult = await generatePDF(contentElement, {
      ...config,
      pageTitle,
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
function extractReadableContent() {
  return new Promise((resolve, reject) => {
    try {
      let article = document.querySelector("article");
      let main = document.querySelector("main");
      let content = document.querySelector('[role="main"]');

      let targetElement = article || main || content || document.body;
      const clone = targetElement.cloneNode(true);

      const selectorsToRemove = [
        "script",
        "style",
        "noscript",
        "iframe",
        "nav",
        "header",
        "footer",
        "aside",
        ".advertisement",
        ".ad",
        ".ads",
        ".social-share",
        ".comments",
        '[role="navigation"]',
        '[role="banner"]',
        '[role="complementary"]',
      ];

      selectorsToRemove.forEach((selector) => {
        clone.querySelectorAll(selector).forEach((el) => el.remove());
      });

      // 移除 VWO 相关元素
      clone
        .querySelectorAll('[id*="_vis_opt"], [class*="_vis_opt"]')
        .forEach((el) => el.remove());

      // 强制所有元素可见
      clone.querySelectorAll("*").forEach((el) => {
        el.style.opacity = "1";
        el.style.visibility = "visible";
      });

      const container = document.createElement("div");
      container.className = "pdf-readable-content";
      container.style.cssText = `
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.8;
        color: #333;
        background: #fff;
      `;

      const title = document.createElement("h1");
      title.textContent = document.title;
      title.style.cssText = `
        font-size: 28px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #1a1a1a;
      `;
      container.appendChild(title);

      const source = document.createElement("p");
      source.innerHTML = `<a href="${window.location.href}" style="color: #0078d4; text-decoration: none;">${window.location.hostname}</a>`;
      source.style.cssText = `
        font-size: 13px;
        color: #666;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid #e0e0e0;
      `;
      container.appendChild(source);

      container.appendChild(clone);

      resolve(container);
    } catch (error) {
      reject(error);
    }
  });
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

  const { pageTitle, pageUrl, scale } = options;

  const safeTitle =
    pageTitle
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "未命名页面";

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
  `;
  document.body.appendChild(iframe);

  await new Promise((resolve) => setTimeout(resolve, 100));

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #333;
          background: white;
          padding: 20px;
        }
        img { max-width: 100%; height: auto; }
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
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 2000);
          }
        }),
    ),
  );

  await new Promise((r) => setTimeout(r, 500));

  for (const img of images) {
    try {
      if (img.src && !img.src.startsWith("data:")) {
        const imgUrl = new URL(img.src, iframe.contentDocument.baseURI);
        const isCrossOrigin =
          imgUrl.origin !== iframe.contentWindow.location.origin;

        if (isCrossOrigin) {
          try {
            const response = await fetch(img.src, {
              mode: "cors",
              credentials: "omit",
            }).catch(() => null);

            if (response && response.ok) {
              const blob = await response.blob();
              const reader = new FileReader();
              const dataUrl = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              img.src = dataUrl;
              continue;
            }
          } catch (e) {
            // 忽略
          }
        }
      }
    } catch (e) {
      // 忽略
    }
  }

  await new Promise((r) => setTimeout(r, 500));

  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: "jpeg", quality: 0.9 },
    html2canvas: {
      scale: scale || 1.5,
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false,
      logging: false,
      backgroundColor: "#ffffff",
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    },
  };

  try {
    console.log("[PDF Exporter] 生成 PDF...");

    const pdfBlob = await html2pdf()
      .set(opt)
      .from(iframe.contentDocument.body)
      .output("blob");

    console.log("[PDF Exporter] PDF 大小:", pdfBlob.size);

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(pdfBlob);
    });

    iframe.remove();

    return {
      filename,
      dataUrl,
      blob: pdfBlob,
    };
  } catch (error) {
    console.error("[PDF Exporter] 错误:", error);
    iframe.remove();
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
