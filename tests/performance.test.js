/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Mock chrome API
global.chrome = {
  runtime: {
    getURL: jest.fn(url => url),
    sendMessage: jest.fn().mockReturnValue(Promise.resolve()),
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Mock html2pdf
const html2pdfMock = {
  set: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  toPdf: jest.fn().mockReturnThis(),
  get: jest.fn().mockReturnThis(),
  save: jest.fn().mockReturnThis(),
  output: jest.fn().mockResolvedValue(new Blob(['test'], { type: 'application/pdf' }))
};
global.html2pdf = jest.fn(() => html2pdfMock);

describe('Performance/Compression Configuration', () => {
  let contentJs;

  beforeAll(() => {
    // Read content.js
    contentJs = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
    
    // Polyfill window properties
    window.scrollTo = jest.fn();
    
    // Mock blobToDataURL to be synchronous for testing ease
    global.blobToDataURL = jest.fn().mockResolvedValue('data:application/pdf;base64,dGVzdA==');
    
    // Inject content.js logic
    try {
      // We need to bypass the injected check
      window.__pdfExporterInjected = false;
      
      // Manually expose functions we need to test
      const modifiedJs = contentJs
        .replace('async function generatePDF', 'global.generatePDF = async function')
        .replace('function cloneDocumentForExport', 'global.cloneDocumentForExport = function');
      eval(modifiedJs);
    } catch (e) {
      console.error('Error evaling content.js:', e);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cloneDocumentForExport should remove hidden elements', async () => {
    document.body.innerHTML = `
      <div id="visible">Visible</div>
      <div id="hidden" style="display: none;">Hidden</div>
      <div id="invisible" style="visibility: hidden;">Invisible</div>
      <script>console.log("script");</script>
    `;

    if (typeof global.cloneDocumentForExport === 'function') {
      const config = { includeImages: true };
      const container = await global.cloneDocumentForExport(config);
      
      expect(container.querySelector('#visible')).not.toBeNull();
      expect(container.querySelector('#hidden')).toBeNull();
      expect(container.querySelector('#invisible')).toBeNull();
      expect(container.querySelector('script')).toBeNull();
    } else {
      throw new Error('cloneDocumentForExport is not defined');
    }
  });

  test('generatePDF should reduce scale for long pages', async () => {
    const mockElement = document.createElement('div');
    
    // Mock document.createElement to intercept iframe creation
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn(function(tag) {
      const el = originalCreateElement.call(document, tag);
      if (tag === 'iframe') {
        // Mock properties for the iframe
        Object.defineProperty(el, 'contentDocument', {
          get: () => ({
            open: jest.fn(),
            write: jest.fn(),
            close: jest.fn(),
            body: { 
              scrollHeight: 12000,
              innerHTML: '<div>test</div>'
            },
            querySelectorAll: jest.fn().mockReturnValue([])
          })
        });
      }
      return el;
    }).bind(document);

    const options = {
      pageTitle: 'Long Page',
      scale: 2
    };

    global.loadLibraries = jest.fn().mockResolvedValue();

    if (typeof global.generatePDF === 'function') {
      await global.generatePDF(mockElement, options);
      
      const callArgs = html2pdfMock.set.mock.calls[0][0];
      expect(callArgs.html2canvas.scale).toBe(1.0); // Reduced from 2 due to > 10000px
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining("超长网页")
      }));
    }
    
    // Restore
    document.createElement = originalCreateElement;
  });

  test('generatePDF should pass correct quality and compression options to html2pdf', async () => {
    const mockElement = document.createElement('div');
    mockElement.innerHTML = '<p>Test content</p>';
    
    const options = {
      pageTitle: 'Test Page',
      quality: 0.5,
      scale: 1,
      fontSize: 16,
      margin: 10
    };

    // We need to mock loadLibraries to not actually try to load scripts
    global.loadLibraries = jest.fn().mockResolvedValue();

    // Call generatePDF
    if (typeof global.generatePDF === 'function') {
      await global.generatePDF(mockElement, options);

      // Verify html2pdf was called with correct options
      expect(global.html2pdf).toHaveBeenCalled();
      const callArgs = html2pdfMock.set.mock.calls[0][0];
      
      expect(callArgs.image.quality).toBe(0.5);
      expect(callArgs.jsPDF.compress).toBe(true);
    } else {
      throw new Error('generatePDF is not defined after eval');
    }
  });

  test('generatePDF should use default quality if not provided', async () => {
    const mockElement = document.createElement('div');
    const options = {
      pageTitle: 'Test Page'
    };
    
    global.loadLibraries = jest.fn().mockResolvedValue();
    
    if (typeof global.generatePDF === 'function') {
      await global.generatePDF(mockElement, options);
      
      const callArgs = html2pdfMock.set.mock.calls[0][0];
      expect(callArgs.image.quality).toBe(0.95); // Our new default
      expect(callArgs.jsPDF.compress).toBe(true);
    } else {
      throw new Error('generatePDF is not defined after eval');
    }
  });
});
