# domx

DOM state observer for [DATAOS](https://dataos.software) — collect, apply, observe, and persist DOM state.

**~2.2KB** minified + gzipped (1.9KB brotli). Zero dependencies.

## What is domx?

domx implements the DATAOS principle: **DOM as the single source of truth**.

Instead of syncing JavaScript state with DOM state (and inevitably getting them out of sync), domx reads state directly from the DOM when needed. No Redux. No MobX. No useState. Just the DOM.

## Security Considerations

⚠️ **Important Security Notes**

- **Avoid storing sensitive data**: State cached to localStorage is accessible to any script on the same domain. Do not include passwords, tokens, or other sensitive information in manifests used with `send()` or HTMX caching.
- **Use static manifests**: Define manifests in code, not dynamically from user input, to prevent selector injection attacks.
- **Safe custom functions**: When using custom `read`/`write` functions, avoid unsafe DOM methods like `innerHTML`. Stick to the provided shortcuts for security.
- **Server-controlled attributes**: Ensure `dx-manifest` attributes are rendered server-side, not set by user input, to prevent code injection.

```js
// Define what state lives where in the DOM
const manifest = {
  searchQuery: { selector: '#search', read: 'value' },
  sortDir: { selector: '[data-sort]', read: 'attr:data-sort-dir' },
  filters: { selector: '.filter.active', read: 'data:filter' }
};

// Collect state from DOM
const state = domx.collect(manifest);
// → { searchQuery: "hello", sortDir: "asc", filters: ["status", "priority"] }

// Send to server
const response = await domx.send('/api/search', manifest);
```

## Installation

```bash
npm install domx
```

Or via CDN:

```html
<script src="https://unpkg.com/domx"></script>
```

## Quick Start

### 1. Define a manifest

The manifest maps state labels to DOM selectors and read/write methods:

```js
const manifest = {
  username: { selector: '#username', read: 'value', write: 'value' },
  rememberMe: { selector: '#remember', read: 'checked', write: 'checked' },
  theme: { selector: '[data-theme]', read: 'data:theme', write: 'data:theme' }
};
```

### 2. Collect state

```js
const state = domx.collect(manifest);
// → { username: "alice", rememberMe: true, theme: "dark" }
```

### 3. Apply state

```js
domx.apply(manifest, { username: "bob", theme: "light" });
// DOM is updated
```

### 4. Observe changes

```js
const unsubscribe = domx.observe(manifest, (state) => {
  console.log('State changed:', state);
});

// Later: stop observing
unsubscribe();
```

## API Reference

### `collect(manifest)`

Reads current DOM state based on manifest. Returns object with labels as keys.

```js
const state = domx.collect(manifest);
```

### `apply(manifest, state)`

Writes state values to DOM. Only processes entries with `write` key.

```js
domx.apply(manifest, { username: "alice" });
```

### `observe(manifest, callback)`

Watches DOM for changes and calls callback with full state. Auto-detects watch mechanism from `read` type, and narrows what it wakes for to the attributes and text the manifest actually reads — see [Keeping observe() quiet](#keeping-observe-quiet). Returns unsubscribe function.

```js
const unsubscribe = domx.observe(manifest, (state) => {
  // Called on any relevant DOM change
});
```

⚠️ Before observing state your server re-renders, read [The wipe race](#the-wipe-race-read-this-before-you-observe-server-owned-state).

### `on(callback)`

Low-level subscription to raw MutationRecords. For framework integration (e.g., genX modules).

```js
const unsubscribe = domx.on((mutations) => {
  // Process raw mutations
});
```

### `send(url, manifest, opts?)`

Collects state, caches to localStorage, and sends via fetch.

⚠️ **Security Warning**: Cached state in localStorage is accessible to any script on the same domain. Avoid including sensitive data in manifests used with this function.

```js
const response = await domx.send('/api/save', manifest, {
  headers: { 'X-Custom': 'value' }
});
```

### `replay()`

Re-sends cached request (for page refresh recovery). Returns null if no valid cache.

```js
// On page load
const response = await domx.replay();
if (response?.ok) {
  const html = await response.text();
  container.innerHTML = html;
}
```

### `clearCache()`

Clears the cached request.

```js
domx.clearCache();
```

## The wipe race (read this before you observe server-owned state)

domx's core loop is observe → `send()` → server returns HTML → swap it in. That loop has one failure mode, and it is the sharpest edge in the library:

**If the HTML the server sends back does not preserve exactly what you mutated, the swap wipes your own mutation.**

multicardz hit this in production. Dragging a tag onto a card added a chip to the card's DOM; the chip was observed; the observation fired a request; the server rendered the card from its own stored state, which did not have the tag yet; the swap replaced the card and the chip vanished. The symptom the user sees is a flicker — the thing you just did appears and then disappears.

The race is not a bug in the swap or in the observer. It is what happens when one piece of DOM has two owners.

### The rule

**Only observe state the server round-trips faithfully.** A manifest entry is a promise that the server will hand this value back unchanged. In multicardz the manifest is literally the inputs to the render payload — filters, sort direction, search text — all state the server reads and returns.

State the server *owns* — the rendered result, not the query that produced it — is handled the other way round: persist it, then let the server refresh it.

```js
// The query. The server round-trips it faithfully, so observing it is safe.
const manifest = {
  searchQuery: { selector: '#search', read: 'value' },
  sortDir: { selector: '[data-sort]', read: 'attr:data-sort-dir' },

  // The result. The server owns and re-renders this, so observing its own
  // mutations would make the swap re-trigger the request that caused it.
  chips: { selector: '#chips', read: 'attr:data-chips', serverOwned: true }
};
```

`serverOwned: true` means: **this element's own mutations do not fire `observe()`.** User input to it still does — typing in a `serverOwned` input fires normally. It is only the element mutating under you, which is what a swap looks like, that stays silent.

`collect()` still reads `serverOwned` entries. The flag changes what *wakes* the observer, never what counts as state.

### The escape hatch: persist, then refresh

When the user acts on server-owned state, do not let the observer carry it. Send the change explicitly, and let the response be the refresh:

```js
// Explicit handler — not an observation
async function addTag(cardId, tag) {
  const response = await fetch(`/cards/${cardId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tag })
  });
  // The server now has the tag, so what it renders includes it.
  document.querySelector(`#card-${cardId}`).outerHTML = await response.text();
}
```

Persist first, refresh second. The swap can no longer wipe the mutation, because by the time the server renders, the mutation is part of what it is rendering.

## Swaps destroy what is bound to them

Every OOB swap replaces nodes, and anything bound to a replaced node goes with it. An `observe()` whose manifest selectors resolve to swapped-away elements does not error — it silently stops working.

domx's shared MutationObserver is bound to `document.body`, which survives swaps, and manifest selectors are re-resolved on every `collect()`. So `observe()` keeps working across swaps **as long as the selectors still match something**. What breaks is narrower and worth naming:

- **A manifest scoped to a swapped root.** `collect(manifest, sectionEl)` holds a reference to `sectionEl`. Once that element is swapped away, the reference points at a detached node and every read returns `null`. Re-scope after the swap, or scope to an ancestor the swap does not replace.
- **The htmx extension's `dx:change` listeners.** `domx-htmx.js` sets up an observer per *processed node* that resolves a manifest (on `htmx:beforeProcessNode`), and fires `dx:change` on that node. When the node is swapped, `htmx:beforeCleanupElement` tears its observer down, and any `hx-trigger="dx:change"` bound to it stops firing until htmx processes the replacement. Bind `hx-trigger="dx:change"` to an element outside the swap target, not inside it.

The general fix is the one multicardz uses: **bind to a stable ancestor and let the subtree churn beneath you**, rather than binding to the nodes that get replaced.

```html
<!-- Stable: body is never swapped, so the manifest binding survives -->
<body hx-ext="domx" dx-manifest="manifest">
  <div id="results">
    <!-- swapped freely; observe() re-resolves selectors on every collect -->
  </div>
