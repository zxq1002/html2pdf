const util = require('util');
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = util.TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = util.TextDecoder;
}

// Polyfill setImmediate for JSDOM/Node.js
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock FileReader for Node.js/JSDOM if needed
global.FileReader = class FileReader {
  readAsDataURL(blob) {
    // Check if it's a blob-like object
    if (!blob || (typeof blob.size !== 'number')) {
        throw new TypeError("Failed to execute 'readAsDataURL' on 'FileReader': parameter 1 is not of type 'Blob'.");
    }
    this.result = 'data:application/pdf;base64,mocked';
    setTimeout(() => {
        if (this.onload) this.onload();
    }, 0);
  }
};

describe('Style Injection and Filename Optimization', () => {
  let window;
  let document;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
      url: 'https://example.com/article',
      runScripts: "dangerously"
    });
    window = dom.window;
    document = window.document;

    // Use JSDOM's Blob
    global.Blob = window.Blob;

    // Mock chrome
    window.chrome = {
      runtime: {
        onMessage: { addListener: jest.fn() },
        getURL: jest.fn(s => s)
      }
    };

    // Mock html2pdf
    window.html2pdf = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      output: jest.fn().mockResolvedValue(new window.Blob(['mock pdf data'], { type: 'application/pdf' }))
    });

    // Mock extractor
    window.extract = jest.fn().mockReturnValue({
      title: 'Extracted Title',
      content: '<p>Article content</p>',
      byline: 'Author Name'
    });

    // 先加载共享清理模块（content.js 依赖 window.__pdfCleaner）
    const cleanerJs = fs.readFileSync(path.resolve(__dirname, '../src/cleaner.js'), 'utf8');
    window.eval(cleanerJs);

    // Load content.js logic
    // We'll read the file and wrap it to make functions accessible if needed, 
    // or just rely on them being defined on window in the JSDOM context.
    const contentJs = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
    
    // To make functions accessible, we might need to remove the if/else wrapper 
    // or manually expose them. For testing, let's just eval it in the window context.
    // Note: In JSDOM, script execution with eval works.
    try {
      window.eval(contentJs);
    } catch (e) {
      console.error('Error evaling content.js:', e);
    }
  });

  test('extractReadableContent should return element and extractedTitle', async () => {
    // This test will fail initially because extractReadableContent currently only returns element
    const result = await window.extractReadableContent();
    
    expect(result).toHaveProperty('element');
    expect(result).toHaveProperty('extractedTitle', 'Extracted Title');
    expect(result.element.className).toBe('pdf-readable-content');
  });

  test('generatePDF should apply fontSize to htmlContent', async () => {
    const element = document.createElement('div');
    element.innerHTML = '<h1>Title</h1><p>Content</p>';
    
    const options = {
      pageTitle: 'Original Title',
      pageUrl: 'https://example.com',
      fontSize: '20px',
      margin: 'normal'
    };

    // We need to mock document.body.appendChild to capture the iframe
    const appendSpy = jest.spyOn(document.body, 'appendChild');
    
    // We also need to mock fetch because generatePDF calls it for images
    window.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob([''], {type: 'image/png'})) });

    // Mock loadLibraries to do nothing
    window.loadLibraries = jest.fn().mockResolvedValue();

    await window.generatePDF(element, options);

    // Find the iframe added to body
    const iframe = appendSpy.mock.calls.find(call => call[0].tagName === 'IFRAME')[0];
    const htmlContent = iframe.contentDocument.documentElement.innerHTML;

    // Check if fontSize is injected in style
    expect(htmlContent).toContain('font-size: 20px');
  });

  test('generatePDF should map margin parameters to html2pdf options', async () => {
    const element = document.createElement('div');
    const options = {
      pageTitle: 'Title',
      fontSize: '16px',
      margin: 'narrow' // narrow should map to [5, 5, 5, 5] per D-05 or similar
    };

    window.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob([''], {type: 'image/png'})) });
    window.loadLibraries = jest.fn().mockResolvedValue();

    await window.generatePDF(element, options);

    const html2pdfInstance = window.html2pdf.mock.results[0].value;
    const setCall = html2pdfInstance.set.mock.calls[0][0];

    // Verify margin is set correctly for 'narrow'
    // D-05: default [15, 15, 15, 15], narrow [5, 5, 5, 5], wide [30, 30, 30, 30]
    expect(setCall.margin).toEqual([5, 5, 5, 5]);
  });

  test('generatePDF should use extractedTitle for filename if available', async () => {
    const element = {
        innerHTML: '<div>Content</div>'
    };
    const options = {
      pageTitle: 'Original Page Title',
      extractedTitle: 'Optimized Article Title',
      fontSize: '16px',
      margin: 'normal'
    };

    window.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob([''], {type: 'image/png'})) });
    window.loadLibraries = jest.fn().mockResolvedValue();

    const result = await window.generatePDF(element, options);

    expect(result.filename).toBe('Optimized Article Title.pdf');
  });
});
