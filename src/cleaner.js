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
 *  - 选择器按三条清理路径各自一套预设，禁止合并为并集统一套用
 *    （并集会让各路径命中本不属于它的通配选择器，误删正文风险显著上升）
 */
(function () {
  // 版本号：每次修改 cleaner.js 后必须更新，确保已注入旧版本的页面在重新注入时能覆盖
  var CLEANER_VERSION = '2026-08-19-v3';
  if (window.__pdfCleaner && window.__pdfCleaner.VERSION === CLEANER_VERSION) return; // 已加载同版本，跳过

  /**
   * 噪声选择器预设（三条路径独立使用，勿合并）
   *
   * 历史教训：曾将三套列表合并为单一 NOISE_SELECTORS 统一套用，
   * 导致 Readability 预清理与正文净化路径新增命中 [class*="nav"]、
   * [id*="banner"]、[class*="audio"] 等通配符，存在误删正文风险，
   * 故按路径恢复为独立预设。
   */

  // 路径 1：Readability 预清理（作用于整页克隆，配套最宽松保留阈值）
  var READABILITY_NOISE_SELECTORS = [
    'nav', 'footer', 'aside', 'header',
    '[role="navigation"]', '[role="complementary"]', '[role="banner"]',
    '[role="contentinfo"]', '[role="search"]', '[role="alert"]',
    '.nav', '.navigation', '.navbar', '.breadcrumb', '.breadcrumbs',
    '.aside', '.sidebar', '.side-bar', '.side_panel',
    '.footer', '.header', '.topbar', '.top-bar',
    '.ad', '.ads', '.advertisement', '.ad-container', '.ad-wrapper',
    '[class*="ad-"]', '[class*="ads-"]', '[class*="advert"]',
    '.social-share', '.share-bar', '.share-btn', '.toolbar', '.float-toolbar',
    '.back-top', '.back-to-top', '.go-top',
    '.related-news', '.recommend-articles', '.hot-topics',
    '.recommend', '.related', '.trending',
    '[class*="recommend"]', '[class*="related"]',
    '.comments-container', '.comments', '#comments', '.comment-list',
    '[class*="comment"]',
    '.mask', '.overlay', '.modal', '.dialog', '.popup', '.layer',
    '.float-layer', '.float-bar', '.fixed-bar', '.sticky-bar',
    '[class*="popup"]', '[class*="modal"]', '[class*="dialog"]',
    '[class*="float-"]', '[class*="sticky-"]',
    '.user-action', '.login-prompt', '.login-panel',
    '.user-panel', '.auth-panel',
    '.copyright', '.site-info', '.footer-info',
    'script', 'style', 'noscript', 'iframe',
    '[class*="share"]', '[class*="social"]',
    '[class*="widget"]', '[class*="banner"]',
    '[class*="skeleton"]', '[class*="placeholder"]', '[class*="loading"]',
    '.article-widget-head', '.widget-operation-skeleton',
    '.com-author-name', '.audio-player-skeleton',
    '[class*="_content-side"]', '[class*="_operation-bar"]',
    '[class*="_topic-nav"]', '[class*="_sub-nav"]',
    '[class*="_layout-footer"]', '[class*="_nav-list"]',
    '[class*="_article-cover"]', '[class*="_audio-wrap"]',
    '[class*="sidebar"]', '[class*="Sidebar"]',
    '[class*="side-bar"]', '[class*="SideBar"]',
    '[class*="aside"]', '[class*="Aside"]',
    '[class*="operation-bar"]', '[class*="OperationBar"]',
    '[class*="action-bar"]', '[class*="ActionBar"]',
    'button', 'input', 'textarea', 'select'
  ];

  // 路径 2：正文提取后二次净化（作用于 Readability 提取产物，默认保留阈值）
  var POST_CLEAN_SELECTORS = [
    '[class*="share"]', '[id*="share"]',
    '[class*="social"]', '[id*="social"]',
    '[class*="recommend"]', '[id*="recommend"]',
    '[class*="related"]', '[id*="related"]',
    '[class*="ad-"]', '[class*="ads-"]',
    '[class*="advert"]', '[id*="ad-"]', '[id*="ads-"]',
    '[class*="nav"]', '[id*="nav"]',
    '[class*="breadcrumb"]', '[id*="breadcrumb"]',
    '[class*="sidebar"]', '[id*="sidebar"]',
    '[class*="side-bar"]', '[class*="side_panel"]',
    '[class*="comment"]', '[id*="comment"]',
    '[class*="popup"]', '[class*="modal"]',
    '[class*="dialog"]', '[class*="overlay"]',
    '[class*="float-"]', '[class*="sticky-"]', '[class*="fixed-"]',
    '[class*="toolbar"]', '[class*="tool-bar"]',
    '[class*="action-bar"]', '[class*="actionbar"]',
    '[class*="copyright"]', '[class*="footer"]',
    '[id*="footer"]',
    '[class*="login"]', '[class*="signup"]',
    '[class*="register"]', '[class*="auth-"]',
    '[class*="widget"]', '[id*="widget"]',
    '[class*="banner"]', '[id*="banner"]',
    'button', 'script', 'style', 'noscript', 'iframe',
    'svg.icon', 'svg[class*="icon"]'
  ];

  // 路径 3：已知容器直接提取的内容清理（作用于容器原始 HTML，配套噪声文本模式）
  var DIRECT_CLEAN_SELECTORS = [
    '.com-author-name', '.author-name', '.author-info',
    '.head-detail', '.article-widget-head',
    '.audio-player-skeleton', '.audio-wrap', '[class*="audio"]',
    '[class*="operation-bar"]', '[class*="OperationBar"]',
    '[class*="action-bar"]', '[class*="ActionBar"]',
    '[class*="share"]', '[id*="share"]',
    '[class*="recommend"]', '[id*="recommend"]',
    '[class*="related"]', '[id*="related"]',
    '[class*="comment"]', '[id*="comment"]',
    '[class*="ad-"]', '[class*="ads-"]', '[class*="advert"]',
    '[class*="popup"]', '[class*="modal"]', '[class*="dialog"]',
    '[class*="overlay"]', '[class*="float-"]', '[class*="sticky-"]',
    '[class*="skeleton"]', '[class*="placeholder"]',
    'button', 'input[type="button"]', 'input[type="submit"]'
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
          // 图片是正文内容：微信等懒加载会给正文 <img> 加 js_img_placeholder /
          // wx_img_placeholder 之类 class，若按 [class*="placeholder"] 处理会把正文图片误删
          if (el.tagName && el.tagName.toLowerCase() === 'img') return;
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

  /**
   * 解析懒加载图片：将 data-src / data-original / data-lazy-src 指向的真实地址
   * 回填到 src。仅当 src 缺失、为空或为占位 data: URL 时才替换，避免覆盖已加载图片。
   *
   * 背景：微信文章等页面会由运行时 JS 将 src 置为 1px 透明 SVG 占位，
   * 真实地址只保留在 data-src；若不解析，导出 PDF 时图片会缺失。
   *
   * @param {Element|Document} root - 扫描根节点
   * @param {boolean} [setCors=false] - 是否对解析出的 http(s) 图片设置
   *   crossOrigin=anonymous（html2canvas 需要无污染 canvas 才能绘制跨域图）
   */
  function resolveLazyImages(root, setCors) {
    root.querySelectorAll('img').forEach(function (img) {
      var lazySrc = img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        img.getAttribute('data-lazy-src');
      if (!lazySrc) return;
      var rawSrc = img.getAttribute('src') || '';
      // 已有真实（http/data 之外的）地址时保持原样，避免破坏已加载图片
      if (rawSrc !== '' && rawSrc.indexOf('data:') !== 0) return;
      img.setAttribute('src', lazySrc);
      if (setCors && /^https?:/i.test(lazySrc)) {
        img.crossOrigin = 'anonymous';
      }
    });
  }

  window.__pdfCleaner = {
    VERSION: CLEANER_VERSION,
    READABILITY_NOISE_SELECTORS: READABILITY_NOISE_SELECTORS,
    POST_CLEAN_SELECTORS: POST_CLEAN_SELECTORS,
    DIRECT_CLEAN_SELECTORS: DIRECT_CLEAN_SELECTORS,
    NOISE_TEXT_PATTERNS: NOISE_TEXT_PATTERNS,
    linkDensity: linkDensity,
    removeNoise: removeNoise,
    cleanByLinkDensity: cleanByLinkDensity,
    removeEmpty: removeEmpty,
    removeNoiseText: removeNoiseText,
    resolveLazyImages: resolveLazyImages
  };
})();
