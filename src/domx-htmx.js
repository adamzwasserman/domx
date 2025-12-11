/**
 * domx-htmx.js - htmx Extension for domx
 *
 * Integrates domx with htmx for automatic state collection and caching.
 *
 * Usage:
 *   <body hx-ext="domx" dx-manifest="myManifest">
 *
 * Features:
 * - Auto-stuffs state into request body on htmx:configRequest
 * - Caches state to localStorage before requests (when dx-cache="true")
 * - Fires dx:change event when observed state changes
 * - Auto-replays cached request on page load (when dx-cache="true")
 *
 * @license MIT
 * @copyright 2024 Adam Zachary Wasserman
 */

import { collect, apply, observe, send, replay, clearCache } from './domx.js';

/**
 * Parse manifest from dx-manifest attribute
 * - If valid JSON, parse it
 * - Otherwise, treat as variable name and look up on window
 * @param {string} value - Attribute value
 * @returns {Object|null} Manifest object or null
 */
function parseManifest(value) {
  if (!value) return null;

  // Try JSON first
  try {
    return JSON.parse(value);
  } catch (e) {
    // Try as variable name
    if (typeof window !== 'undefined' && window[value]) {
      return window[value];
    }
  }

  return null;
}

/**
 * Find manifest from element or ancestors
 * @param {Element} el - Starting element
 * @returns {Object|null} Manifest object or null
 */
function findManifest(el) {
  let current = el;
  while (current && current !== document) {
    const attr = current.getAttribute('dx-manifest');
    if (attr) {
      return parseManifest(attr);
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Check if caching is enabled
 * @param {Element} el - Element to check
 * @returns {boolean}
 */
function isCacheEnabled(el) {
  let current = el;
  while (current && current !== document) {
    const attr = current.getAttribute('dx-cache');
    if (attr === 'true') return true;
    if (attr === 'false') return false;
    current = current.parentElement;
  }
  return false;
}

// Track active observers by manifest
const activeObservers = new Map();

/**
 * htmx extension definition
 */
const domxExtension = {
  /**
   * Called when extension is initialized
   */
  init: function(api) {
    // Auto-replay on page load if cache exists and enabled
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', () => {
        const root = document.querySelector('[dx-cache="true"]');
        if (root) {
          replay().then(response => {
            if (response) {
              // Trigger htmx to process the response if needed
              document.body.dispatchEvent(new CustomEvent('dx:replayed', {
                detail: { response }
              }));
            }
          });
        }
      });
    }
  },

  /**
   * Called for each htmx event
   */
  onEvent: function(name, evt) {
    const el = evt.detail?.elt || evt.target;

    if (name === 'htmx:configRequest') {
      // Stuff collected state into request parameters
      const manifest = findManifest(el);
      if (manifest) {
        const state = collect(manifest);

        // Merge state into request parameters
        Object.assign(evt.detail.parameters, state);

        // Cache if enabled
        if (isCacheEnabled(el)) {
          const url = evt.detail.path;
          try {
            localStorage.setItem('domx:lastRequest', JSON.stringify({
              url,
              state,
              ts: Date.now()
            }));
          } catch (e) {
            // localStorage unavailable
          }
        }
      }
    }

    if (name === 'htmx:afterSwap') {
      // Clear cache on successful swap if caching enabled
      // (The swap means we got fresh data from server)
      // Optionally: keep cache for back-button scenarios
    }

    if (name === 'htmx:beforeProcessNode') {
      // Set up observer for elements with dx-manifest
      const manifest = findManifest(el);
      if (manifest && !activeObservers.has(el)) {
        const unsubscribe = observe(manifest, (state) => {
          // Fire dx:change event
          el.dispatchEvent(new CustomEvent('dx:change', {
            bubbles: true,
            detail: { state }
          }));
        });
        activeObservers.set(el, unsubscribe);
      }
    }

    if (name === 'htmx:beforeCleanupElement') {
      // Clean up observer when element is removed
      const unsubscribe = activeObservers.get(el);
      if (unsubscribe) {
        unsubscribe();
        activeObservers.delete(el);
      }
    }
  }
};

// Register extension with htmx if available
if (typeof htmx !== 'undefined') {
  htmx.defineExtension('domx', domxExtension);
}

// Export for manual registration
export { domxExtension };

// Also export core functions for convenience
export { collect, apply, observe, send, replay, clearCache };
