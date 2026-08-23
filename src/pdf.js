/**
 * 网页导出 PDF 插件 - PDF 生成模块
 *
 * 负责图片 PDF 的渲染管线：DOM 克隆、html2pdf 渲染、图片修复、下载触发。
 * 由 popup 按需注入（先于 content.js），与 content.js 共享 isolated world：
 *  - sendProgress() 由 content.js 提供；缺失时使用模块内 no-op 兜底（见下方）
 *  - html2pdf 由 popup 在图片导出前通过 executeScript 注入到同一 isolated world
 *
 * 使用 function 声明（重复注入时安全覆盖，不会抛 SyntaxError）
 */

// sendProgress 定义在 content.js 中，与本模块由 popup 一并注入；
// 此处提供 no-op 兜底，避免单独注入或顺序变化时抛 ReferenceError 中断导出
// （进度消息丢失可接受，导出流程不能中断；content.js 随后注入会覆盖此兜底）
if (typeof window.sendProgress !== 'function') {
  window.sendProgress = function() {};
}
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
            // 只保留高度；不复制原页面基于视口计算出的 width/margin，
            // 否则克隆内容在 iframe 里会被固定成原视口宽度并产生左/右偏移
            // （微信正文 max-width ~750px，固定宽 800px 的 iframe 里满宽即可）
            clone.style.height = style.height;
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

  // 页边距配置需在创建 iframe 前确定：iframe 宽度必须与 html2pdf 渲染容器
  // （宽 = pageSize.inner.width，即 A4 宽减左右页边距）严格一致。
  // 若两者不一致，内容会在渲染时以不同宽度重新排版，实测高度失准，
  // 导致 PDF 末尾内容被截断（历史 bug：800/1200px iframe vs 180mm≈680px 容器）。
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

  // CSS 规定 1in = 96px、1in = 25.4mm，据此把 mm 换算为 px
  var PX_PER_MM = 96 / 25.4;
  var contentMm = 210 - marginConfig[1] - marginConfig[3]; // A4 宽 - 左右页边距
  var iframeWidth = Math.round(contentMm * PX_PER_MM);
  var iframe = document.createElement("iframe");
  iframe.style.cssText = "position: fixed; top: 0; left: 0; width: " + iframeWidth + "px; height: 100vh; border: none; z-index: 999999; background: white; visibility: hidden;";
  document.body.appendChild(iframe);

  await new Promise(function(resolve) { setTimeout(resolve, 50); });

  var forceLightAttr = forceLightMode ? 'style="color-scheme: light !important;"' : '';
  var fontSizeVal = typeof fontSize === 'number' ? fontSize + 'px' : (fontSize || '16px');
  var lightModeCSS = forceLightMode ? ':root { color-scheme: light !important; } body { background: white !important; color: #000 !important; } [data-theme="dark"], .dark, .dark-mode { background-color: #fff !important; color: #000 !important; }' : '';

  var htmlContent = '<!DOCTYPE html><html ' + forceLightAttr + '><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><style>* { box-sizing: border-box; margin: 0; padding: 0; }body { font-family: "Charter", "Georgia", "Source Serif Pro", serif; font-size: ' + fontSizeVal + '; line-height: 1.6; color: #333; background: white; padding: 0; -webkit-print-color-adjust: exact !important; }' + lightModeCSS + 'img { max-width: 100%; height: auto; display: block; margin: 10px auto; }.pdf-readable-content { padding: 0; }h1 { margin-top: 0; }#KISS-Translator-Message, [id^="KISS-Translator-"] { display: none !important; }</style></head><body>' + element.innerHTML + '</body></html>';

  iframe.contentDocument.open();
  iframe.contentDocument.write(htmlContent);
  iframe.contentDocument.close();

  // 解析懒加载图片（微信等 data-src 占位）并设置 CORS，使 html2canvas 能无污染绘制；
  // 原始模式克隆自活页面，图片可能仍为 1px 占位 src
  try {
    if (window.__pdfCleaner && typeof window.__pdfCleaner.resolveLazyImages === 'function') {
      window.__pdfCleaner.resolveLazyImages(iframe.contentDocument, true);
    }
  } catch (e) {}

  // 记录 body 直接子元素快照：渲染前据此移除等待期间被翻译插件（如
  // KISS-Translator）注入的错误浮层
  var genBodySnapshot = [];
  try {
    genBodySnapshot = Array.prototype.slice.call(iframe.contentDocument.body.children || []);
  } catch (e) {}

  // 浏览器对 canvas 单边尺寸有硬性上限（Chrome 为 32767px），
  // 超出会得到空白画布，导出前必须拦截
  var MAX_CANVAS_DIM = 32767;

  // 注意：此刻 iframe 内图片尚未加载，scrollHeight 可能被低估，
  // 因此图片加载完成后（下方）会再次复核高度
  var contentHeight = iframe.contentDocument.body.scrollHeight;
  var finalScale = scale || 2;

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

  // 宽度防护：iframe 宽度 = A4 内容宽（约 680px，随页边距微调）且注入样式
  // 强制 img max-width:100%，正常情况 canvas 宽度 ≈ iframeWidth × scale，
  // 远低于上限；此处仅兜底页内存在不可收缩的超宽元素（如固定宽度表格）的罕见场景
  var contentWidth = iframe.contentDocument.body.scrollWidth || 0;
  if (contentWidth * finalScale > MAX_CANVAS_DIM) {
    iframe.remove();
    throw new Error(
      '页面内容过宽（' + contentWidth + 'px，缩放后超出图片 PDF ' + MAX_CANVAS_DIM +
      'px 上限），请改用「矢量 PDF」格式'
    );
  }

  var images = Array.from(iframe.contentDocument.querySelectorAll("img"));
  sendProgress(50, "正在处理跨域图片...");

  // 限制并发，避免图片极多的页面同时发起几十个请求
  await mapWithConcurrency(images, 8, function(img) {
    return waitForImageLoad(img);
  });

  // 图片加载完成后复核高度：未加载图片不参与布局高度计算，
  // 图片极多的页面实际高度可能远超首次读取值，两道拦截都用加载前高度会漏判
  var loadedHeight = iframe.contentDocument.body.scrollHeight;
  if (loadedHeight > contentHeight) {
    contentHeight = loadedHeight;
    if (contentHeight > MAX_CANVAS_DIM) {
      iframe.remove();
      throw new Error(
        '页面内容过长（' + contentHeight + 'px，超出图片 PDF ' + MAX_CANVAS_DIM +
        'px 上限），请改用「矢量 PDF」格式或开启「提取正文」模式'
      );
    }
    // 按复核后的高度重新收紧 scale
    if (contentHeight > 10000) {
      finalScale = Math.min(finalScale, 1.0);
    } else if (contentHeight > 5000) {
      finalScale = Math.min(finalScale, 1.5);
    }
  }

  // 防御性兜底：当前 popup 固定 scale=2，上方分支已保证画布高度不超限；
  // 该检查仅在未来配置调高 scale（约 >6.55）时才会生效，请勿删除
  if (contentHeight * finalScale > MAX_CANVAS_DIM) {
    finalScale = Math.max(MAX_CANVAS_DIM / contentHeight, 0.1);
    console.log('[PDF Exporter] 画布高度将超限，scale 进一步降至 ' + finalScale.toFixed(3));
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
      // 必须归零：html2canvas 默认把主页面滚动位置带入克隆文档
      // （toIFrame 中 scrollTo(scrollX, scrollY)），而渲染容器挂在
      // position:fixed 浮层里、截图原点恒为 (0,0)，页面滚动时容器会被
      // 推到 y=scrollY 处，导致 PDF 前面出现整页空白、末尾内容被裁掉
      scrollX: 0,
      scrollY: 0,
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

    // 渲染前移除等待期间被翻译插件注入的浮层（如 KISS-Translator 错误提示）
    try {
      Array.prototype.slice.call(iframe.contentDocument.body.children).forEach(function(el) {
        if (genBodySnapshot.indexOf(el) === -1) el.remove();
      });
    } catch (e) {}

    // 注意：不要设置 html2canvas.width/height 强制覆盖渲染尺寸。
    // html2pdf 会把内容克隆进宽为 pageSize.inner.width 的容器重新排版，
    // html2canvas 需按该容器的实际边界自适应高度；显式覆盖会裁掉末尾内容
    // （历史 bug：以 iframe 测量值硬设 height，重排后实际更高导致截断）。
    // iframe 宽度已与容器一致（见上方 iframeWidth），测量与真实布局对齐。

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
 * 每个等待步骤均有超时兜底，防止异常资源导致并发池永久挂起
 */
async function repairBrokenImage(img) {
  if (!img.src || img.src.startsWith("data:") || img.src.startsWith("blob:")) return;
  try {
    // fetch 超时兜底（8s）：网络挂起时中止请求，避免无限等待
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    var abortTimer = controller ? setTimeout(function() { controller.abort(); }, 8000) : null;
    var response = await fetch(img.src, controller ? { signal: controller.signal } : {})
      .catch(function() { return null; });
    if (abortTimer) clearTimeout(abortTimer);

    if (response && response.ok) {
      var blob = await response.blob();
      var dataUrl = await blobToDataURL(blob);
      // 等待 DataURL 图片解码完成，避免截图时仍在加载；
      // 异常 dataURL 可能不触发 onload/onerror，必须加超时（5s）兜底
      await new Promise(function(res) {
        var finished = false;
        function finish() {
          if (finished) return;
          finished = true;
          img.onload = null;
          img.onerror = null;
          res();
        }
        var decodeTimer = setTimeout(function() {
          console.warn("[PDF Exporter] DataURL 解码超时:", (img.src || '').slice(0, 80));
          finish();
        }, 5000);
        img.onload = function() { clearTimeout(decodeTimer); finish(); };
        img.onerror = function() { clearTimeout(decodeTimer); finish(); };
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
 * 检查 html2pdf 是否可用。
 * html2pdf 由 popup 在图片导出前通过 chrome.scripting.executeScript 注入到
 * 同一个 isolated world（不能用 <script> 标签懒加载——那样它跑在主世界，
 * 本模块看不到 window.html2pdf，且部分页面 CSP 会拦截）。
 */
async function loadLibraries() {
  if (window.html2pdf) return;
  throw new Error("无法加载 html2pdf 库");
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
