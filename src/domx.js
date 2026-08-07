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
    default: {
      // The prefix forms need a name. "attr:" and "data:" are not readable
      // shortcuts with an empty name, they are typos, and accepting them
      // silently returns null/undefined for state that was never read.
      const name = read.slice(5);
      if (name && read.startsWith('attr:')) return (el) => el.getAttribute(name);
      if (name && read.startsWith('data:')) return (el) => el.dataset[name];
      throw new Error(`Unknown read shortcut: ${read}`);
    }
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
    default: {
      // Same bounded vocabulary as parseRead, same requirement for a name
      const name = write.slice(5);
      if (name && write.startsWith('attr:')) return (el, v) => el.setAttribute(name, v);
      if (name && write.startsWith('data:')) return (el, v) => { el.dataset[name] = v; };
      throw new Error(`Unknown write shortcut: ${write}`);
    }
  }
}

// =============================================================================
// collect() - Read state from DOM
// =============================================================================

/**
 * Collect state from DOM based on manifest
 * @param {Object} manifest - Manifest mapping labels to {selector, read}
 * @param {ParentNode} [root=document] - Element from which selectors run.
 *   Defaults to `document` for backward compatibility. Pass a section root
 *   to scope selectors instead of forcing global drilling.
 * @returns {Object} State object with label keys
 */
