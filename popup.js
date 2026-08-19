/**
 * 网页导出 PDF 插件 - 弹出面板脚本
 */

// DOM 元素
const exportBtn = document.getElementById("exportBtn");
const progress = document.getElementById("progress");
const progressFill = progress.querySelector(".progress-fill");
const progressText = progress.querySelector(".progress-text");
const statusToast = document.getElementById("statusToast");

// UI 状态枚举
const STATE = {
  IDLE: "idle",
  PROCESSING: "processing",
  SUCCESS: "success",
  ERROR: "error",
};

// 默认设置
const DEFAULT_SETTINGS = {
  extractContent: false,
  exportFormat: "vector",
  includeImages: true,
  forceLightMode: true,
  fontSize: 16,
  margin: 15,
  quality: 0.9,
};

/**
 * 设置 UI 状态
 * @param {string} state - 状态 (STATE 之一)
 * @param {string} message - 可选消息
 */
function setUIState(state, message = "") {
  // 默认重置
  exportBtn.disabled = false;
  progress.classList.add("hidden");
  statusToast.classList.add("hidden");
  statusToast.className = "status-toast hidden";

  switch (state) {
    case STATE.IDLE:
      break;

    case STATE.PROCESSING:
      exportBtn.disabled = true;
      progress.classList.remove("hidden");
      if (message) {
        updateProgress(10, message);
      }
      break;

    case STATE.SUCCESS:
      statusToast.textContent = message || "导出成功";
      statusToast.classList.add("success");
      statusToast.classList.remove("hidden");
      setTimeout(() => {
        statusToast.classList.add("hidden");
      }, 3000);
      break;

    case STATE.ERROR:
      statusToast.textContent = message || "发生错误";
      statusToast.classList.add("error");
      statusToast.classList.remove("hidden");
      setTimeout(() => {
        statusToast.classList.add("hidden");
      }, 5000);
      break;
  }
}

/**
 * 显示错误信息
 * @param {string} message - 错误消息
 */
function showError(message) {
  setUIState(STATE.ERROR, message);
}

/**
 * 更新进度显示
 * @param {number} percent - 进度百分比 (0-100)
 * @param {string} text - 进度文本
 */
function updateProgress(percent, text) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = text || `正在生成 PDF... ${percent}%`;
}

/**
 * 从存储加载设置并更新 UI
 */
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);

    document.getElementById("extractContent").checked = settings.extractContent;

    const formatRadio = document.querySelector(
      `input[name="exportFormat"][value="${settings.exportFormat}"]`,
    );
    if (formatRadio) formatRadio.checked = true;

    document.getElementById("includeImages").checked = settings.includeImages;
    document.getElementById("forceLightMode").checked = settings.forceLightMode;
    document.getElementById("fontSize").value = settings.fontSize;
    document.getElementById("margin").value = settings.margin;

    const qualitySlider = document.getElementById("imageQuality");
    if (qualitySlider) {
      qualitySlider.value = settings.quality;
      const qualityDisplay = document.getElementById("qualityValue");
      if (qualityDisplay) qualityDisplay.textContent = settings.quality;
    }
  } catch (error) {
    console.error("加载设置失败:", error);
  }
}

/**
 * 将当前 UI 的设置保存到存储
 */
async function saveSettings() {
  try {
    const settings = {
      extractContent: document.getElementById("extractContent").checked,
      exportFormat: document.querySelector('input[name="exportFormat"]:checked')
        .value,
      includeImages: document.getElementById("includeImages").checked,
      forceLightMode: document.getElementById("forceLightMode").checked,
      fontSize: parseInt(document.getElementById("fontSize").value, 10),
      margin: parseInt(document.getElementById("margin").value, 10),
      quality: parseFloat(document.getElementById("imageQuality").value),
    };
    await chrome.storage.local.set(settings);
  } catch (error) {
    console.error("保存设置失败:", error);
  }
}

/**
 * 获取用户选择的配置
 * @returns {Object} 配置对象
 */
function getExportConfig() {
  const isReadable = document.getElementById("extractContent").checked;
  const format = document.querySelector(
    'input[name="exportFormat"]:checked',
  ).value;
  const includeImages = document.getElementById("includeImages").checked;
  const forceLightMode = document.getElementById("forceLightMode").checked;
  const fontSize = parseInt(document.getElementById("fontSize").value, 10);
  const margin = parseInt(document.getElementById("margin").value, 10);
  const quality = parseFloat(document.getElementById("imageQuality").value);

  return {
    mode: isReadable ? "readable" : "original",
    format, // 'vector' 或 'image'
    includeImages,
    forceLightMode,
    fontSize,
    margin,
    quality: quality,
    scale: 2,
  };
}

/**
 * 确保 content script 已注入到标签页
 * - 按需注入（manifest 不再声明 content_scripts），仅在用户点击导出时执行
 * - 不注入 html2pdf（约 900KB），由 src/pdf.js 在需要图片 PDF 时懒加载
 * - 注入顺序：Readability → extractor → cleaner → pdf → content
 * - 用 ping 探测替代固定等待
 */
