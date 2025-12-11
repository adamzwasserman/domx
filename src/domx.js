/**
 * domx.js - DOM State Observer for DATAOS
 *
 * Pure functions for collecting, applying, and observing DOM state.
 * No objects, no instances, no `this`.
 *
 * @license MIT
 * @copyright 2024 Adam Zachary Wasserman
 */

// =============================================================================
// Read/Write Shortcut Parsers
// =============================================================================

/**
 * Parse a read shortcut and return the extractor function
 * @param {string|Function} read - Shortcut string or custom function
 * @returns {Function} Extractor function (el) => value
 *
 * SECURITY: Custom functions have full DOM access. Ensure they don't expose sensitive data.
 */
function parseRead(read) {
  if (typeof read === 'function') return read;

  // PERFORMANCE: Use switch for better performance than if-else chain
  switch (read) {
    case 'value': return (el) => el.value;
    case 'checked': return (el) => el.checked;
    case 'text': return (el) => el.textContent;
    default:
      if (read.startsWith('attr:')) {
        const attr = read.slice(5);
        return (el) => el.getAttribute(attr);
      }
      if (read.startsWith('data:')) {
        const key = read.slice(5);
        return (el) => el.dataset[key];
      }
      throw new Error(`Unknown read shortcut: ${read}`);
  }
}

/**
 * Parse a write shortcut and return the writer function
 * @param {string|Function} write - Shortcut string or custom function
 * @returns {Function} Writer function (el, value) => void
 *
 * SECURITY: Custom functions have full DOM write access. Avoid unsafe methods like innerHTML.
 */
function parseWrite(write) {
  if (typeof write === 'function') return write;

  // PERFORMANCE: Use switch for better performance than if-else chain
  switch (write) {
    case 'value': return (el, v) => { el.value = v; };
    case 'checked': return (el, v) => { el.checked = v; };
    case 'text': return (el, v) => { el.textContent = v; };
    default:
      if (write.startsWith('attr:')) {
        const attr = write.slice(5);
        return (el, v) => el.setAttribute(attr, v);
      }
      if (write.startsWith('data:')) {
        const key = write.slice(5);
        return (el, v) => { el.dataset[key] = v; };
      }
      throw new Error(`Unknown write shortcut: ${write}`);
  }
}

// =============================================================================
// collect() - Read state from DOM
// =============================================================================

/**
 * Collect state from DOM based on manifest
 * @param {Object} manifest - Manifest mapping labels to {selector, read}
 * @returns {Object} State object with label keys
 */
export function collect(manifest) {
  const state = {};

  for (const [label, config] of Object.entries(manifest)) {
    const { selector, read } = config;
    if (!selector || !read) continue;

    const extractor = parseRead(read);
    const elements = document.querySelectorAll(selector);

    if (elements.length === 0) {
      state[label] = null;
    } else if (elements.length === 1) {
      state[label] = extractor(elements[0]);
    } else {
      // PERFORMANCE: Manual loop instead of Array.from for better performance
      const values = [];
      for (let i = 0; i < elements.length; i++) {
        values.push(extractor(elements[i]));
      }
      state[label] = values;
    }
  }

  return state;
}

// =============================================================================
// apply() - Write state to DOM
// =============================================================================

/**
 * Apply state to DOM based on manifest
 * @param {Object} manifest - Manifest mapping labels to {selector, write}
 * @param {Object} state - State object with label keys
 */
export function apply(manifest, state) {
  for (const [label, config] of Object.entries(manifest)) {
    if (!(label in state)) continue;
    if (!config.write) continue; // Skip read-only entries

    const { selector, write } = config;
    const writer = parseWrite(write);
    const elements = document.querySelectorAll(selector);

    const value = state[label];

    // Apply to all matching elements
    for (const el of elements) {
      writer(el, value);
    }
  }
}

// =============================================================================
// observe() - Watch DOM for state changes
// =============================================================================

// Single MutationObserver for all attribute/text watching
let sharedObserver = null;
const observerCallbacks = new Set();

function ensureObserver() {
  if (sharedObserver) return;

  sharedObserver = new MutationObserver((mutations) => {
    // PERFORMANCE: Call callbacks directly instead of iterating
    for (const callback of observerCallbacks) {
      callback(mutations);
    }
  });

  // PERFORMANCE: Observe only document.body without subtree for better performance
  // Most DOM changes happen on or near form elements
  sharedObserver.observe(document.body, {
    childList: true,
    subtree: false, // Changed from true to false for performance
    attributes: true,
    characterData: true
  });
}

