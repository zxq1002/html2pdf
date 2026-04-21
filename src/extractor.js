/**
 * Content Extraction Module
 * Wraps Readability.js to provide a clean interface for extracting main content from DOM.
 */

// Handle both Node.js (for testing) and Browser environments
let Readability;
if (typeof require !== 'undefined') {
  try {
    Readability = require('../lib/Readability');
  } catch (e) {
    // If we're in a environment where require is available but lib/Readability is not at that relative path
    // (e.g. some build tools), we might need to handle it differently.
    // In our project structure, this works for Jest.
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
function extract(doc) {
  if (!doc) {
    throw new Error('Document object is required');
  }

  // Ensure Readability is available
  const R = Readability || (typeof window !== 'undefined' ? window.Readability : null);
  
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
    const reader = new R(doc);
    const article = reader.parse();

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
}

// Explicitly expose to window for content script usage
if (typeof window !== 'undefined') {
  window.extract = extract;
}

if (typeof module !== 'undefined') {
  module.exports = { extract };
}