</body>
```

## Keeping observe() quiet

`observe()` narrows what it wakes for, from the manifest itself. You do not configure this; it is derived:

- **Attributes** — only the attributes some entry actually reads. A manifest reading `attr:data-sort-dir` does not wake on `aria-busy`.
- **`class`** — ignored, always, unless an entry reads it outright (`read: 'attr:class'`). Class flips are hover, selection, drag highlight, animation — cosmetic churn that costs a server roundtrip and whose response swap can wipe the class that caused it.
- **Text** — `characterData` is only watched when some entry reads `text`.
- **Custom `read` functions** — a function can read anything, so domx cannot narrow for it and watches broadly. Everything except `class` still applies.

This narrowing is applied twice, at two different costs. The single shared `MutationObserver` is configured with the **union** of every live subscriber's needs, so an attribute nobody reads is never delivered to domx at all — the cheapest possible filter, because the browser does it. Each `observe()` then applies its own manifest's rules to what does arrive, so one subscriber's broad manifest never leaks mutations into another's callback.

The union is recomputed on every subscribe and unsubscribe, and the observer disconnects entirely once the last subscriber leaves.

`on()` is the exception. It is documented as a *raw* mutation subscription, so a live `on()` subscriber widens the shared observer to every attribute for as long as it is subscribed — raw has to mean raw. `observe()` callbacks are unaffected: they keep filtering precisely, they just have more to filter.

### `dx-ignore` — transient nodes opt out

HTMX and DATAOS apps constantly insert ephemeral feedback: drag ghosts, insertion markers, spinners, toasts. They carry no state, they should not cost a roundtrip, and the swap that answers one destroys the feedback mid-gesture.

Mark them and `observe()` skips them:

```html
<div id="drop-zone">
  <div class="drag-ghost" dx-ignore>Dragging…</div>
