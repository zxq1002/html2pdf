/**
 * 网页导出 PDF 插件 - PDF 生成模块
 *
 * 负责图片 PDF 的渲染管线：DOM 克隆、html2pdf 渲染、图片修复、下载触发。
 * 由 popup 按需注入（先于 content.js），与 content.js 共享 isolated world：
 *  - 运行时依赖 content.js 的 sendProgress()（导出时才调用，注入顺序无冲突）
 *  - html2pdf 库在首次生成时懒加载（loadLibraries）
 *
 * 使用 function 声明（重复注入时安全覆盖，不会抛 SyntaxError）
 */
/**
 * 克隆整个文档用于导出
 */
function cloneDocumentForExport(config) {
  return new Promise(function(resolve, reject) {
    try {
      var container = document.createElement("div");
      container.className = "pdf-export-container";
      container.style.cssText = "width: 100%; min-height: 100vh; background: white; padding: 20px;";

      function safeClone(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.cloneNode(true);
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return null;

        var tagName = node.tagName.toUpperCase();
        if (['SCRIPT', 'NOSCRIPT', 'STYLE', 'IFRAME', 'VIDEO', 'AUDIO'].indexOf(tagName) !== -1) return null;

        var style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return null;

        var clone = node.cloneNode(false);

        try {
          var fontFamily = style.fontFamily;
          if (fontFamily && fontFamily.indexOf(',') !== -1) {
            clone.style.setProperty('font-family', fontFamily.split(',')[0].trim(), 'important');
          }
          if (style.backgroundImage && style.backgroundImage.indexOf(',') !== -1) {
            clone.style.setProperty('background-image', 'none', 'important');
          }
          if (style.background && style.background.indexOf(',') !== -1) {
            clone.style.setProperty('background', style.backgroundColor || 'white', 'important');
          }
          if (style.boxShadow && style.boxShadow !== 'none' && style.boxShadow.indexOf('),') !== -1) {
            clone.style.setProperty('box-shadow', 'none', 'important');
          }
          if (style.textShadow && style.textShadow !== 'none' && style.textShadow.indexOf(',') !== -1) {
            clone.style.setProperty('text-shadow', 'none', 'important');
          }
          if (style.filter && style.filter !== 'none') clone.style.setProperty('filter', 'none', 'important');
          if (style.transition && style.transition !== 'none') clone.style.setProperty('transition', 'none', 'important');

          var inlineStyle = node.getAttribute('style') || '';
          if (inlineStyle.indexOf('var(') !== -1 || inlineStyle.indexOf('calc(') !== -1) {
            clone.style.width = style.width;
            clone.style.height = style.height;
            clone.style.margin = style.margin;
            clone.style.padding = style.padding;
          }
        } catch (e) {}

        if (tagName === 'IMG') {
          if (!config.includeImages) {
            clone.style.display = 'none';
          } else if (node.src && !node.src.startsWith("data:") && !node.src.startsWith("blob:")) {
            clone.crossOrigin = "anonymous";
          }
        }

        for (var i = 0; i < node.childNodes.length; i++) {
          var childClone = safeClone(node.childNodes[i]);
          if (childClone) clone.appendChild(childClone);
        }

        return clone;
      }

      var bodyClone = safeClone(document.body);
      if (bodyClone) container.appendChild(bodyClone);
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

  var pageTitle = options.pageTitle;
  var extractedTitle = options.extractedTitle;
  var pageUrl = options.pageUrl;
  var scale = options.scale;
  var fontSize = options.fontSize;
  var margin = options.margin;
  var quality = options.quality;
  var forceLightMode = options.forceLightMode;

  var displayTitle = extractedTitle || pageTitle || "未命名页面";

  var safeTitle = displayTitle
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  var filename = safeTitle + ".pdf";

  var iframe = document.createElement("iframe");
  iframe.style.cssText = "position: fixed; top: 0; left: 0; width: 1200px; height: 100vh; border: none; z-index: 999999; background: white; visibility: hidden;";
  document.body.appendChild(iframe);

  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var forceLightAttr = forceLightMode ? 'style="color-scheme: light !important;"' : '';
  var fontSizeVal = typeof fontSize === 'number' ? fontSize + 'px' : (fontSize || '16px');
  var lightModeCSS = forceLightMode ? ':root { color-scheme: light !important; } body { background: white !important; color: #000 !important; } [data-theme="dark"], .dark, .dark-mode { background-color: #fff !important; color: #000 !important; }' : '';

  var htmlContent = '<!DOCTYPE html><html ' + forceLightAttr + '><head><meta charset="UTF-8"><style>* { box-sizing: border-box; margin: 0; padding: 0; }body { font-family: "Charter", "Georgia", "Source Serif Pro", serif; font-size: ' + fontSizeVal + '; line-height: 1.6; color: #333; background: white; padding: 0; -webkit-print-color-adjust: exact !important; }' + lightModeCSS + 'img { max-width: 100%; height: auto; display: block; margin: 10px auto; }.pdf-readable-content { padding: 0; }h1 { margin-top: 0; }</style></head><body>' + element.innerHTML + '</body></html>';

  iframe.contentDocument.open();
  iframe.contentDocument.write(htmlContent);
  iframe.contentDocument.close();

  var contentHeight = iframe.contentDocument.body.scrollHeight;
  var finalScale = scale || 2;

  // 浏览器对 canvas 单边尺寸有硬性上限（Chrome 为 32767px），
  // 超出会得到空白画布，导出前必须拦截
  var MAX_CANVAS_DIM = 32767;
  if (contentHeight > MAX_CANVAS_DIM) {
    iframe.remove();
    throw new Error(
      '页面内容过长（' + contentHeight + 'px，超出图片 PDF ' + MAX_CANVAS_DIM +
      'px 上限），请改用「矢量 PDF」格式或开启「提取正文」模式'
    );
  }

  if (contentHeight > 10000) {
    finalScale = Math.min(finalScale, 1.0);
    sendProgress(60, "检测到超长网页，已自动优化渲染性能...");
    console.log('[PDF Exporter] 检测到超长网页 (' + contentHeight + 'px)，将 scale 降至 ' + finalScale);
  } else if (contentHeight > 5000) {
    finalScale = Math.min(finalScale, 1.5);
    sendProgress(60, "检测到长网页，已自动优化渲染性能...");
    console.log('[PDF Exporter] 检测到长网页 (' + contentHeight + 'px)，将 scale 降至 ' + finalScale);
  }

  // 进一步压低 scale，确保 canvas 总高度不超限
  if (contentHeight * finalScale > MAX_CANVAS_DIM) {
    finalScale = Math.max(MAX_CANVAS_DIM / contentHeight, 0.1);
    console.log('[PDF Exporter] 画布高度将超限，scale 进一步降至 ' + finalScale.toFixed(3));
  }

  var images = Array.from(iframe.contentDocument.querySelectorAll("img"));
  sendProgress(50, "正在处理跨域图片...");

  // 限制并发，避免图片极多的页面同时发起几十个请求
  await mapWithConcurrency(images, 8, function(img) {
    return waitForImageLoad(img);
  });

  var marginConfig = [15, 15, 15, 15];
  if (margin === 'narrow' || margin === 5) {
    marginConfig = [5, 5, 5, 5];
  } else if (margin === 'wide' || margin === 25 || margin === 30) {
    marginConfig = [30, 30, 30, 30];
  } else if (typeof margin === 'number') {
    marginConfig = [margin, margin, margin, margin];
  } else if (Array.isArray(margin)) {
    marginConfig = margin;
  }

  var opt = {
    margin: marginConfig,
    filename: filename,
    image: { type: "jpeg", quality: quality || 0.95 },
    html2canvas: {
      scale: finalScale,
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

    var pdfBlob = await html2pdf()
      .set(opt)
      .from(iframe.contentDocument.body)
      .output("blob");

    sendProgress(90, "正在处理文件...");

    console.log("[PDF Exporter] PDF 大小:", (pdfBlob.size / 1024).toFixed(2), "KB");

    iframe.remove();
    sendProgress(100, "生成完成！");

    return { filename: filename, blob: pdfBlob };
  } catch (error) {
    console.error("[PDF Exporter] 错误:", error);
    if (iframe.parentNode) iframe.remove();
    throw error;
  }
}

/**
 * 带并发上限的异步任务执行器
 * @param {Array} items - 任务输入列表
 * @param {number} limit - 最大并发数
 * @param {Function} worker - 任务函数 (item, index) => Promise
 * @returns {Promise<Array>} 与输入顺序一致的结果数组
 */
function mapWithConcurrency(items, limit, worker) {
  var results = [];
  var nextIndex = 0;
  var runners = [];
  var runnerCount = Math.min(limit, items.length);

  for (var r = 0; r < runnerCount; r++) {
    runners.push((function runNext() {
      var i = nextIndex++;
      if (i >= items.length) return Promise.resolve();
      return Promise.resolve(worker(items[i], i)).then(function(res) {
        results[i] = res;
        return runNext();
      });
    })());
  }

  return Promise.all(runners).then(function() { return results; });
}

/**
 * 等待单张图片加载完成（含 5s 超时与 fetch 降级修复）
 */
function waitForImageLoad(img) {
  return new Promise(function(resolve) {
    if (img.complete && img.naturalWidth > 0) { resolve(); return; }

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      img.onload = null;
      img.onerror = null;
      resolve();
    }

    var timeout = setTimeout(function() {
      console.warn("[PDF Exporter] 图片加载超时:", img.src);
      finish();
    }, 5000);

    img.onload = function() { clearTimeout(timeout); finish(); };
    img.onerror = function() {
      clearTimeout(timeout);
      repairBrokenImage(img).then(finish, finish);
    };

    if (img.src) {
      // 重置 src 强制重新加载（处理 iframe 复制后加载失败的情况）
      var currentSrc = img.src;
      img.src = "";
      img.src = currentSrc;
    } else {
      finish();
    }
  });
}

/**
 * 图片加载失败时，尝试直接 fetch 并转为 DataURL（绕开 CORS 限制）
 */
async function repairBrokenImage(img) {
  if (!img.src || img.src.startsWith("data:") || img.src.startsWith("blob:")) return;
  try {
    var response = await fetch(img.src).catch(function() { return null; });
    if (response && response.ok) {
      var blob = await response.blob();
      var dataUrl = await blobToDataURL(blob);
      // 等待 DataURL 图片解码完成，避免截图时仍在加载
      await new Promise(function(res) {
        img.onload = res;
        img.onerror = res;
        img.src = dataUrl;
      });
    }
  } catch (e) {
    console.warn("[PDF Exporter] 修复图片失败:", img.src);
  }
}

/**
 * Blob 转 Data URL（仅用于图片加载失败时的降级修复）
 */
function blobToDataURL(blob) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 在页面上下文中直接触发下载（blob URL），
 * 避免大体积 base64 数据在 executeScript 通道中往返
 */
function triggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 延迟释放，确保下载已启动
  setTimeout(function() {
    URL.revokeObjectURL(url);
  }, 60000);
}

/**
 * 动态加载必要的库
 */
async function loadLibraries() {
  if (window.html2pdf) return;

  var scriptUrl = chrome.runtime.getURL("lib/html2pdf.bundle.min.js");
  await loadScript(scriptUrl);

  if (!window.html2pdf) {
    throw new Error("无法加载 html2pdf 库");
  }
}

/**
 * 动态加载脚本
 */
function loadScript(src) {
  return new Promise(function(resolve, reject) {
    var script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = function() { reject(new Error("无法加载: " + src)); };
    document.head.appendChild(script);
  });
}

// 暴露内部函数到 window（供单元测试访问，isolated world 中无安全风险）
try {
  window.generatePDF = generatePDF;
  window.cloneDocumentForExport = cloneDocumentForExport;
  window.triggerDownload = triggerDownload;
  window.mapWithConcurrency = mapWithConcurrency;
} catch (e) {
  // 测试环境下函数可能被字符串替换，忽略
}
