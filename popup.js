/**
 * 网页导出 PDF 插件 - 弹出面板脚本
 */

// DOM 元素
const exportBtn = document.getElementById("exportBtn");
const progress = document.getElementById("progress");
const progressFill = progress.querySelector(".progress-fill");
const progressText = progress.querySelector(".progress-text");
const errorDiv = document.getElementById("error");
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
  includeLinks: true,
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
    document.getElementById("includeLinks").checked = settings.includeLinks;
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
      includeLinks: document.getElementById("includeLinks").checked,
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
  const includeLinks = document.getElementById("includeLinks").checked;
  const fontSize = parseInt(document.getElementById("fontSize").value, 10);
  const margin = parseInt(document.getElementById("margin").value, 10);
  const quality = parseFloat(document.getElementById("imageQuality").value);

  return {
    mode: isReadable ? "readable" : "original",
    format, // 'vector' 或 'image'
    includeImages,
    includeLinks,
    fontSize,
    margin,
    quality: quality,
    scale: 2,
  };
}

/**
 * 确保 content script 已注入到标签页
 */
async function ensureContentScriptInjected(tabId) {
  try {
    // 尝试发送 ping 消息检查 content script 是否存在
    await chrome.tabs.sendMessage(tabId, { action: "ping" });
  } catch (e) {
    // Content script 未注入，需要手动注入
    console.log("[PDF Exporter] 注入 content script...");
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "lib/Readability.js",
        "src/extractor.js",
        "lib/html2pdf.bundle.min.js",
        "content.js",
      ],
    });
    // 等待脚本初始化
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * 使用浏览器原生打印功能生成矢量 PDF（文字可复制）
 */
async function exportToPDFVector(tabId, config) {
  // 通过 chrome.tabs.print() 或直接触发 window.print()
  // 这里我们使用 chrome.scripting.executeScript 来执行打印

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (includeImages) => {
      // 准备打印样式
      const printStyles = document.createElement("style");
      printStyles.textContent = `
        @media print {
          /* 重置页面设置 */
          @page {
            size: auto;
            margin: 10mm;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          body {
            font-size: 12pt !important;
            line-height: 1.5 !important;
          }

          /* 确保内容不被截断 */
          div, section, article, main, p, ul, ol, li, table, figure {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* 图片处理 */
          img {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid !important;
            ${includeImages ? "" : "display: none !important;"}
          }

          /* 隐藏不需要打印的元素 */
          nav, header, footer, aside, .ad, .ads, .advertisement,
          .social-share, .comments, [role="navigation"],
          [role="banner"], [role="complementary"],
          script, style, noscript, iframe {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(printStyles);

      // 滚动到页面顶部确保完整渲染
      window.scrollTo(0, 0);

      // 等待一下确保渲染完成
      setTimeout(() => {
        // 触发打印
        window.print();

        // 清理
        setTimeout(() => printStyles.remove(), 1000);
      }, 500);
    },
    args: [config.includeImages],
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

      // 向 content script 发送消息执行导出
      updateProgress(40, "正在捕获页面内容...");

      const action =
        config.mode === "readable" ? "EXTRACT_CONTENT" : "exportPDF";

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: action,
        config: config,
        pageTitle: tab.title,
        pageUrl: tab.url,
      });

      if (!response || !response.success) {
        throw new Error(response?.error || "导出失败");
      }

      updateProgress(80, "正在生成 PDF 文件...");

      // 下载生成的 PDF
      const downloadId = await chrome.downloads.download({
        url: response.dataUrl,
        filename: response.filename,
        saveAs: true, // 提示用户选择保存位置
      });

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
  }
});