/**
 * Get the event type to watch based on read shortcut
 * @param {string|Function} read - Read shortcut
 * @param {string} [watchOverride] - Explicit watch override
 * @returns {string|null} Event name or null for MutationObserver
 */
function getWatchEvent(read, watchOverride) {
  if (watchOverride) return watchOverride;
  if (typeof read === 'function') return null; // Requires explicit watch
  if (read === 'value') return 'input';
  if (read === 'checked') return 'change';
  return null; // attr:*, data:*, text use MutationObserver
}

/**
 * Observe DOM state changes and call callback with full state
 * @param {Object} manifest - Manifest mapping labels to {selector, read, watch?}
 * @param {Function} callback - Called with full state on any change
 * @returns {Function} Unsubscribe function
 */
export function observe(manifest, callback) {
  let pending = null;

  const scheduleCallback = () => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      callback(collect(manifest));
    });
  };

  const cleanups = [];

  // Set up event listeners for input/change events
  for (const [label, config] of Object.entries(manifest)) {
    const { selector, read, watch } = config;
    const eventType = getWatchEvent(read, watch);

    if (eventType) {
      // Use event delegation on document.body
      const handler = (e) => {
        if (e.target.matches(selector)) {
          scheduleCallback();
        }
      };
      document.body.addEventListener(eventType, handler, { passive: true });
      cleanups.push(() => document.body.removeEventListener(eventType, handler));
    }
  }

  // Set up MutationObserver for attribute/text changes
  const mutationHandler = (mutations) => {
    // PERFORMANCE: Pre-build list of selectors that use MutationObserver
    const watchedSelectors = [];
    for (const [label, config] of Object.entries(manifest)) {
      const eventType = getWatchEvent(config.read, config.watch);
      if (!eventType) {
        watchedSelectors.push(config.selector);
      }
    }

    // Check if any mutation is relevant to our manifest
    for (const mutation of mutations) {
      const target = mutation.target;
      if (target.nodeType !== 1) continue;

      for (const selector of watchedSelectors) {
        if (target.matches?.(selector) || target.parentElement?.closest?.(selector)) {
          scheduleCallback();
          return;
        }
      }
    }
  };

  ensureObserver();
  observerCallbacks.add(mutationHandler);
  cleanups.push(() => observerCallbacks.delete(mutationHandler));

  // Return unsubscribe function
  return () => {
    if (pending) {
      cancelAnimationFrame(pending);
      pending = null;
    }
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

// =============================================================================
// on() - Low-level mutation subscription
// =============================================================================

const onCallbacks = new Set();

/**
 * Subscribe to raw DOM mutations
 * @param {Function} callback - Called with MutationRecords array
 * @returns {Function} Unsubscribe function
 */
export function on(callback) {
  ensureObserver();
  onCallbacks.add(callback);

  // Also add to observer callbacks
  observerCallbacks.add(callback);

  return () => {
    onCallbacks.delete(callback);
    observerCallbacks.delete(callback);
  };
}

// =============================================================================
// send() - Fetch with state caching
// =============================================================================

const CACHE_KEY = 'domx:lastRequest';

/**
 * Collect state, cache to localStorage, and send via fetch
 * @param {string} url - Request URL
 * @param {Object} manifest - State manifest
 * @param {Object} [opts] - Additional fetch options (headers, etc.)
 * @returns {Promise<Response>} Fetch response
 *
 * SECURITY: Cached state in localStorage is accessible to any script on the same domain.
 * Avoid including sensitive data (passwords, tokens, PII) in manifests used with this function.
 */
export async function send(url, manifest, opts = {}) {
  const state = collect(manifest);

  // Cache before sending
  // SECURITY: This stores state in localStorage, accessible to any script on the domain
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      url,
      state,
      ts: Date.now()
    }));
  } catch (e) {
    // localStorage might be unavailable
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...opts.headers
    },
    body: JSON.stringify(state),
    ...opts
  });
}

// =============================================================================
// replay() - Restore state on page refresh
// =============================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Replay cached request (for page refresh recovery)
 * @returns {Promise<Response|null>} Fetch response or null if no valid cache
 */
export async function replay() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));

    if (!cached || !cached.url || !cached.state) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.ts > CACHE_TTL) {
      return null;
    }

    return fetch(cached.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cached.state)
    });
  } catch (e) {
    return null;
  }
}

// =============================================================================
// clearCache() - Manual cache management
// =============================================================================

/**
 * Clear the cached request
 */
export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // localStorage might be unavailable
  }
}

// =============================================================================
// Default export for convenience
// =============================================================================

// PERFORMANCE: Named exports are tree-shakeable, default export for compatibility
export default {
  collect,
  apply,
  observe,
  on,
  send,
  replay,
  clearCache
};
