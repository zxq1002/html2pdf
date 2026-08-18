/**
 * 网页导出 PDF 插件 - 内容清理模块（共享）
 *
 * 统一以下在此前 content.js 中重复实现三次的逻辑：
 *  - 噪声元素移除（选择器 + "长文本低链接密度保留"规则）
 *  - 链接密度清理（移除导航/推荐类链接密集块）
 *  - 空元素移除
 *  - 噪声文本模式匹配（作者/来源/推荐阅读等）
 *
 * 注意：
 *  - 使用 IIFE + 幂等守卫，重复注入安全
 *  - 挂载到 window.__pdfCleaner，供 content.js 与单元测试使用
 */
(function () {
  if (window.__pdfCleaner) return; // 已加载，跳过

  /**
   * 统一噪声选择器列表
   * 合并自原 noiseSelectors（Readability 路径）、postCleanSelectors（提取后二次净化）、
   * innerNoiseSelectors（直接提取内容清理）
   */
  var NOISE_SELECTORS = [
    // 语义化标签与 ARIA 角色
    'nav', 'footer', 'aside', 'header',
    '[role="navigation"]', '[role="complementary"]', '[role="banner"]',
    '[role="contentinfo"]', '[role="search"]', '[role="alert"]',
    // 已知站点常见类名
    '.nav', '.navigation', '.navbar', '.breadcrumb', '.breadcrumbs',
    '.aside', '.sidebar', '.side-bar', '.side_panel',
    '.footer', '.header', '.topbar', '.top-bar',
    '.ad', '.ads', '.advertisement', '.ad-container', '.ad-wrapper',
    '.social-share', '.share-bar', '.share-btn', '.toolbar', '.float-toolbar',
    '.back-top', '.back-to-top', '.go-top',
    '.related-news', '.recommend-articles', '.hot-topics',
    '.recommend', '.related', '.trending',
    '.comments-container', '.comments', '#comments', '.comment-list',
    '.mask', '.overlay', '.modal', '.dialog', '.popup', '.layer',
    '.float-layer', '.float-bar', '.fixed-bar', '.sticky-bar',
    '.user-action', '.login-prompt', '.login-panel',
    '.user-panel', '.auth-panel',
    '.copyright', '.site-info', '.footer-info',
    '.article-widget-head', '.widget-operation-skeleton',
    '.com-author-name', '.author-name', '.author-info',
    '.audio-player-skeleton', '.audio-wrap', '.head-detail',
    // class 通配
    '[class*="ad-"]', '[class*="ads-"]', '[class*="advert"]',
    '[class*="recommend"]', '[class*="related"]', '[class*="comment"]',
    '[class*="share"]', '[class*="social"]',
    '[class*="popup"]', '[class*="modal"]', '[class*="dialog"]', '[class*="overlay"]',
    '[class*="float-"]', '[class*="sticky-"]', '[class*="fixed-"]',
    '[class*="nav"]', '[class*="breadcrumb"]',
    '[class*="sidebar"]', '[class*="Sidebar"]', '[class*="side-bar"]', '[class*="SideBar"]',
    '[class*="side_panel"]', '[class*="aside"]', '[class*="Aside"]',
    '[class*="toolbar"]', '[class*="tool-bar"]',
    '[class*="action-bar"]', '[class*="actionbar"]', '[class*="ActionBar"]',
    '[class*="operation-bar"]', '[class*="OperationBar"]',
    '[class*="copyright"]', '[class*="footer"]',
    '[class*="login"]', '[class*="signup"]', '[class*="register"]', '[class*="auth-"]',
    '[class*="widget"]', '[class*="banner"]',
    '[class*="skeleton"]', '[class*="placeholder"]', '[class*="loading"]',
    '[class*="audio"]',
    // 特定站点定制类名（InfoQ/腾讯新闻等）
    '[class*="_content-side"]', '[class*="_operation-bar"]',
    '[class*="_topic-nav"]', '[class*="_sub-nav"]',
    '[class*="_layout-footer"]', '[class*="_nav-list"]',
    '[class*="_article-cover"]', '[class*="_audio-wrap"]',
    // id 通配
    '[id*="ad-"]', '[id*="ads-"]',
    '[id*="recommend"]', '[id*="related"]', '[id*="comment"]',
    '[id*="share"]', '[id*="social"]',
    '[id*="nav"]', '[id*="breadcrumb"]', '[id*="sidebar"]',
    '[id*="footer"]', '[id*="widget"]', '[id*="banner"]',
    // 交互/脚本类标签
    'script', 'style', 'noscript', 'iframe',
    'button', 'input', 'textarea', 'select',
    'svg.icon', 'svg[class*="icon"]'
  ];

  /**
   * 噪声文本模式（整块文本匹配即移除）
   */
  var NOISE_TEXT_PATTERNS = [
    /^\s*作者[：:]\s*/i,
    /^\s*来源[：:]\s*/i,
    /^\s*原文链接[：:]\s*/i,
    /^\s*本文字数[：:]\s*/i,
    /^\s*阅读完需[：:]\s*/i,
    /^\s*推荐阅读\s*$/i,
    /^\s*相关推荐\s*$/i,
    /^\s*热门文章\s*$/i,
    /^\s*精选集\s*$/i,
    /^\s*立即下载\s*$/i,
    /^\s*大小[：:]\s*\d/i,
    /^\s*时长[：:]\s*\d/i,
    /^\s*\d+\.\d+M\s*$/i,
    /^\s*\d+:\d+\s*$/i
  ];

  /**
   * 计算元素内链接文本占比（0~1）
   * @param {Element} el - 目标元素
   * @param {string} [text] - 预先计算的文本内容（避免重复读取）
   * @returns {number}
   */
  function linkDensity(el, text) {
    text = text != null ? text : el.textContent.trim();
    if (!text.length) return 0;
    var links = el.querySelectorAll('a');
    var linkText = '';
    for (var i = 0; i < links.length; i++) {
      linkText += links[i].textContent.trim();
    }
    return linkText.length / text.length;
  }

  /**
   * 按选择器移除噪声元素
   * 保留规则：文本长度 > keepTextLen 且链接密度 < keepMaxDensity 的元素视为正文，不移除
   *
   * @param {Element|Document} root - 清理根节点
   * @param {string[]} selectors - 噪声选择器列表
   * @param {Object} [opts]
   * @param {number} [opts.keepTextLen=200] - 保留所需最小文本长度
   * @param {number} [opts.keepMaxDensity=0.3] - 保留所需最大链接密度
   */
  function removeNoise(root, selectors, opts) {
    opts = opts || {};
    var keepTextLen = opts.keepTextLen != null ? opts.keepTextLen : 200;
    var keepMaxDensity = opts.keepMaxDensity != null ? opts.keepMaxDensity : 0.3;

    selectors.forEach(function (selector) {
      try {
        root.querySelectorAll(selector).forEach(function (el) {
          var text = el.textContent.trim();
          if (text.length > keepTextLen && linkDensity(el, text) < keepMaxDensity) {
            return; // 长文本且链接少，视为正文保留
          }
          el.remove();
        });
      } catch (e) {
        // 选择器无效等异常，跳过
      }
    });
  }

  /**
   * 链接密度清理：移除链接密集、文本少的块级元素（典型导航/推荐列表）
   *
   * @param {Element|Document} root - 清理根节点
   * @param {Object} [opts]
   * @param {string} [opts.selector='div, section, ul, aside'] - 扫描范围
   * @param {number} [opts.minText=20] - 文本少于此长度的块直接移除
   * @param {number} [opts.densityLimit=0.6] - 高密度判定阈值
   * @param {number} [opts.highDensityMaxText=2000] - 高密度块文本少于此长度时移除
   * @param {number} [opts.manyLinks=10] - 多链接判定阈值
   * @param {number} [opts.manyLinksMaxText=500] - 多链接块文本少于此长度时移除
   */
  function cleanByLinkDensity(root, opts) {
    opts = opts || {};
    var selector = opts.selector || 'div, section, ul, aside';
    var minText = opts.minText != null ? opts.minText : 20;
    var densityLimit = opts.densityLimit != null ? opts.densityLimit : 0.6;
    var highDensityMaxText = opts.highDensityMaxText != null ? opts.highDensityMaxText : 2000;
    var manyLinks = opts.manyLinks != null ? opts.manyLinks : 10;
    var manyLinksMaxText = opts.manyLinksMaxText != null ? opts.manyLinksMaxText : 500;

    root.querySelectorAll(selector).forEach(function (el) {
      if (el === root || el === root.body || el === root.documentElement) return;
      var text = el.textContent.trim();
      if (text.length < minText) { el.remove(); return; }
      var links = el.querySelectorAll('a');
      if (links.length === 0) return;
      if (linkDensity(el, text) > densityLimit && text.length < highDensityMaxText) {
        el.remove();
        return;
      }
      if (links.length > manyLinks && text.length < manyLinksMaxText) {
        el.remove();
      }
    });
  }

  /**
   * 移除空元素（无子元素、无文本、无图片）
   * @param {Element|Document} root - 清理根节点
   * @param {string} [selector='div, span, p'] - 扫描范围
   */
  function removeEmpty(root, selector) {
    root.querySelectorAll(selector || 'div, span, p').forEach(function (el) {
      if (el.children.length === 0 && el.textContent.trim() === '' && !el.querySelector('img')) {
        el.remove();
      }
    });
  }

  /**
   * 按文本模式移除噪声块（如"作者：xxx"、"推荐阅读"）
   * @param {Element|Document} root - 清理根节点
   * @param {RegExp[]} patterns - 文本匹配模式列表
   * @param {string} [selector='p, div, span, li'] - 扫描范围
   */
  function removeNoiseText(root, patterns, selector) {
    root.querySelectorAll(selector || 'p, div, span, li').forEach(function (el) {
      var text = el.textContent.trim();
      for (var i = 0; i < patterns.length; i++) {
        if (patterns[i].test(text)) {
          el.remove();
          break;
        }
      }
    });
  }

  window.__pdfCleaner = {
    NOISE_SELECTORS: NOISE_SELECTORS,
    NOISE_TEXT_PATTERNS: NOISE_TEXT_PATTERNS,
    linkDensity: linkDensity,
    removeNoise: removeNoise,
    cleanByLinkDensity: cleanByLinkDensity,
    removeEmpty: removeEmpty,
    removeNoiseText: removeNoiseText
  };
})();
