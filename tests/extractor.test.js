const { extract } = require('../src/extractor');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// Mock Readability since it's used by extractor
// Alternatively, we can let extractor require the real one
// For this TDD, we want to test the integrated behavior

describe('Extractor Module', () => {
  test('should extract title and content from standard article', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <header>
            <nav>Navigation</nav>
          </header>
          <main>
            <h1>Main Title</h1>
            <p>This is the first paragraph of the article.</p>
            <p>This is the second paragraph.</p>
          </main>
          <aside>Side Content</aside>
          <footer>Footer</footer>
        </body>
      </html>
    `;
    const dom = new JSDOM(html);
    const result = extract(dom.window.document);

    expect(result.title).toBe('Main Title');
    expect(result.content).toContain('This is the first paragraph');
    expect(result.content).not.toContain('Navigation');
    expect(result.content).not.toContain('Side Content');
  });

  test('should handle pages with no clear main content', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <div>Just some random div with text.</div>
        </body>
      </html>
    `;
    const dom = new JSDOM(html);
    const result = extract(dom.window.document);

    expect(result.content).toContain('Just some random div');
  });

  test('should return null or empty for invalid input', () => {
    expect(() => extract(null)).toThrow();
  });
});
