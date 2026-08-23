/**
 * @jest-environment jsdom
 *
 * src/cleaner.js 统一清理模块单元测试
 */
const fs = require('fs');
const path = require('path');

describe('cleaner 统一清理模块', () => {
  let cleaner;

  beforeAll(() => {
    const js = fs.readFileSync(path.resolve(__dirname, '../src/cleaner.js'), 'utf8');
    eval(js);
    cleaner = window.__pdfCleaner;
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('模块应正确暴露 API', () => {
    expect(cleaner).toBeDefined();
    expect(Array.isArray(cleaner.READABILITY_NOISE_SELECTORS)).toBe(true);
    expect(Array.isArray(cleaner.POST_CLEAN_SELECTORS)).toBe(true);
    expect(Array.isArray(cleaner.DIRECT_CLEAN_SELECTORS)).toBe(true);
    expect(cleaner.READABILITY_NOISE_SELECTORS.length).toBeGreaterThan(50);
    expect(cleaner.POST_CLEAN_SELECTORS.length).toBeGreaterThan(30);
    expect(cleaner.DIRECT_CLEAN_SELECTORS.length).toBeGreaterThan(20);
    expect(typeof cleaner.removeNoise).toBe('function');
    expect(typeof cleaner.cleanByLinkDensity).toBe('function');
    expect(typeof cleaner.removeEmpty).toBe('function');
    expect(typeof cleaner.removeNoiseText).toBe('function');
  });

  test('重复加载应保持幂等', () => {
    const js = fs.readFileSync(path.resolve(__dirname, '../src/cleaner.js'), 'utf8');
    expect(() => eval(js)).not.toThrow();
    expect(window.__pdfCleaner).toBe(cleaner);
  });

  describe('resolveLazyImages', () => {
    test('应把 data-src 回填到缺失的 src', () => {
      document.body.innerHTML = '<img data-src="https://example.com/a.png">';
      cleaner.resolveLazyImages(document.body);
      expect(document.querySelector('img').getAttribute('src')).toBe('https://example.com/a.png');
    });

    test('应把 data-src 回填到占位 data: URL', () => {
      document.body.innerHTML =
        '<img src="data:image/svg+xml,placeholder" data-src="https://example.com/b.png">';
      cleaner.resolveLazyImages(document.body);
      expect(document.querySelector('img').getAttribute('src')).toBe('https://example.com/b.png');
    });

    test('不应覆盖已加载的真实 http src', () => {
      document.body.innerHTML =
        '<img src="https://example.com/real.png" data-src="https://example.com/lazy.png">';
      cleaner.resolveLazyImages(document.body);
      expect(document.querySelector('img').getAttribute('src')).toBe('https://example.com/real.png');
    });

    test('支持 data-original / data-lazy-src 别名', () => {
      document.body.innerHTML =
        '<img id="a" data-original="https://example.com/o.png">' +
        '<img id="b" src="" data-lazy-src="https://example.com/l.png">';
      cleaner.resolveLazyImages(document.body);
      expect(document.getElementById('a').getAttribute('src')).toBe('https://example.com/o.png');
      expect(document.getElementById('b').getAttribute('src')).toBe('https://example.com/l.png');
    });

    test('setCors=true 时对 http(s) 图片设置 crossOrigin', () => {
      document.body.innerHTML = '<img data-src="https://example.com/c.png">';
      cleaner.resolveLazyImages(document.body, true);
      expect(document.querySelector('img').getAttribute('crossorigin')).toBe('anonymous');
    });

    test('忽略无懒加载属性的图片', () => {
      document.body.innerHTML = '<img src="https://example.com/plain.png">';
      cleaner.resolveLazyImages(document.body);
      expect(document.querySelector('img').getAttribute('src')).toBe('https://example.com/plain.png');
    });
  });

  describe('removeNoise', () => {
    test('应移除噪声元素', () => {
      document.body.innerHTML =
        '<nav>菜单项</nav>' +
        '<div class="comments">评论1 评论2</div>' +
        '<button>点赞</button>';
      cleaner.removeNoise(document.body, cleaner.READABILITY_NOISE_SELECTORS);
      expect(document.querySelector('nav')).toBeNull();
      expect(document.querySelector('.comments')).toBeNull();
      expect(document.querySelector('button')).toBeNull();
    });

    test('长文本且链接密度低的元素应保留', () => {
      const longText = '这是一段足够长的正文内容。'.repeat(30); // > 200 字符
      document.body.innerHTML =
        '<div class="related">正文' + longText + '<a href="#">链接</a></div>' +
        '<div class="related">短噪声 <a href="#">链接</a></div>';
      cleaner.removeNoise(document.body, cleaner.READABILITY_NOISE_SELECTORS);
      const kept = document.querySelectorAll('.related');
      expect(kept.length).toBe(1);
      expect(kept[0].textContent.length).toBeGreaterThan(200);
    });

    test('保留阈值应可配置', () => {
      const text = '中等长度文本'.repeat(10); // 60 字符
      document.body.innerHTML = '<div class="ad">' + text + '</div>';
      // 默认 keepTextLen=200，会被移除
      cleaner.removeNoise(document.body, cleaner.READABILITY_NOISE_SELECTORS);
      expect(document.querySelector('.ad')).toBeNull();

      document.body.innerHTML = '<div class="ad">' + text + '</div>';
      cleaner.removeNoise(document.body, cleaner.READABILITY_NOISE_SELECTORS, { keepTextLen: 50 });
      expect(document.querySelector('.ad')).not.toBeNull();
    });

    test('不应移除正文图片（微信懒加载 class 含 placeholder）', () => {
      document.body.innerHTML =
        '<img class="rich_pages wxw-img js_insertlocalimg js_img_placeholder wx_img_placeholder" data-src="https://mmbiz.qpic.cn/a.png">' +
        '<div class="loading-placeholder">占位容器</div>';
      cleaner.removeNoise(document.body, cleaner.DIRECT_CLEAN_SELECTORS);
      // 正文图片必须保留
      expect(document.querySelector('img')).not.toBeNull();
      // 占位容器仍应被移除
      expect(document.querySelector('.loading-placeholder')).toBeNull();
    });

    test('各路径应使用各自的选择器预设（禁止并集）', () => {
      // [class*="audio"] 仅属于直接提取路径，不应出现在 Readability 预清理路径
      expect(cleaner.READABILITY_NOISE_SELECTORS).not.toContain('[class*="audio"]');
      expect(cleaner.DIRECT_CLEAN_SELECTORS).toContain('[class*="audio"]');
      // Readability 路径的正文元素若含 audio 类名，预清理不应命中
      const longText = '这是一段足够长的正文内容。'.repeat(30);
      document.body.innerHTML =
        '<div class="audio-caption">' + longText + '</div>';
      cleaner.removeNoise(document.body, cleaner.READABILITY_NOISE_SELECTORS);
      expect(document.querySelector('.audio-caption')).not.toBeNull();
    });
  });

  describe('cleanByLinkDensity', () => {
    test('应移除链接密集块', () => {
      let links = '';
      for (let i = 0; i < 12; i++) links += '<a href="#">推荐文章' + i + '</a> ';
      document.body.innerHTML =
        '<div id="navlike">' + links + '</div>' +
        '<div id="content">' + '这是正常的长段落正文，没有链接。'.repeat(20) + '</div>';
      cleaner.cleanByLinkDensity(document.body);
      expect(document.getElementById('navlike')).toBeNull();
      expect(document.getElementById('content')).not.toBeNull();
    });

    test('应移除文本过短的块', () => {
      document.body.innerHTML = '<div id="short">短</div>';
      cleaner.cleanByLinkDensity(document.body, { minText: 20 });
      expect(document.getElementById('short')).toBeNull();
    });

    test('不应移除根节点自身', () => {
      const root = document.createElement('div');
      root.textContent = '短';
      document.body.appendChild(root);
      cleaner.cleanByLinkDensity(root, { minText: 20 });
      expect(root.parentNode).toBe(document.body);
    });

    test('无链接的块不应被移除', () => {
      document.body.innerHTML = '<div id="plain">' + '纯文本内容。'.repeat(30) + '</div>';
      cleaner.cleanByLinkDensity(document.body);
      expect(document.getElementById('plain')).not.toBeNull();
    });
  });

  describe('removeEmpty', () => {
    test('应移除空元素，保留含内容或图片的元素', () => {
      document.body.innerHTML =
        '<div id="empty"></div>' +
        '<div id="hasimg"><img src="x.png"></div>' +
        '<div id="hastext">文本</div>' +
        '<span id="emptySpan"></span>';
      cleaner.removeEmpty(document.body, 'div, span');
      expect(document.getElementById('empty')).toBeNull();
      expect(document.getElementById('emptySpan')).toBeNull();
      expect(document.getElementById('hasimg')).not.toBeNull();
      expect(document.getElementById('hastext')).not.toBeNull();
    });
  });

  describe('removeNoiseText', () => {
    test('应按文本模式移除噪声块', () => {
      document.body.innerHTML =
        '<p id="author">作者：张三</p>' +
        '<p id="recommend">推荐阅读</p>' +
        '<p id="normal">这是正常的文章段落内容。</p>';
      cleaner.removeNoiseText(document.body, cleaner.NOISE_TEXT_PATTERNS);
      expect(document.getElementById('author')).toBeNull();
      expect(document.getElementById('recommend')).toBeNull();
      expect(document.getElementById('normal')).not.toBeNull();
    });
  });

  describe('linkDensity', () => {
    test('应正确计算链接文本占比', () => {
      document.body.innerHTML = '<div id="t"><a href="#">abcd</a>efgh</div>';
      const el = document.getElementById('t');
      expect(cleaner.linkDensity(el)).toBeCloseTo(0.5);
    });

    test('空文本应返回 0', () => {
      document.body.innerHTML = '<div id="t"><a href="#"></a></div>';
      expect(cleaner.linkDensity(document.getElementById('t'))).toBe(0);
    });
  });
});
