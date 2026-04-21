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
      // A simple way is to replace 'async function generatePDF' with 'global.generatePDF = async function'
      const modifiedJs = contentJs.replace('async function generatePDF', 'global.generatePDF = async function');
      eval(modifiedJs);
    } catch (e) {
      console.error('Error evaling content.js:', e);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
