/**
 * 网页导出 PDF 插件 - 后台服务工作线程 (Service Worker)
 * Manifest V3
 */

// 安装时初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[PDF Exporter] 扩展已安装/更新:', details.reason);

  // 设置默认配置
  chrome.storage.local.set({
    defaultMode: 'original',
    includeImages: true,
    includeLinks: true
  });
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'downloadPDF':
      handleDownloadPDF(request, sendResponse);
      return true; // 异步响应

    case 'getSettings':
      handleGetSettings(sendResponse);
      return true;

    case 'saveSettings':
      handleSaveSettings(request, sendResponse);
      return true;

    default:
      return false;
  }
});

/**
 * 处理 PDF 下载请求
 */
async function handleDownloadPDF(request, sendResponse) {
  try {
    const { dataUrl, filename } = request;

    // 使用 Chrome 下载 API
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: sanitizeFilename(filename),
      saveAs: false // 直接保存到下载文件夹
    });

    sendResponse({
      success: true,
      downloadId
    });

  } catch (error) {
    console.error('[PDF Exporter] 下载失败:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 处理获取设置请求
 */
async function handleGetSettings(sendResponse) {
  try {
    const settings = await chrome.storage.local.get([
      'defaultMode',
      'includeImages',
      'includeLinks'
    ]);

    sendResponse({
      success: true,
      settings
    });

  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 处理保存设置请求
 */
async function handleSaveSettings(request, sendResponse) {
  try {
    await chrome.storage.local.set(request.settings);

    sendResponse({
      success: true
    });

  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 清理文件名，移除非法字符
 */
function sanitizeFilename(filename) {
  // Windows 非法字符: < > : " / \ | ? *
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200); // 限制长度
}

// 监听下载完成事件
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state) {
    console.log('[PDF Exporter] 下载状态更新:', delta.id, delta.state.current);
  }
});