export function collect(manifest, root = document) {
  const state = {};

  for (const [label, config] of Object.entries(manifest)) {
    const { selector, read } = config;
    if (!selector || !read) continue;

    const extractor = parseRead(read);
    const elements = root.querySelectorAll(selector);

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
 * @param {ParentNode} [root=document] - Element from which selectors run.
 *   Defaults to `document` for backward compatibility. Pass a section root
 *   to scope writes instead of forcing global drilling.
 */
export function apply(manifest, state, root = document) {
  for (const [label, config] of Object.entries(manifest)) {
    if (!(label in state)) continue;
    if (!config.write) continue; // Skip read-only entries

    const { selector, write } = config;
    const writer = parseWrite(write);
    const elements = root.querySelectorAll(selector);

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

// What each subscriber needs delivered, keyed by its handler. The observer is
// reconfigured to the union whenever this changes, so one manifest reading one
// attribute does not make every subscriber pay for the whole document's
// attribute churn.
//
// attributes: a Set of attribute names, or null meaning "cannot be narrowed"
const observerNeeds = new Map();

// on() is a raw mutation subscription. It cannot be narrowed without lying
// about what "raw" means.
const NEEDS_EVERYTHING = { attributes: null, characterData: true };

/**
 * Union every subscriber's needs into MutationObserver options
 * @returns {Object} MutationObserver options
 */
function unionOptions() {
  const attributes = new Set();
  let allAttributes = false;
  let characterData = false;

  for (const need of observerNeeds.values()) {
    if (need.attributes === null) allAttributes = true;
    else for (const name of need.attributes) attributes.add(name);
    if (need.characterData) characterData = true;
  }

  // PERFORMANCE: subtree: true is necessary for observing deeply nested elements
  // but has performance cost. Most apps have shallow DOM structures anyway.
  const options = { childList: true, subtree: true, characterData };

  if (allAttributes) {
    options.attributes = true;
  } else if (attributes.size > 0) {
    options.attributes = true;
    options.attributeFilter = [...attributes];
  }
  // Otherwise no subscriber reads an attribute, so none are asked for. The key
  // is omitted rather than passed as attributeFilter: [], which is not reliably
  // "match nothing" across engines.

  return options;
}

function ensureObserver() {
  if (sharedObserver) return;

  sharedObserver = new MutationObserver((mutations) => {
    // PERFORMANCE: Call callbacks directly instead of iterating
    for (const callback of observerCallbacks) {
      callback(mutations);
    }
  });
}

/**
 * Point the shared observer at the current union of subscriber needs.
 * Re-observing the same target replaces its options without flushing records
 * already queued, so no mutation is lost across a reconfiguration.
 */
function syncObserver() {
  ensureObserver();

  if (observerNeeds.size === 0) {
    sharedObserver.disconnect();
    return;
  }

  sharedObserver.observe(document.body, unionOptions());
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
 * Attribute name behind a dataset key (sortDir -> data-sort-dir)
 * @param {string} key - Dataset key
 * @returns {string} Attribute name
 */
function datasetAttribute(key) {
  return 'data-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/**
 * Classify what mutation a read shortcut can be observed through.
 * Mirrors parseRead's vocabulary; returns data, not behaviour.
 *
 * @param {string|Function} read - Read shortcut
 * @returns {Object} {attribute} | {text: true} | {unknown: true}
 */
function readWatchTarget(read) {
  if (typeof read === 'function') return { unknown: true };
  if (read === 'text') return { text: true };
  if (read.startsWith('attr:')) return { attribute: read.slice(5) };
  if (read.startsWith('data:')) return { attribute: datasetAttribute(read.slice(5)) };
  return { unknown: true };
}

/**
 * Build the mutation-relevance plan for a manifest.
 *
 * Pure: manifest in, plan out. Computed once per observe() rather than once per
 * mutation batch, and it is what keeps observe() from waking on DOM churn it
 * does not care about — the wasted server roundtrip multicardz paid for.
 *
 * @param {Object} manifest - State manifest
 * @returns {Object} Plan with {selectors, text, isWatchedAttribute}
 */
function buildMutationPlan(manifest) {
  const selectors = [];
  const attributes = new Set();
  let text = false;
  let unknown = false;

  for (const config of Object.values(manifest)) {
    // Incomplete entries are skipped by collect(), so they are skipped here too
    if (!config.selector || !config.read) continue;

    // Server-owned state is persisted then refreshed by the server's own HTML.
    // Observing it makes our own swap re-trigger the send that produced it.
    if (config.serverOwned) continue;

    // Handled by an input/change listener, so it has no mutation interest.
    if (getWatchEvent(config.read, config.watch)) continue;

    selectors.push(config.selector);

    const target = readWatchTarget(config.read);
    if (target.attribute) attributes.add(target.attribute);
    if (target.text) text = true;
    if (target.unknown) unknown = true;
  }

  return {
    selectors,
    // What the shared observer must be asked for: a narrowable Set, or null
    // when a custom extractor makes narrowing impossible.
    attributes: unknown ? null : attributes,
    // A custom extractor can read anything, text included.
    text: text || unknown,
    // Cosmetic class flips — hover, selection, drag highlight, animation — are
    // the largest source of spurious wakeups, so class counts only when a
    // manifest entry reads it outright. This stays the precise gate even when
    // the observer above is widened by some other subscriber.
    isWatchedAttribute: (name) =>
      attributes.has(name) || (unknown && name !== 'class')
  };
}

const IGNORE_SELECTOR = '[dx-ignore]';

/**
 * @param {Node} node - Node to test
 * @returns {boolean} True when the node opted out of observation
 */
function isIgnoredNode(node) {
  return node.nodeType === 1 && node.matches(IGNORE_SELECTOR);
}

/**
 * @param {NodeList} nodes - Added or removed nodes
 * @returns {boolean} True when at least one node is still observed
 */
function anyObserved(nodes) {
  for (const node of nodes) {
    if (!isIgnoredNode(node)) return true;
  }
  return false;
}

/**
 * Whether a mutation is worth collecting state for, dispatched on mutation
 * type. The DOM bounds this vocabulary to exactly these three.
 */
const IS_RELEVANT = {
  attributes: (mutation, plan) => plan.isWatchedAttribute(mutation.attributeName),
  characterData: (mutation, plan) => plan.text,
  childList: (mutation) =>
    anyObserved(mutation.addedNodes) || anyObserved(mutation.removedNodes)
};

/**
 * Observe DOM state changes and call callback with full state
 * @param {Object} manifest - Manifest mapping labels to {selector, read, watch?}
 * @param {Function} callback - Called with full state on any change
 * @returns {Function} Unsubscribe function
 */
export function observe(manifest, callback) {
  // Resolve every reader up front so an invalid shortcut throws here, at the
  // call site, rather than later from inside a requestAnimationFrame callback
  // where the caller has no way to catch it
  for (const config of Object.values(manifest)) {
    if (config.selector && config.read) parseRead(config.read);
  }

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
  for (const config of Object.values(manifest)) {
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
  // PERFORMANCE: the plan is built once here, not once per mutation batch
  const plan = buildMutationPlan(manifest);

  const mutationHandler = (mutations) => {
    // Check if any mutation is relevant to our manifest
    for (const mutation of mutations) {
      // A characterData mutation targets the Text node, not its element
      const target = mutation.target;
      const el = target.nodeType === 1 ? target : target.parentElement;
      if (!el) continue;

      // Transient nodes — drag ghosts, insertion markers, feedback chrome —
      // carry no state, and the swap that answers them destroys them mid-gesture
      if (el.closest(IGNORE_SELECTOR)) continue;

      if (!IS_RELEVANT[mutation.type](mutation, plan)) continue;

      for (const selector of plan.selectors) {
        if (el.matches?.(selector) || el.parentElement?.closest?.(selector)) {
          scheduleCallback();
          return;
        }
      }
    }
  };

  observerNeeds.set(mutationHandler, {
    attributes: plan.attributes,
    characterData: plan.text
  });
  observerCallbacks.add(mutationHandler);
  syncObserver();

  cleanups.push(() => {
    observerCallbacks.delete(mutationHandler);
    observerNeeds.delete(mutationHandler);
    syncObserver();
  });

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
  onCallbacks.add(callback);

  // Also add to observer callbacks
  observerCallbacks.add(callback);

  // A raw subscriber widens the shared observer to everything, for as long as
  // it is subscribed
  observerNeeds.set(callback, NEEDS_EVERYTHING);
  syncObserver();

  return () => {
    onCallbacks.delete(callback);
    observerCallbacks.delete(callback);
    observerNeeds.delete(callback);
    syncObserver();
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
  } catch {
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
  } catch {
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
  } catch {
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
