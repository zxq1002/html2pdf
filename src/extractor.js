/**
 * Content Extraction Module
 * Wraps Readability.js to provide a clean interface for extracting main content from DOM.
 */

// 防止重复注入导致的 SyntaxError (Identifier already declared)
if (typeof window !== 'undefined' && window.__extractorInjected) {
  // 已经注入，确保 window.extract 仍然存在
  console.log("[PDF Exporter] Extractor already injected.");
} else {
  if (typeof window !== 'undefined') window.__extractorInjected = true;

  // 使用 var 而不是 let/const，以防在某些极端情况下重复声明
  var Readability;

  // Handle both Node.js (for testing) and Browser environments
  if (typeof require !== 'undefined') {
    try {
      Readability = require('../lib/Readability');
    } catch (e) {
      // Node.js 环境下的容错
    }
  }

  // In browser, Readability will be available globally if loaded via script tag
  if (typeof window !== 'undefined') {
    if (window.Readability) {
      Readability = window.Readability;
    }
  } else if (typeof global !== 'undefined' && global.Readability) {
    Readability = global.Readability;
  }

  /**
   * Extracts content from a Document object.
   * @param {Document} doc - The DOM document to extract from.
   * @returns {Object} - The extracted content {title, content, excerpt, byline}.
   */
  var extract = function(doc) {
    if (!doc) {
      throw new Error('Document object is required');
    }

    // Ensure Readability is available
    var R = Readability || (typeof window !== 'undefined' ? window.Readability : null);
    
    if (!R) {
      console.error('Readability library not found');
      return {
        title: doc.title,
        content: doc.body ? doc.body.innerHTML : '',
        excerpt: '',
        byline: ''
      };
    }

    try {
      var reader = new R(doc);
      var article = reader.parse();

      if (!article) {
        return {
          title: doc.title,
          content: doc.body ? doc.body.innerHTML : '',
          excerpt: '',
          byline: ''
        };
      }

      return {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        byline: article.byline
      };
    } catch (e) {
      console.error('Error during extraction:', e);
      return {
        title: doc.title,
        content: doc.body ? doc.body.innerHTML : '',
        excerpt: '',
        byline: ''
      };
    }
  };

  // Explicitly expose to window for content script usage
  if (typeof window !== 'undefined') {
    window.extract = extract;
  }

  if (typeof module !== 'undefined') {
    module.exports = { extract: extract };
  }
}
