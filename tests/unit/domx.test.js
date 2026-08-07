/**
 * domx.js Unit Tests
 * Based on BDD feature file: tests/features/domx-core.feature
 *
 * These tests should FAIL initially (red phase) until domx.js is implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Will be implemented in src/domx.js
import { collect, apply, observe, on, send, replay, clearCache } from '../../src/domx.js';

/**
 * Let a MutationObserver batch be delivered, then let observe()'s
 * requestAnimationFrame debounce run.
 */
const flushMutations = async () => {
  await new Promise(r => setTimeout(r, 10));
  await new Promise(r => requestAnimationFrame(r));
};

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

    it('scopes selectors to optional root element', () => {
      document.body.innerHTML = `
        <section id="left"><span class="tag">L1</span><span class="tag">L2</span></section>
        <section id="right"><span class="tag">R1</span></section>
      `;

      const manifest = { tags: { selector: '.tag', read: 'text' } };

      // Default: document root, sees all five tags
      expect(collect(manifest).tags).toEqual(['L1', 'L2', 'R1']);

      // Scoped to #left, sees only its two tags
      const left = document.getElementById('left');
      expect(collect(manifest, left).tags).toEqual(['L1', 'L2']);

      // Scoped to #right, sees only its one tag (single value, not array)
      const right = document.getElementById('right');
      expect(collect(manifest, right).tags).toBe('R1');
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

    it('scopes writes to optional root element', () => {
      document.body.innerHTML = `
        <section id="left"><input class="q" value="old"></section>
        <section id="right"><input class="q" value="old"></section>
      `;

      const manifest = { q: { selector: '.q', write: 'value' } };

      // Scoped to #left only — #right input stays untouched
      const left = document.getElementById('left');
      apply(manifest, { q: 'new' }, left);

      expect(left.querySelector('.q').value).toBe('new');
      expect(document.getElementById('right').querySelector('.q').value).toBe('old');
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

  describe('observe() manifest validation', () => {
    it('throws synchronously on an invalid read shortcut', () => {
      // CONTRACT: a bad shortcut fails at the observe() call site, not later
      // inside a requestAnimationFrame callback where nobody can catch it.
      document.body.innerHTML = '<div id="el"></div>';

      expect(() => observe({ x: { selector: '#el', read: 'attr:' } }, () => {}))
        .toThrow('Unknown read shortcut: attr:');
    });

    it('does not throw for entries missing selector or read', () => {
      // CONTROL: collect() skips incomplete entries, so observe() must too —
      // validation must not be stricter than the thing it guards.
      document.body.innerHTML = '<div id="el"></div>';

      const unsubscribe = observe({ incomplete: { selector: '#el' } }, () => {});

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('observe() watch override', () => {
    it('watches the overriding event instead of the one implied by read', async () => {
      // CONTRACT: watch:'change' on a read:'value' entry means change fires it
      // and input does not — the override replaces the inferred event, it does
      // not add to it.
      document.body.innerHTML = '<input id="search" value="initial">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value', watch: 'change' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      const input = document.querySelector('#search');
      input.value = 'typed';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flushMutations();

      expect(callback).not.toHaveBeenCalled();

      input.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMutations();

      expect(callback.mock.calls[0][0].searchQuery).toBe('typed');
      unsubscribe();
    });
  });

  // ==========================================================================
  // observe() - Mutation relevance
  //
  // Every "does not fire" contract below is paired with a positive control in
  // the same block. A filter that dropped everything would satisfy the
  // negatives alone, so the negatives alone are not a test.
  // ==========================================================================

  describe('observe() mutation relevance', () => {
    it('does not fire on class-only mutations when no entry reads class', async () => {
      // CONTRACT: a cosmetic class flip on a watched element MUST NOT wake observe().
      document.body.innerHTML = '<button data-sort-dir="asc">Sort</button>';

      const manifest = {
        sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('[data-sort-dir]').className = 'highlighted';
      await flushMutations();

      expect(callback).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('fires on class mutations when an entry reads class outright', async () => {
      // CONTRACT: class is only cosmetic until a manifest says otherwise.
      document.body.innerHTML = '<button class="idle">Sort</button>';

      const manifest = {
        mode: { selector: 'button', read: 'attr:class' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('button').className = 'active';
      await flushMutations();

      expect(callback.mock.calls[0][0].mode).toBe('active');
      unsubscribe();
    });

    it('does not fire on attributes outside the manifest read set', async () => {
      // CONTRACT: an attribute no entry reads MUST NOT wake observe().
      document.body.innerHTML = '<button data-sort-dir="asc">Sort</button>';

      const manifest = {
        sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('[data-sort-dir]').setAttribute('aria-busy', 'true');
      await flushMutations();

      expect(callback).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('fires on the exact attribute the manifest reads', async () => {
      // CONTROL: narrowing must not narrow away the attribute we came for.
      document.body.innerHTML = '<button data-sort-dir="asc">Sort</button>';

      const manifest = {
        sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('[data-sort-dir]').setAttribute('data-sort-dir', 'desc');
      await flushMutations();

      expect(callback.mock.calls[0][0].sortDir).toBe('desc');
      unsubscribe();
    });

    it('maps a "data:name" read to its kebab-case attribute', async () => {
      // CONTRACT: dataset key sortDir is the data-sort-dir attribute, and the
      // attribute filter is built in attribute space, not dataset space.
      document.body.innerHTML = '<div data-sort-dir="asc">Items</div>';

      const manifest = {
        sortDir: { selector: '[data-sort-dir]', read: 'data:sortDir' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('[data-sort-dir]').setAttribute('data-sort-dir', 'desc');
      await flushMutations();

      expect(callback.mock.calls[0][0].sortDir).toBe('desc');
      unsubscribe();
    });

    it('does not fire on character data edits when no entry reads text', async () => {
      // CONTRACT: characterData is only watched when some entry reads text.
      document.body.innerHTML = '<div id="box" data-count="1">original</div>';

      const manifest = {
        count: { selector: '#box', read: 'attr:data-count' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('#box').firstChild.data = 'changed';
      await flushMutations();

      expect(callback).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('fires on character data edits when an entry reads text', async () => {
      // CONTROL: a text read must survive a direct edit to the text node, whose
      // mutation target is the Text node rather than the element.
      document.body.innerHTML = '<div id="box">original</div>';

      const manifest = {
        label: { selector: '#box', read: 'text' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('#box').firstChild.data = 'changed';
      await flushMutations();

      expect(callback.mock.calls[0][0].label).toBe('changed');
      unsubscribe();
    });
  });

  // ==========================================================================
  // observe() - dx-ignore
  // ==========================================================================

  describe('observe() dx-ignore', () => {
    it('does not fire when a [dx-ignore] node is inserted', async () => {
      // CONTRACT: a transient feedback node carries its own opt-out.
      document.body.innerHTML = '<div id="list" data-count="0"></div>';

      const manifest = {
        count: { selector: '#list', read: 'attr:data-count' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      const ghost = document.createElement('span');
      ghost.setAttribute('dx-ignore', '');
      document.querySelector('#list').appendChild(ghost);
      await flushMutations();

      expect(callback).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('does not fire when a [dx-ignore] node is removed', async () => {
      // CONTRACT: tearing the drag ghost back down is as silent as raising it.
      document.body.innerHTML =
        '<div id="list" data-count="0"><span dx-ignore id="ghost"></span></div>';

      const manifest = {
        count: { selector: '#list', read: 'attr:data-count' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('#ghost').remove();
      await flushMutations();

      expect(callback).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('does not fire on mutations inside a [dx-ignore] subtree', async () => {
      // CONTRACT: the opt-out covers descendants, not just the marked node —
      // and it holds even for an attribute the manifest does read.
      document.body.innerHTML =
        '<div id="list" data-count="0"><span dx-ignore id="ghost" data-count="0"></span></div>';

      const manifest = {
        count: { selector: '#list', read: 'attr:data-count' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('#ghost').setAttribute('data-count', '9');
      await flushMutations();

      expect(callback).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('fires when a node without dx-ignore is inserted', async () => {
      // CONTROL: dx-ignore is opt-in; unmarked churn still wakes observe().
      document.body.innerHTML = '<div id="list" data-count="0"></div>';

      const manifest = {
        count: { selector: '#list', read: 'attr:data-count' }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('#list').appendChild(document.createElement('span'));
      await flushMutations();

      expect(callback).toHaveBeenCalled();
      unsubscribe();
    });
  });

  // ==========================================================================
  // observe() - server-owned state (the wipe race)
  // ==========================================================================

  describe('observe() serverOwned', () => {
    it('does not self-trigger on a serverOwned entry own mutation', async () => {
      // CONTRACT: state the server re-renders MUST NOT make our own swap
      // re-trigger the send that produced it.
      document.body.innerHTML = '<div id="chips" data-chips="a">a</div>';

      const manifest = {
        chips: { selector: '#chips', read: 'attr:data-chips', serverOwned: true }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      document.querySelector('#chips').setAttribute('data-chips', 'a,b');
      await flushMutations();

      expect(callback).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('still fires on user input to a serverOwned entry', async () => {
      // CONTROL: serverOwned silences the element's own mutations, never the
      // user's input to it.
      document.body.innerHTML = '<input id="search" value="initial">';

      const manifest = {
        searchQuery: { selector: '#search', read: 'value', serverOwned: true }
      };

      const callback = vi.fn();
      const unsubscribe = observe(manifest, callback);

      const input = document.querySelector('#search');
      input.value = 'typed';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flushMutations();

      expect(callback.mock.calls[0][0].searchQuery).toBe('typed');
      unsubscribe();
    });

    it('still reads serverOwned entries in collect()', () => {
      // CONTRACT: serverOwned changes what wakes observe(), never what is state.
      document.body.innerHTML = '<div id="chips" data-chips="a,b">chips</div>';

      const manifest = {
        chips: { selector: '#chips', read: 'attr:data-chips', serverOwned: true }
      };

      expect(collect(manifest).chips).toBe('a,b');
    });
  });

  // ==========================================================================
  // Honesty laws - the manifest is the caller's, not ours
  //
  // honest-test Law 3: the input is unchanged after the call, no exceptions.
  // Law 2 applies to collect() only as far as the DOM holds still: it reads
  // external state, so it is a boundary link and exempt from purity proper.
  // ==========================================================================

  describe('honesty laws', () => {
    const buildManifest = () => ({
      searchQuery: { selector: '#search', read: 'value' },
      sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir', write: 'attr:data-sort-dir' },
      label: { selector: '#box', read: 'text' },
      chips: { selector: '#chips', read: 'attr:data-chips', serverOwned: true }
    });

    const populate = () => {
      document.body.innerHTML =
        '<input id="search" value="q">' +
        '<button data-sort-dir="asc">Sort</button>' +
        '<div id="box">text</div>' +
        '<div id="chips" data-chips="a">a</div>';
    };

    it('collect() does not mutate the manifest', () => {
      populate();
      const manifest = buildManifest();
      const before = JSON.stringify(manifest);

      collect(manifest);

      expect(JSON.stringify(manifest)).toBe(before);
    });

    it('apply() does not mutate the manifest', () => {
      populate();
      const manifest = buildManifest();
      const before = JSON.stringify(manifest);

      apply(manifest, { sortDir: 'desc' });

      expect(JSON.stringify(manifest)).toBe(before);
    });

    it('observe() does not mutate the manifest', () => {
      populate();
      const manifest = buildManifest();
      const before = JSON.stringify(manifest);

      const unsubscribe = observe(manifest, () => {});

      expect(JSON.stringify(manifest)).toBe(before);
      unsubscribe();
    });

    it('collect() returns the same state twice over an unchanged DOM', () => {
      populate();
      const manifest = buildManifest();

      expect(collect(manifest)).toEqual(collect(manifest));
    });
  });

  // ==========================================================================
  // Read vocabulary - adversarial rejection (honest-test Law 5)
  //
  // The read vocabulary is a bounded Set. Every edit-distance-1 neighbour of a
  // member must be rejected; an accepted neighbour is a case-sensitivity bug or
  // a vocabulary overlap.
  // ==========================================================================

  const NEIGHBOURS = [
    'Value', 'valu', 'vvalue', ' value', 'value ',
    'Checked', 'checke', 'cheked',
    'Text', 'tex', 'ttext',
    'attr', 'atr:x', 'Attr:x', 'attr;x', 'attr:',
    'data', 'dat:x', 'Data:x', 'data;x', 'data:'
  ];

  describe('read vocabulary adversarial rejection', () => {
    it.each(NEIGHBOURS)('rejects the read shortcut neighbour %j', (neighbour) => {
      document.body.innerHTML = '<input id="el" value="hello">';

      expect(() => collect({ x: { selector: '#el', read: neighbour } }))
        .toThrow(`Unknown read shortcut: ${neighbour}`);
    });
  });

  describe('write vocabulary adversarial rejection', () => {
    // The write vocabulary is the same bounded Set as the read one and gets the
    // same treatment; a gap on the write side is the same bug.
    it.each(NEIGHBOURS)('rejects the write shortcut neighbour %j', (neighbour) => {
      document.body.innerHTML = '<input id="el" value="hello">';

      expect(() => apply({ x: { selector: '#el', write: neighbour } }, { x: 'v' }))
        .toThrow(`Unknown write shortcut: ${neighbour}`);
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