</div>
```

The opt-out covers the marked node, its subtree, and its insertion and removal. An unmarked node inserted into the same container still fires normally — `dx-ignore` is opt-in.

## Manifest Format

### Read/Write Shortcuts

| Shortcut | Read | Write |
|----------|------|-------|
| `"value"` | `el.value` | `el.value = x` |
| `"checked"` | `el.checked` | `el.checked = x` |
| `"text"` | `el.textContent` | `el.textContent = x` |
| `"attr:name"` | `el.getAttribute('name')` | `el.setAttribute('name', x)` |
| `"data:name"` | `el.dataset.name` | `el.dataset.name = x` |
| Function | Custom extractor | Custom writer |

The vocabulary is exact and case-sensitive: `"Value"`, `"valu"`, `" value"` and `"attr"` (no colon) are all rejected with `Unknown read shortcut`, rather than being guessed at.

### Entry Keys

| Key | Required | Description |
|-----|----------|-------------|
| `selector` | yes | CSS selector the entry resolves to |
| `read` | yes | How to extract the value |
| `write` | no | How to write the value; entries without it are read-only |
| `watch` | no | Explicit event name, overriding the one inferred from `read` |
| `serverOwned` | no | `true` = the server owns and re-renders this. `observe()` will not wake on the element's own mutations, only on user input to it. See [The wipe race](#the-wipe-race-read-this-before-you-observe-server-owned-state). |

### Custom Functions

For complex cases, pass a function:

⚠️ **Security Warning**: Custom functions have full access to DOM elements. Avoid using unsafe methods like `innerHTML` to prevent XSS attacks.

```js
const manifest = {
  combined: {
    selector: '#thing',
    read: (el) => `${el.dataset.foo}-${el.dataset.bar}`,
    write: (el, val) => {
      const [foo, bar] = val.split('-');
      el.dataset.foo = foo;
      el.dataset.bar = bar;
    }
  }
};
```

### Multiple Elements

When selector matches multiple elements, `collect()` returns an array:

```js
const manifest = {
  tags: { selector: '.tag', read: 'text' }
};

const state = domx.collect(manifest);
// → { tags: ["JavaScript", "TypeScript", "Python"] }
```

## htmx Integration

domx includes an htmx extension for seamless integration:

```html
<script src="domx.js"></script>
<script src="domx-htmx.js"></script>

<script>
const manifest = {
  searchQuery: { selector: '#search', read: 'value' },
  sortDir: { selector: '[data-sort]', read: 'attr:data-sort-dir' }
};
</script>

<body hx-ext="domx" dx-manifest="manifest" dx-cache="true">
  <input id="search" type="text">
  <button data-sort data-sort-dir="asc" hx-post="/api/search" hx-trigger="click">
    Search
  </button>
</body>
```

### Features

- **Auto state collection**: State is automatically added to request parameters
- **dx-cache**: When true, caches state to localStorage and auto-replays on page refresh (⚠️ avoid sensitive data)
- **dx:change event**: Fires when any observed state changes (use with `hx-trigger="dx:change"`)

### Attributes

| Attribute | Description |
|-----------|-------------|
| `dx-manifest` | Manifest object name or inline JSON |
| `dx-cache` | Enable localStorage caching ("true"/"false") |
| `dx-ignore` | Mark a transient node (drag ghost, insertion marker, spinner) so `observe()` skips it, its subtree, and its insertion/removal |

⚠️ **Security Warning**: `dx-manifest` attributes should be server-rendered, not user-settable, to prevent potential code injection through JSON parsing or window property access.

## Page Refresh Handling

domx solves the "lost state on refresh" problem:

1. **Before request**: `send()` caches state to localStorage
2. **On refresh**: `replay()` re-sends the cached request
3. **Server responds**: Fresh HTML with correct state

```js
// On page load
document.addEventListener('DOMContentLoaded', async () => {
  const response = await domx.replay();
  if (response?.ok) {
    const html = await response.text();
    document.getElementById('container').innerHTML = html;
  }
});
```

## Comparison with stateless (React)

| stateless (React) | domx (Vanilla) |
|-------------------|----------------|
| `useDomState(manifest)` | `collect(manifest)` |
| `useDomValue()` setter | `apply(manifest, state)` |
| Hook re-render on mutation | `observe(manifest, callback)` |

Both implement DATAOS principles. Use stateless for React apps, domx for vanilla JS or htmx apps.

## Performance

- **Single MutationObserver**: Regardless of manifest size, narrowed to the union of what live subscribers actually read
- **Batched callbacks**: Uses `requestAnimationFrame` to batch rapid changes
- **Passive event listeners**: For input/change events
- **~2.2KB**: Minified + gzipped; 1.9KB brotli, which is what the size budget gates on

## Related Projects

- **[DATAOS](https://dataos.software)** - The philosophy behind domx
- **[stateless](https://stateless.software)** - React implementation of DATAOS
- **[genX](https://genx.software)** - Declarative HTML formatting library (uses domx)
- **[htmx](https://htmx.org)** - High power tools for HTML
- **[multicardz](https://www.multicardz.com)** - DATAOS in production

## License

MIT © [Adam Zachary Wasserman](https://adamzacharywasserman.com)
