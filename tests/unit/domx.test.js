/**
 * domx.js Unit Tests
 * Based on BDD feature file: tests/features/domx-core.feature
 *
 * These tests should FAIL initially (red phase) until domx.js is implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Will be implemented in src/domx.js
import { collect, apply, observe, on, send, replay, clearCache } from '../../src/domx.js';

describe('domx', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // collect() - Read state from DOM
  // ==========================================================================

  describe('collect()', () => {
    it('extracts single element value using "value" shortcut', () => {
      document.body.innerHTML = '<input id="search" value="hello">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value' }
      };

      const state = collect(manifest);
      expect(state.searchQuery).toBe('hello');
    });

    it('extracts checkbox state using "checked" shortcut', () => {
      document.body.innerHTML = '<input id="toggle" type="checkbox" checked>';

      const manifest = {
        isActive: { selector: '#toggle', read: 'checked' }
      };

      const state = collect(manifest);
      expect(state.isActive).toBe(true);
    });

    it('extracts text content using "text" shortcut', () => {
      document.body.innerHTML = '<span id="label">Hello World</span>';

      const manifest = {
        labelText: { selector: '#label', read: 'text' }
      };

      const state = collect(manifest);
      expect(state.labelText).toBe('Hello World');
    });

    it('extracts attribute using "attr:name" shortcut', () => {
      document.body.innerHTML = '<button data-sort-dir="asc">Sort</button>';

      const manifest = {
        sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' }
      };

      const state = collect(manifest);
      expect(state.sortDir).toBe('asc');
    });

    it('extracts dataset using "data:name" shortcut', () => {
      document.body.innerHTML = '<div data-filter="active">Items</div>';

      const manifest = {
        filter: { selector: '[data-filter]', read: 'data:filter' }
      };

      const state = collect(manifest);
      expect(state.filter).toBe('active');
    });

    it('uses custom extractor function', () => {
      document.body.innerHTML = '<div data-x="foo" data-y="bar">Combined</div>';

      const manifest = {
        combined: {
          selector: 'div',
          read: (el) => el.dataset.x + '-' + el.dataset.y
        }
      };

      const state = collect(manifest);
      expect(state.combined).toBe('foo-bar');
    });

    it('returns null for missing elements', () => {
      document.body.innerHTML = '<div id="exists">Here</div>';

      const manifest = {
        missing: { selector: '#nonexistent', read: 'text' }
      };

      const state = collect(manifest);
      expect(state.missing).toBeNull();
    });

    it('returns array for multiple matching elements', () => {
      document.body.innerHTML = '<span class="tag">A</span><span class="tag">B</span><span class="tag">C</span>';

      const manifest = {
        tags: { selector: '.tag', read: 'text' }
      };

      const state = collect(manifest);
      expect(state.tags).toEqual(['A', 'B', 'C']);
    });
  });

  // ==========================================================================
  // apply() - Write state to DOM
  // ==========================================================================

  describe('apply()', () => {
    it('writes value using "value" shortcut', () => {
      document.body.innerHTML = '<input id="search" value="old">';

      const manifest = {
        searchQuery: { selector: '#search', write: 'value' }
      };

      apply(manifest, { searchQuery: 'new' });
      expect(document.querySelector('#search').value).toBe('new');
    });

    it('writes checked state using "checked" shortcut', () => {
      document.body.innerHTML = '<input id="toggle" type="checkbox">';

      const manifest = {
        isActive: { selector: '#toggle', write: 'checked' }
      };

      apply(manifest, { isActive: true });
      expect(document.querySelector('#toggle').checked).toBe(true);
    });

    it('writes text content using "text" shortcut', () => {
      document.body.innerHTML = '<span id="label">Old</span>';

      const manifest = {
        labelText: { selector: '#label', write: 'text' }
      };

      apply(manifest, { labelText: 'New' });
      expect(document.querySelector('#label').textContent).toBe('New');
    });

    it('writes attribute using "attr:name" shortcut', () => {
      document.body.innerHTML = '<button data-sort-dir="asc">Sort</button>';

      const manifest = {
        sortDir: { selector: '[data-sort-dir]', write: 'attr:data-sort-dir' }
      };

      apply(manifest, { sortDir: 'desc' });
      expect(document.querySelector('[data-sort-dir]').getAttribute('data-sort-dir')).toBe('desc');
    });

    it('writes dataset using "data:name" shortcut', () => {
      document.body.innerHTML = '<div data-filter="old">Items</div>';

      const manifest = {
        filter: { selector: '[data-filter]', write: 'data:filter' }
      };

      apply(manifest, { filter: 'completed' });
      expect(document.querySelector('[data-filter]').dataset.filter).toBe('completed');
    });

    it('uses custom writer function', () => {
      document.body.innerHTML = '<div data-x="" data-y="">Combined</div>';

      const manifest = {
        combined: {
          selector: 'div',
          write: (el, val) => {
            const [x, y] = val.split('-');
            el.dataset.x = x;
            el.dataset.y = y;
          }
        }
      };

      apply(manifest, { combined: 'foo-bar' });
      const el = document.querySelector('div');
      expect(el.dataset.x).toBe('foo');
      expect(el.dataset.y).toBe('bar');
    });

    it('ignores keys not in manifest', () => {
      document.body.innerHTML = '<input id="search" value="keep">';

      const manifest = {
        searchQuery: { selector: '#search', write: 'value' }
      };

      // Should not throw
      apply(manifest, { unknownKey: 'ignored', searchQuery: 'updated' });
      expect(document.querySelector('#search').value).toBe('updated');
    });

    it('only processes entries with write key', () => {
      document.body.innerHTML = '<input id="readonly" value="original">';

      const manifest = {
        readOnly: { selector: '#readonly', read: 'value' } // no write key
      };

      apply(manifest, { readOnly: 'attempted' });
      expect(document.querySelector('#readonly').value).toBe('original');
    });
  });

  // ==========================================================================
  // observe() - Watch DOM for state changes
  // ==========================================================================

  describe('observe()', () => {
    it('calls callback on input event for "value" read type', async () => {
      document.body.innerHTML = '<input id="search" value="initial">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value' }
      };

      const callback = vi.fn();
      observe(manifest, callback);

      const input = document.querySelector('#search');
      input.value = 'updated';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for rAF batch
      await new Promise(r => requestAnimationFrame(r));

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].searchQuery).toBe('updated');
    });

    it('calls callback on change event for "checked" read type', async () => {
      document.body.innerHTML = '<input id="toggle" type="checkbox">';

      const manifest = {
        isActive: { selector: '#toggle', read: 'checked' }
      };

      const callback = vi.fn();
      observe(manifest, callback);

      const toggle = document.querySelector('#toggle');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(r => requestAnimationFrame(r));

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].isActive).toBe(true);
    });

    it('uses MutationObserver for "attr:*" read type', async () => {
      document.body.innerHTML = '<button data-sort-dir="asc">Sort</button>';

      const manifest = {
        sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' }
      };

      const callback = vi.fn();
      observe(manifest, callback);

      document.querySelector('[data-sort-dir]').setAttribute('data-sort-dir', 'desc');

      // MutationObserver is async
      await new Promise(r => setTimeout(r, 10));
      await new Promise(r => requestAnimationFrame(r));

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].sortDir).toBe('desc');
    });

    it('returns unsubscribe function', async () => {
      document.body.innerHTML = '<input id="search" value="initial">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      unsubscribe();

      const input = document.querySelector('#search');
      input.value = 'changed';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(r => requestAnimationFrame(r));

      expect(callback).not.toHaveBeenCalled();
    });

    it('batches rapid changes using requestAnimationFrame', async () => {
      document.body.innerHTML = '<input id="a" value="1"><input id="b" value="2">';

      const manifest = {
        a: { selector: '#a', read: 'value' },
        b: { selector: '#b', read: 'value' }
      };

      const callback = vi.fn();
      observe(manifest, callback);

      // Rapid changes in same frame
      const inputA = document.querySelector('#a');
      const inputB = document.querySelector('#b');
      inputA.value = '10';
      inputA.dispatchEvent(new Event('input', { bubbles: true }));
      inputB.value = '20';
      inputB.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(r => requestAnimationFrame(r));

      // Should be called once with both changes
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0]).toEqual({ a: '10', b: '20' });
    });
  });

  // ==========================================================================
  // on() - Low-level mutation subscription
  // ==========================================================================

  describe('on()', () => {
    it('calls callback with raw MutationRecords', async () => {
      document.body.innerHTML = '<div id="container"></div>';

      const callback = vi.fn();
      on(callback);

      const container = document.querySelector('#container');
      const span = document.createElement('span');
      span.textContent = 'New';
      container.appendChild(span);

      await new Promise(r => setTimeout(r, 10));

      expect(callback).toHaveBeenCalled();
      const mutations = callback.mock.calls[0][0];
      expect(Array.isArray(mutations)).toBe(true);
      expect(mutations[0].addedNodes.length).toBeGreaterThan(0);
    });

    it('returns unsubscribe function', async () => {
      document.body.innerHTML = '<div id="container"></div>';

      const callback = vi.fn();
      const unsubscribe = on(callback);

      unsubscribe();

      const container = document.querySelector('#container');
      container.appendChild(document.createElement('span'));

      await new Promise(r => setTimeout(r, 10));

      expect(callback).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', async () => {
      document.body.innerHTML = '<div id="container"></div>';

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      on(callback1);
      on(callback2);

      const container = document.querySelector('#container');
      container.appendChild(document.createElement('span'));

      await new Promise(r => setTimeout(r, 10));

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // send() - Fetch with state caching
  // ==========================================================================

  describe('send()', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<div>Result</div>')
      }));
    });

    it('collects state and sends as POST body', async () => {
      document.body.innerHTML = '<input id="search" value="query">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value' }
      };

      await send('/api/search', manifest);

      expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ searchQuery: 'query' })
      }));
    });

    it('caches state to localStorage before fetch', async () => {
      document.body.innerHTML = '<input id="search" value="cached">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value' }
      };

      await send('/api/search', manifest);

      const cached = JSON.parse(localStorage.getItem('domx:lastRequest'));
      expect(cached.url).toBe('/api/search');
      expect(cached.state).toEqual({ searchQuery: 'cached' });
    });

    it('passes custom headers', async () => {
      document.body.innerHTML = '<input id="search" value="query">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value' }
      };

      await send('/api/search', manifest, { headers: { 'X-Custom': 'value' } });

      expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
        headers: expect.objectContaining({ 'X-Custom': 'value' })
      }));
    });

    it('returns fetch response', async () => {
      document.body.innerHTML = '<input id="search" value="query">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value' }
      };

      const response = await send('/api/search', manifest);
      const text = await response.text();

      expect(text).toBe('<div>Result</div>');
    });
  });

  // ==========================================================================
  // replay() - Restore state on page refresh
  // ==========================================================================

  describe('replay()', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<div>Restored</div>')
      }));
    });

    it('re-sends cached request', async () => {
      localStorage.setItem('domx:lastRequest', JSON.stringify({
        url: '/api/search',
        state: { searchQuery: 'cached' },
        ts: Date.now()
      }));

      await replay();

      expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ searchQuery: 'cached' })
      }));
    });

    it('returns null when no cache exists', async () => {
      const result = await replay();

      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns null when cache is expired', async () => {
      localStorage.setItem('domx:lastRequest', JSON.stringify({
        url: '/api/search',
        state: { searchQuery: 'old' },
        ts: Date.now() - (10 * 60 * 1000) // 10 minutes ago
      }));

      const result = await replay();

      expect(result).toBeNull();
    });

    it('returns Response on success', async () => {
      localStorage.setItem('domx:lastRequest', JSON.stringify({
        url: '/api/search',
        state: { searchQuery: 'cached' },
        ts: Date.now()
      }));

      const response = await replay();
      const text = await response.text();

      expect(text).toBe('<div>Restored</div>');
    });
  });

  // ==========================================================================
  // clearCache()
  // ==========================================================================

  describe('clearCache()', () => {
    it('removes cached request', () => {
      localStorage.setItem('domx:lastRequest', JSON.stringify({
        url: '/api/search',
        state: { searchQuery: 'cached' },
        ts: Date.now()
      }));

      clearCache();

      expect(localStorage.getItem('domx:lastRequest')).toBeNull();
    });
  });
});