async function ensureContentScriptInjected(tabId) {
  console.log("[PDF Exporter] 注入 content script...");
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      "lib/Readability.js",
      "src/extractor.js",
      "src/cleaner.js",
      "src/pdf.js",
      "content.js",
    ],
  });

  // ping 探测等待初始化完成，最多 2s
  for (let i = 0; i < 10; i++) {
    try {
      const res = await callContentScript(tabId, "ping");
      if (res && res.success && res.contextValid) return;
    } catch (e) {
      // 尚未就绪，继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * 向 content script 发送指令
 * 使用 chrome.scripting.executeScript 调用 window.__pdfExporterHandleAction
 * 完全绕过 chrome.tabs.sendMessage，避免 iframe 中失效的旧脚本截获消息
 */
async function callContentScript(tabId, action, params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (a, p) => window.__pdfExporterHandleAction(a, p),
    args: [action, params],
    // 不指定 world，默认在 isolated world 执行，与 content script 同一世界
  });
  if (!results || !results[0]) {
    throw new Error('content script 未返回结果');
  }
  return results[0].result;
}

/**
 * 使用浏览器原生打印功能生成矢量 PDF（文字可复制）
 */
async function exportToPDFVector(tabId, config) {
  // 如果是阅读模式，先通过 content script 提取正文，再打印
  if (config.mode === 'readable') {
    await ensureContentScriptInjected(tabId);

    const tabInfo = await chrome.tabs.get(tabId);
    const response = await callContentScript(tabId, 'GET_READABLE_HTML', {
      pageTitle: tabInfo.title,
      pageUrl: tabInfo.url,
    });

    if (!response || !response.success) {
      throw new Error(response?.error || '阅读模式内容提取失败');
    }

    // 将提取的正文内容放入隐藏 iframe 中打印，完全隔离页面上的扩展悬浮按钮
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (htmlContent, includeImages, forceLightMode, pageTitle) => {
        return new Promise((resolve) => {
          // 创建隐藏 iframe 承载打印内容
          var iframe = document.createElement('iframe');
          iframe.id = '__pdf_exporter_print_frame';
          iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:2147483646;background:white;';
          document.body.appendChild(iframe);

          var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title></title></head><body></body></html>');
          iframeDoc.close();

          // 通过 DOM API 设置标题：tab.title 是页面可控内容，
          // 直接拼入 document.write 可被注入 HTML/脚本
          iframeDoc.title = pageTitle || '';

          // 写入正文内容
          iframeDoc.body.innerHTML = htmlContent;

          // 添加打印样式到 iframe
          var printStyles = iframeDoc.createElement('style');
          printStyles.textContent = `
            @media print {
              @page { size: auto; margin: 15mm; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              html, body { background: white !important; ${forceLightMode ? 'color: black !important;' : ''} width: 100% !important; }
              body { padding: 0; margin: 0; }
              img { max-width: 100% !important; height: auto !important; page-break-inside: avoid !important; ${includeImages ? '' : 'display: none !important;'} }
              .article-body p { margin-bottom: 1.2em; text-align: justify; }
              a { color: inherit !important; }
            }
          `;
          iframeDoc.head.appendChild(printStyles);

          // 等待 iframe 渲染完成后触发打印
          setTimeout(function() {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            // 打印完成后清理 iframe
            setTimeout(function() {
              iframe.remove();
              resolve();
            }, 500);
          }, 500);
        });
      },
      args: [response.htmlContent, config.includeImages, config.forceLightMode, tabInfo.title],
    });

    return;
  }

  // 原始模式：将页面内容复制到隐藏 iframe 中打印，隔离扩展悬浮元素
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (includeImages, forceLightMode) => {
      return new Promise(function(resolve) {
        // 创建隐藏 iframe
        var iframe = document.createElement('iframe');
        iframe.id = '__pdf_exporter_print_frame';
        iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:2147483646;background:white;';
        document.body.appendChild(iframe);

        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();

        // 复制当前页面的 HTML 结构
        var pageHtml = document.documentElement.outerHTML;
        iframeDoc.write(pageHtml);
        iframeDoc.close();

        // 在 iframe 中移除浮动 UI 元素（使用 getComputedStyle 检测）
        // iframe 是静态副本，扩展脚本不在其中运行，不会被反向覆盖
        try {
          var allElems = iframeDoc.querySelectorAll('*');
          for (var i = allElems.length - 1; i >= 0; i--) {
            var el = allElems[i];
            var tag = el.tagName;
            if (tag === 'BODY' || tag === 'HTML' || tag === 'HEAD') continue;
            // 跳过页面主要内容区域
            if (el.closest('article, main, [role="main"], .article, .post, .content, .entry-content')) continue;

            var cs = getComputedStyle(el);
            var pos = cs.position;
            if (pos !== 'fixed' && pos !== 'sticky') continue;

            var zi = parseInt(cs.zIndex, 10);
            if (pos === 'fixed' && (!isNaN(zi) ? zi >= 500 : true)) {
              el.remove();
            } else if (pos === 'sticky' && !isNaN(zi) && zi >= 9990) {
              el.remove();
            }
          }
        } catch(e) {}

        // 添加打印样式
        var printStyles = iframeDoc.createElement('style');
        printStyles.textContent = `
          @media print {
            @page { size: auto; margin: 10mm; }
            ${forceLightMode ? ':root { color-scheme: light !important; }' : ''}
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { width: 100% !important; height: auto !important; overflow: visible !important; background: white !important; ${forceLightMode ? 'color: black !important;' : ''} }
            body { font-size: 12pt !important; line-height: 1.5 !important; }
            /* 只对小型不可分割元素禁止分页，避免长块元素导致大片空白或截断 */
            img, figure, blockquote, pre, tr { break-inside: avoid; page-break-inside: avoid; }
            h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; }
            img { max-width: 100% !important; height: auto !important; ${includeImages ? '' : 'display: none !important;'} }
            nav, header, footer, aside, .ad, .ads, .advertisement,
            .social-share, .comments, [role="navigation"],
            [role="banner"], [role="complementary"],
            script, style, noscript, iframe { display: none !important; }
          }
        `;
        iframeDoc.head.appendChild(printStyles);

        // 等待渲染后打印
        setTimeout(function() {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();

          setTimeout(function() {
            iframe.remove();
            resolve();
          }, 500);
        }, 800);
      });
    },
    args: [config.includeImages, config.forceLightMode],
  });
}

