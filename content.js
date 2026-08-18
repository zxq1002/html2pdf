/**
 * 网页导出 PDF 插件 - 内容脚本
 * 负责在网页上下文中执行 PDF 生成
 *
 * 重要：使用 var 而非 const/let，因为 chrome.scripting.executeScript
 * 二次注入时 const 会抛 SyntaxError 导致整个脚本静默失败
 */

// 检查扩展上下文是否仍然有效
function isExtensionContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// 内容脚本版本号 —— 每次修改 content.js 后必须更新！
var CONTENT_SCRIPT_VERSION = '2026-08-19-v7';

// 清理旧版本：移除旧的事件监听器和全局状态
if (typeof window.__pdfExporterCleanup === 'function') {
  console.log('[PDF Exporter] 清理旧版本...');
  try {
    window.__pdfExporterCleanup();
  } catch(e) {
    console.warn('[PDF Exporter] 清理旧版本出错:', e);
  }
}

// 如果已注入相同或更新版本，跳过
if (window.__pdfExporterInjected === CONTENT_SCRIPT_VERSION) {
  console.log('[PDF Exporter] 相同版本已注入，跳过:', CONTENT_SCRIPT_VERSION);
} else {

// 安全的 sendResponse 包装器，防止通道关闭导致异常传播
function safeSendResponse(sendResponse, data) {
  try {
    sendResponse(data);
  } catch (e) {
    console.warn('[PDF Exporter] sendResponse 失败（通道可能已关闭）:', e.message);
  }
}

// 注：popup 统一通过 chrome.scripting.executeScript 调用 window.__pdfExporterHandleAction，
// 不再注册 chrome.runtime.onMessage 监听器（避免 iframe 中旧脚本截获消息）

// 保存清理函数和版本号
window.__pdfExporterCleanup = function() {
  delete window.__pdfExporterInjected;
  delete window.__extractorInjected;
  if (typeof window.extract !== 'undefined') delete window.extract;
};
window.__pdfExporterInjected = CONTENT_SCRIPT_VERSION;
console.log('[PDF Exporter] 内容脚本已注入 v' + CONTENT_SCRIPT_VERSION);

/**
 * 向 Popup 发送进度更新
 */
function sendProgress(percent, message) {
  if (!isExtensionContextValid()) return;
  try {
    chrome.runtime.sendMessage({
      action: "PROGRESS_UPDATE",
      percent: percent,
      message: message
    }).catch(function() {
      // 如果 Popup 已关闭，sendMessage 会报错，忽略即可
    });
  } catch (e) {
    // 忽略
  }
}

/**
 * 处理 PDF 导出请求
 * 返回结果对象，同时通过 sendResponse 通知（兼容两种调用方式）
 */
async function handleExportPDF(request, sendResponse) {
  var response;
  try {
    var config = request.config || {};
    var pageTitle = request.pageTitle;
    var pageUrl = request.pageUrl;

    console.log("[PDF Exporter] 开始导出:", {
      mode: config.mode,
      url: pageUrl,
    });

    sendProgress(10, "正在准备内容...");

    var contentElement;
    var extractedTitle = pageTitle;

    if (config.mode === "readable") {
      var result = await extractReadableContent();
      contentElement = result.element;
      extractedTitle = result.extractedTitle;
    } else {
      contentElement = await cloneDocumentForExport(config);
    }

    sendProgress(30, "内容准备完成，开始渲染...");

    console.log("[PDF Exporter] 内容准备完成，开始生成 PDF");

    var pdfResult = await generatePDF(contentElement, {
      includeImages: config.includeImages,
      forceLightMode: config.forceLightMode,
      fontSize: config.fontSize,
      margin: config.margin,
      quality: config.quality,
      scale: config.scale,
      pageTitle: pageTitle,
      extractedTitle: extractedTitle,
      pageUrl: pageUrl,
    });

    console.log("[PDF Exporter] PDF 生成完成:", pdfResult.filename);

    response = {
      success: true,
      blob: pdfResult.blob,
      filename: pdfResult.filename,
    };
  } catch (error) {
    console.error("[PDF Exporter] 导出失败:", error);
    response = {
      success: false,
      error: (error && error.message) || String(error) || "未知错误",
    };
  }

  if (typeof sendResponse === 'function') {
    safeSendResponse(sendResponse, response);
  }
  return response;
}

/**
 * 等待元素出现在 DOM 中（用于 SPA 页面，如 InfoQ/极客邦）
 * @param {string} selector - CSS 选择器
 * @param {number} timeout - 最大等待时间(ms)
 * @returns {Promise<Element|null>}
 */
function waitForElement(selector, timeout) {
  timeout = timeout || 3000;
  return new Promise(function(resolve) {
    var el = document.querySelector(selector);
    if (el) {
      resolve(el);
      return;
    }

    var resolved = false;
    var observer = new MutationObserver(function() {
      var el = document.querySelector(selector);
      if (el && !resolved) {
        resolved = true;
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(function() {
      if (!resolved) {
        resolved = true;
        observer.disconnect();
        resolve(null);
      }
    }, timeout);
  });
}

/**
 * 提取可阅读内容
 */
async function extractReadableContent() {
  try {
    // 检查提取函数是否存在（支持全局变量或显式挂载到 window）
    var extractFn = typeof extract === "function" ? extract : window.extract;

    if (typeof extractFn !== "function") {
      console.error("[PDF Exporter] Extractor function not found in global scope or window.extract");
      throw new Error("提取模块未正确加载，请尝试刷新页面");
    }

    // === Phase 1: 直接提取已知内容容器（SPA 优先路径） ===
    var directContentSelectors = [
      { selector: '.ProseMirror', name: 'ProseMirror' },
      { selector: '[data-type="doc"]', name: 'data-type-doc' },
      { selector: '#js_content', name: 'wechat' },
      { selector: '#article_content', name: 'csdn' },
      { selector: '#cnblogs_post_body', name: 'cnblogs' },
      { selector: '.Post-RichTextContainer', name: 'zhihu' },
      { selector: '.article-content', name: 'article-content' },
      { selector: '.article-body', name: 'article-body' },
      { selector: '.post-content', name: 'post-content' },
      { selector: '.entry-content', name: 'entry-content' },
    ];

    var article = null;
    var usedDirectExtraction = false;

    for (var i = 0; i < directContentSelectors.length; i++) {
      var selInfo = directContentSelectors[i];
      try {
        // 先立即查找
        var elements = document.querySelectorAll(selInfo.selector);

        // 如果没找到且是 SPA 关键选择器，等待渲染完成
        if (elements.length === 0 && (selInfo.name === 'ProseMirror' || selInfo.name === 'data-type-doc')) {
          console.log('[PDF Exporter] ' + selInfo.name + ' 未立即找到，等待 SPA 渲染...');
          await waitForElement(selInfo.selector, 2000);
          elements = document.querySelectorAll(selInfo.selector);
        }

        if (elements.length === 0) continue;

        // 选择文本量最大的匹配元素
        var bestEl = null;
        var bestTextLen = 0;
        elements.forEach(function(el) {
          var textLen = el.textContent.trim().length;
          if (textLen > bestTextLen) {
            bestTextLen = textLen;
            bestEl = el;
          }
        });

        if (bestEl && bestTextLen > 50) {
          console.log('[PDF Exporter] 直接提取: ' + selInfo.name + ' (' + selInfo.selector + '), 元素数: ' + elements.length + ', 文本量: ' + bestTextLen);

          var cleanedHtml = cleanExtractedContent(bestEl.innerHTML);

          article = {
            title: document.title,
            content: cleanedHtml,
            excerpt: bestEl.textContent.trim().substring(0, 200),
            byline: ''
          };

          // 提取作者
          var authorSelectors = [
            '.author-name', '.author', '.byline', '.writer',
            '[class*="author"]', '[class*="byline"]',
            '.com-author-name'
          ];
          for (var j = 0; j < authorSelectors.length; j++) {
            var authorEl = document.querySelector(authorSelectors[j]);
            if (authorEl && authorEl.textContent.trim()) {
              article.byline = authorEl.textContent.trim();
              break;
            }
          }

          usedDirectExtraction = true;
          break;
        }
      } catch(e) {
        // 选择器无效，跳过
      }
    }

    // === Phase 2: Readability 回退路径 ===
    if (!article) {
      console.log('[PDF Exporter] 未找到已知容器，使用 Readability 提取');

      // 1. 标记隐藏元素
      document.querySelectorAll('*').forEach(function(el) {
        try {
          var computed = window.getComputedStyle(el);
          if (computed.display === 'none' || computed.visibility === 'hidden') {
            el.setAttribute('data-pdf-hidden', 'true');
          }
        } catch(e) {}
      });

      // 2. 克隆文档
      var markedClone = document.cloneNode(true);
      markedClone.querySelectorAll('[data-pdf-hidden="true"]').forEach(function(el) { el.remove(); });

      // 3. 全局噪声清理（Readability 路径，统一逻辑见 src/cleaner.js）
      // 此处作用于整页克隆，保留阈值更宽松：文本>300 且链接密度<0.25 才保留
      var cleaner = window.__pdfCleaner;
      cleaner.removeNoise(markedClone, cleaner.NOISE_SELECTORS, { keepTextLen: 300, keepMaxDensity: 0.25 });

      // 链接密度清理
      cleaner.cleanByLinkDensity(markedClone, {
        selector: 'div, section, ul, aside',
        minText: 20,
        highDensityMaxText: 2000,
        manyLinks: 10,
        manyLinksMaxText: 500,
      });

      // 处理延迟加载图片
      markedClone.querySelectorAll('img').forEach(function(img) {
        var lazySrc = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src');
        if (lazySrc && (!img.src || img.src.startsWith('data:'))) {
          img.src = lazySrc;
        }
      });

      // Readability 提取
      // 注意：Readability 会就地修改传入的 document，绝不能传活的 document，
      // 否则会破坏用户正在浏览的页面，必须始终传入克隆副本
      try {
        article = extractFn(markedClone);
      } catch(e) {
        console.warn('[PDF Exporter] Readability 提取失败:', e);
        article = extractFn(document.cloneNode(true));
      }

      if (!article || !article.content || article.content.trim().length < 50) {
        article = extractFn(document.cloneNode(true));
      }
    }

    // 2. 构建阅读模式容器
    var container = document.createElement("div");
    container.className = "pdf-readable-content";
    container.style.cssText = "max-width: 850px; margin: 0 auto; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"PingFang SC\", \"Microsoft YaHei\", sans-serif; line-height: 1.8; color: #2c3e50; background: #fff; word-wrap: break-word;";

    // 标题与元数据
    var titleEl = document.createElement("h1");
    titleEl.textContent = article.title || document.title;
    titleEl.style.cssText = "font-size: 34px; font-weight: 700; margin-bottom: 24px; color: #1a1a1a; line-height: 1.3; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px;";
    container.appendChild(titleEl);

    if (article.byline) {
      var authorP = document.createElement("p");
      authorP.textContent = article.byline;
      authorP.style.cssText = "font-size: 16px; color: #666; margin-bottom: 10px; font-weight: 500;";
      container.appendChild(authorP);
    }

    // 来源信息：使用 DOM API 构造，避免将 location.href 拼进 innerHTML（防 XSS）
    var sourceP = document.createElement("p");
    sourceP.style.cssText = "font-size: 13px; color: #999; margin-bottom: 35px;";
    sourceP.appendChild(document.createTextNode("来源: "));
    var sourceLink = document.createElement("a");
    // 只允许 http(s) 协议，防止 javascript: 等危险协议进入 PDF
    var href = window.location.href;
    sourceLink.href = /^https?:/i.test(href) ? href : "#";
    sourceLink.style.cssText = "color: #3498db; text-decoration: none;";
    sourceLink.textContent = window.location.hostname;
    sourceP.appendChild(sourceLink);
    container.appendChild(sourceP);

    // 正文内容净化
    var contentDiv = document.createElement("div");
    contentDiv.className = "article-body";
    contentDiv.innerHTML = article.content;

    // 3. 内容规范化
    try {
      normalizeContent(contentDiv);
    } catch (normErr) {
      console.warn('[PDF Exporter] normalizeContent 出错，使用原始内容:', normErr);
    }

    // 4. 对提取后的内容进行二次深度净化（统一逻辑见 src/cleaner.js）
    var cleaner = window.__pdfCleaner;
    cleaner.removeNoise(contentDiv, cleaner.NOISE_SELECTORS);

    // 4b. 链接密度清理
    cleaner.cleanByLinkDensity(contentDiv, {
      selector: 'div, section, aside, ul',
      minText: 15,
      highDensityMaxText: 1500,
      manyLinks: 8,
      manyLinksMaxText: 300,
    });

    // 4c. 移除空元素
    cleaner.removeEmpty(contentDiv, 'div, span');

    // 5. 强制重置所有元素的布局样式
    contentDiv.querySelectorAll("*").forEach(function(el) {
      var tagName = el.tagName.toLowerCase();
      var isTable = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'].indexOf(tagName) !== -1;
      var isImage = tagName === 'img';

      el.removeAttribute('class');
      el.removeAttribute('width');
      el.removeAttribute('height');
      el.removeAttribute('align');
      el.removeAttribute('valign');
      el.removeAttribute('border');

      if (isImage) {
        el.style.maxWidth = '100%';
        el.style.height = 'auto';
        el.style.display = 'block';
        el.style.margin = '25px auto';
        return;
      }

      if (isTable) {
        if (tagName === 'table') {
          el.style.width = '100%';
          el.style.borderCollapse = 'collapse';
          el.style.margin = '25px 0';
        }
        if (tagName === 'th' || tagName === 'td') {
          el.style.border = '1px solid #ddd';
          el.style.padding = '12px';
          el.style.textAlign = 'left';
        }
        return;
      }
    });

    // 5. 注入补全样式
    var styleFix = document.createElement("style");
    styleFix.textContent = '\
      .article-body { font-size: 17px; color: #2c3e50; }\
      .article-body * { box-sizing: border-box; position: static !important; float: none !important; }\
      .article-body div, .article-body section, .article-body article, .article-body p, .article-body h1, .article-body h2, .article-body h3, .article-body h4, .article-body h5, .article-body h6, .article-body ul, .article-body ol, .article-body blockquote, .article-body pre, .article-body figure, .article-body table { clear: both; }\
      .article-body p { margin-bottom: 1.6em; text-align: justify; }\
      .article-body img { max-width: 100% !important; height: auto !important; display: block; margin: 25px auto; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }\
      .article-body h1 { font-size: 28px; margin: 35px 0 18px; font-weight: 700; color: #1a1a1a; }\
      .article-body h2 { font-size: 26px; margin: 40px 0 20px; font-weight: 700; color: #1a1a1a; }\
      .article-body h3 { font-size: 20px; margin: 30px 0 15px; font-weight: 600; color: #333; }\
      .article-body h4 { font-size: 18px; margin: 25px 0 12px; font-weight: 600; color: #444; }\
      .article-body pre { background: #f8f9fa; padding: 20px; border-radius: 8px; overflow: auto; margin: 25px 0; border: 1px solid #eee; white-space: pre-wrap; word-wrap: break-word; }\
      .article-body code { font-family: "Fira Code", "Consolas", monospace; font-size: 0.9em; background: #f1f1f1; padding: 2px 5px; border-radius: 3px; }\
      .article-body pre code { background: none; padding: 0; font-size: 0.9em; }\
      .article-body blockquote { border-left: 5px solid #e0e0e0; padding-left: 20px; color: #777; font-style: italic; margin: 25px 0; }\
      .article-body ul, .article-body ol { padding-left: 25px; margin-bottom: 25px; }\
      .article-body li { margin-bottom: 8px; }\
      .article-body a { color: #3498db; text-decoration: none; border-bottom: 1px solid #e0e0e0; }\
      .article-body a:hover { border-bottom-color: #3498db; }\
      .article-body table { width: 100%; border-collapse: collapse; margin: 25px 0; }\
      .article-body th, .article-body td { border: 1px solid #ddd; padding: 12px; text-align: left; }\
      .article-body th { background: #f5f5f5; font-weight: 600; }\
      .article-body tr:nth-child(even) { background-color: #f9f9f9; }\
      .article-body figure { margin: 25px 0; text-align: center; }\
      .article-body figcaption { font-size: 14px; color: #999; margin-top: 8px; }\
      .article-body div { max-width: 100%; overflow-wrap: break-word; }\
    ';
    container.appendChild(styleFix);
    container.appendChild(contentDiv);

    // 6. 清理原始文档中的标记属性
    document.querySelectorAll('[data-pdf-hidden], [data-pdf-positioned]').forEach(function(el) {
      el.removeAttribute('data-pdf-hidden');
      el.removeAttribute('data-pdf-positioned');
    });

    return {
      element: container,
      extractedTitle: article.title || document.title
    };
  } catch (error) {
    try {
      document.querySelectorAll('[data-pdf-hidden], [data-pdf-positioned]').forEach(function(el) {
        el.removeAttribute('data-pdf-hidden');
        el.removeAttribute('data-pdf-positioned');
      });
    } catch(e) {}

    console.error("[PDF Exporter] 提取失败:", error);
    throw error;
  }
}

/**
 * 清理直接提取的 HTML 内容，移除常见的噪声元素
 */
function cleanExtractedContent(html) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(html, 'text/html');
  var body = doc.body;

  // 统一清理逻辑见 src/cleaner.js
  var cleaner = window.__pdfCleaner;
  cleaner.removeNoise(body, cleaner.NOISE_SELECTORS);
  cleaner.removeNoiseText(body, cleaner.NOISE_TEXT_PATTERNS);
  cleaner.removeEmpty(body, 'p, div, span');

  return body.innerHTML;
}

/**
 * 内容规范化：将各站自定义 HTML 转换为标准 HTML
 */
function normalizeContent(container) {
  // 1a. 处理缩进段落
  for (var i = 1; i <= 8; i++) {
    container.querySelectorAll('[data-indent-' + i + ']').forEach(function(el) {
      el.style.marginLeft = (i * 24) + 'px';
      el.removeAttribute('data-indent-' + i);
    });
  }

  // 1b. 处理对齐
  container.querySelectorAll('[data-align-right]').forEach(function(el) {
    el.style.textAlign = 'right';
    el.removeAttribute('data-align-right');
  });
  container.querySelectorAll('[data-align-center]').forEach(function(el) {
    el.style.textAlign = 'center';
    el.removeAttribute('data-align-center');
  });

  // 1c. 处理图片容器
  container.querySelectorAll('[data-type="image"]').forEach(function(wrapper) {
    var img = wrapper.querySelector('img');
    if (img) {
      var newImg = document.createElement('img');
      newImg.src = img.src;
      newImg.alt = img.alt || '';
      var widthAttr = wrapper.getAttribute('data-style-width');
      if (widthAttr) newImg.style.width = widthAttr;
      wrapper.parentNode.replaceChild(newImg, wrapper);
    } else {
      wrapper.remove();
    }
  });

  // 1d. 处理代码块
  container.querySelectorAll('[data-type="codeblock"]').forEach(function(block) {
    block.querySelectorAll('[data-codeblock-copy], [data-codeblock-explain]').forEach(function(btn) { btn.remove(); });
    block.querySelectorAll('[data-codeblock-index]').forEach(function(idx) { idx.remove(); });

    var codeLines = [];
    block.querySelectorAll('[data-type="codeline"]').forEach(function(line) {
      codeLines.push(line.textContent);
    });

    if (codeLines.length > 0) {
      var pre = document.createElement('pre');
      var code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.appendChild(code);
      block.parentNode.replaceChild(pre, block);
    } else {
      var text = block.textContent.trim();
      if (text) {
        var pre2 = document.createElement('pre');
        var code2 = document.createElement('code');
        code2.textContent = text;
        pre2.appendChild(code2);
        block.parentNode.replaceChild(pre2, block);
      } else {
        block.remove();
      }
    }
  });

  // 1e. 行内代码
  container.querySelectorAll('[data-type="codeinline"]').forEach(function(el) {
    var code = document.createElement('code');
    code.textContent = el.textContent;
    el.parentNode.replaceChild(code, el);
  });

  // 1f. 链接
  container.querySelectorAll('[data-type="link"]').forEach(function(el) {
    var a = document.createElement('a');
    a.href = el.getAttribute('href') || '#';
    a.textContent = el.textContent;
    el.parentNode.replaceChild(a, el);
  });

  // 1g. 视频
  container.querySelectorAll('[data-type="video"]').forEach(function(wrapper) {
    var iframeEl = wrapper.querySelector('iframe');
    if (iframeEl && iframeEl.src) {
      var p = document.createElement('p');
      p.style.color = '#999';
      p.style.fontStyle = 'italic';
      p.textContent = '[视频: ' + iframeEl.src + ']';
      wrapper.parentNode.replaceChild(p, wrapper);
    } else {
      wrapper.remove();
    }
  });

  // 2a. 移除 data-* 属性
  container.querySelectorAll('*').forEach(function(el) {
    var attrs = Array.from(el.attributes);
    attrs.forEach(function(attr) {
      if (attr.name.startsWith('data-')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // 2b. 列表结构清理
  container.querySelectorAll('ul, ol').forEach(function(list) {
    var children = Array.from(list.children);
    children.forEach(function(child) {
      if (child.tagName === 'P') {
        var li = document.createElement('li');
        li.innerHTML = child.innerHTML;
        list.replaceChild(li, child);
      }
    });
  });

  // 2c. 扁平化嵌套 div
  var changed = true;
  var iterations = 0;
  while (changed && iterations < 5) {
    changed = false;
    iterations++;
    container.querySelectorAll('div').forEach(function(div) {
      if (div.querySelector('img')) return;
      if (div.children.length === 1 && div.childNodes.length === 1) {
        var child = div.children[0];
        if (child.tagName === 'DIV' || child.tagName === 'P') {
          div.parentNode.replaceChild(child, div);
          changed = true;
        }
      }
    });
  }

  // 2d. 清理属性
  var allowedAttrs = {
    'a': ['href', 'title'],
    'img': ['src', 'alt'],
    'table': ['border'],
    'th': ['colspan', 'rowspan'],
    'td': ['colspan', 'rowspan'],
  };

  container.querySelectorAll('*').forEach(function(el) {
    var tagName = el.tagName.toLowerCase();
    var allowed = allowedAttrs[tagName] || [];
    var attrs = Array.from(el.attributes);
    attrs.forEach(function(attr) {
      if (allowed.indexOf(attr.name) === -1 && attr.name !== 'style') {
        el.removeAttribute(attr.name);
      }
    });
  });

  // 2e. 移除空元素
  container.querySelectorAll('p, div').forEach(function(el) {
    if (!el.querySelector('img') && el.textContent.trim() === '' && el.children.length === 0) {
      el.remove();
    }
  });
}


/**
 * 全局入口函数——供 popup 通过 chrome.scripting.executeScript 直接调用
 * 完全绕过 chrome.tabs.sendMessage，避免 iframe 中失效的旧脚本截获消息导致通道断开
 *
 * 注意：exportPDF 操作直接在 content script 中触发下载，
 * 不返回二进制数据（大数据无法通过 executeScript 结果序列化传回）
 */
window.__pdfExporterHandleAction = async function(action, params) {
  params = params || {};
  try {
    if (action === 'exportPDF') {
      var result = await handleExportPDF({
        config: params.config || {},
        pageTitle: params.pageTitle || document.title,
        pageUrl: params.pageUrl || location.href,
      });
      if (result.success && result.blob) {
        triggerDownload(result.blob, result.filename);
        return { success: true, filename: result.filename };
      }
      return result;
    }
    if (action === 'EXTRACT_CONTENT') {
      var result = await handleExportPDF({
        config: Object.assign({}, params.config || {}, { mode: 'readable' }),
        pageTitle: params.pageTitle || document.title,
        pageUrl: params.pageUrl || location.href,
      });
      if (result.success && result.blob) {
        triggerDownload(result.blob, result.filename);
        return { success: true, filename: result.filename };
      }
      return result;
    }
    if (action === 'GET_READABLE_HTML') {
      var htmlResult = await extractReadableContent();
      return {
        success: true,
        htmlContent: htmlResult.element.outerHTML,
        title: htmlResult.extractedTitle || params.pageTitle || document.title,
      };
    }
    if (action === 'ping') {
      return {
        success: true,
        version: window.__pdfExporterInjected || 'unknown',
        contextValid: isExtensionContextValid(),
      };
    }
    return { success: false, error: '未知操作: ' + action };
  } catch (err) {
    console.error('[PDF Exporter] __pdfExporterHandleAction 错误:', err);
    return { success: false, error: (err && err.message) || String(err) || '未知错误' };
  }
};

// 暴露内部函数到 window（供单元测试访问，isolated world 中无安全风险）
// 注：generatePDF/cloneDocumentForExport/triggerDownload 已拆分至 src/pdf.js，
// 由该模块自行暴露
try {
  window.extractReadableContent = extractReadableContent;
  window.cleanExtractedContent = cleanExtractedContent;
  window.normalizeContent = normalizeContent;
} catch (e) {
  // 测试环境下函数可能被字符串替换，忽略
}

} // end of version guard block
