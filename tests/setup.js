/**
 * Test environment setup.
 *
 * Node 22+ ships a native `localStorage` global that throws/returns undefined
 * unless the process was started with `--localstorage-file`. It is defined on
 * globalThis before vitest's jsdom environment installs its own Storage, so the
 * jsdom one never lands and `localStorage` reads as undefined inside tests.
 *
 * Install a real in-memory Storage when that happens. This touches the test
 * environment only — src/ uses the plain Web Storage API and is unchanged.
 */
function createStorage() {
  const entries = new Map();

  return {
    get length() {
      return entries.size;
    },
    key: (i) => Array.from(entries.keys())[i] ?? null,
    getItem: (k) => (entries.has(String(k)) ? entries.get(String(k)) : null),
    setItem: (k, v) => {
      entries.set(String(k), String(v));
    },
    removeItem: (k) => {
      entries.delete(String(k));
    },
    clear: () => {
      entries.clear();
    }
  };
}

if (!globalThis.localStorage) {
  const storage = createStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true
  });
  if (globalThis.window && globalThis.window !== globalThis) {
    Object.defineProperty(globalThis.window, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true
    });
  }
}