/**
 * 执行 PDF 导出
 */
async function exportToPDF() {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      showError("无法获取当前标签页");
      return;
    }

    // 检查是否是允许的页面
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:")
    ) {
      showError("无法导出浏览器内部页面");
      return;
    }

    // 更新 UI 状态
    setUIState(STATE.PROCESSING, "正在准备...");

    const config = getExportConfig();

    // 根据格式选择导出方式
    if (config.format === "vector") {
      // 矢量 PDF - 使用浏览器原生打印
      updateProgress(50, "正在生成矢量 PDF...");
      await exportToPDFVector(tab.id, config);

      setUIState(STATE.SUCCESS, "导出完成！");
      setTimeout(() => window.close(), 1500);
    } else {
      // 图片 PDF - 使用 html2pdf
      // 确保 content script 已注入
      updateProgress(20, "正在注入脚本...");
      await ensureContentScriptInjected(tab.id);

      // 向 content script 发送指令执行导出
      // content script 内部直接通过 blob URL 触发下载，
      // 避免大体积 base64 在 executeScript 通道中往返
      updateProgress(40, "正在捕获页面内容...");

      const action =
        config.mode === "readable" ? "EXTRACT_CONTENT" : "exportPDF";

      const response = await callContentScript(tab.id, action, {
        config: config,
        pageTitle: tab.title,
        pageUrl: tab.url,
      });

      if (!response || !response.success) {
        throw new Error(response?.error || "导出失败");
      }

      updateProgress(100, "导出完成！");
      setUIState(STATE.SUCCESS, "导出完成！");

      // 延迟关闭弹窗
      setTimeout(() => {
        window.close();
      }, 1500);
    }
  } catch (error) {
    console.error("导出失败:", error);
    showError(`导出失败: ${error.message}`);
  }
}

// 事件监听
document.addEventListener("DOMContentLoaded", () => {
  // 加载已保存的设置
  loadSettings();

  const imageQuality = document.getElementById("imageQuality");
  const qualityValue = document.getElementById("qualityValue");
  if (imageQuality && qualityValue) {
    imageQuality.addEventListener("input", () => {
      qualityValue.textContent = imageQuality.value;
    });
  }

  exportBtn.addEventListener("click", exportToPDF);

  // 监听所有输入的变化并自动保存
  const inputs = document.querySelectorAll("input, select");
  inputs.forEach((input) => {
    input.addEventListener("change", saveSettings);
  });

  // 添加键盘快捷键支持
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !exportBtn.disabled) {
      exportToPDF();
    }
  });
});

// 监听来自 Content Script 的进度消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PROGRESS_UPDATE") {
    updateProgress(request.percent, request.message);

    // 如果包含优化提示，显示信息 Toast (Task 1)
    if (request.message && request.message.includes("优化")) {
      statusToast.textContent = request.message;
      statusToast.className = "status-toast info";
      statusToast.classList.remove("hidden");
      
      // 3秒后自动隐藏优化提示，除非已经被其他状态覆盖
      setTimeout(() => {
        if (statusToast.classList.contains("info")) {
          statusToast.classList.add("hidden");
        }
      }, 3000);
    }
  }
});
