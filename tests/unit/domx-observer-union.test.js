/**
 * Shared-observer union tests.
 *
 * These live in their own file deliberately: the shared MutationObserver and
 * its subscriber registry are module-level state, and vitest isolates modules
 * per test file. Subscriptions leaked by another file's tests would otherwise
 * union into every assertion here.
 *
 * The contract under test is what domx asks the DOM for, so the assertions
 * read the options handed to MutationObserver.observe(). That is a boundary
 * call, not business logic — the last test pins the same contract
 * behaviourally, end to end.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { observe, on } from '../../src/domx.js';

const flushMutations = async () => {
  await new Promise(r => setTimeout(r, 10));
  await new Promise(r => requestAnimationFrame(r));
};

/** Options from the most recent MutationObserver.observe() call. */
const lastOptions = (spy) => spy.mock.calls[spy.mock.calls.length - 1][1];

describe('shared observer union', () => {
  let observeSpy;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
  });

  it('narrows the observer to the attributes one manifest reads', () => {
    // CONTRACT: an attribute no subscriber reads is not even delivered.
    const unsubscribe = observe(
      { sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' } },
      () => {}
    );

    expect(lastOptions(observeSpy).attributeFilter).toEqual(['data-sort-dir']);
    unsubscribe();
  });

  it('unions the attributes of two concurrent subscribers', () => {
    // CONTRACT: one subscriber's narrowness must not blind another.
    const unsubA = observe(
      { sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' } },
      () => {}
    );
    const unsubB = observe(
      { theme: { selector: '[data-theme]', read: 'data:theme' } },
      () => {}
    );

    expect([...lastOptions(observeSpy).attributeFilter].sort())
      .toEqual(['data-sort-dir', 'data-theme']);

    unsubA();
    unsubB();
  });

  it('narrows back when one of two subscribers unsubscribes', () => {
    // CONTRACT: the union is recomputed on unsubscribe, not only on subscribe.
    const unsubA = observe(
      { sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' } },
      () => {}
    );
    const unsubB = observe(
      { theme: { selector: '[data-theme]', read: 'data:theme' } },
      () => {}
    );

    unsubA();

    expect(lastOptions(observeSpy).attributeFilter).toEqual(['data-theme']);
    unsubB();
  });

  it('widens to every attribute while an on() subscriber is live', () => {
    // CONTRACT: on() is a RAW mutation subscription. It must never be starved
    // by a narrow observe() sharing the same observer.
    const unsubObserve = observe(
      { sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' } },
      () => {}
    );
    const unsubOn = on(() => {});

    expect(lastOptions(observeSpy).attributes).toBe(true);
    expect(lastOptions(observeSpy).attributeFilter).toBeUndefined();

    unsubObserve();
    unsubOn();
  });

  it('narrows again once the on() subscriber leaves', () => {
    const unsubObserve = observe(
      { sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' } },
      () => {}
    );
    const unsubOn = on(() => {});

    unsubOn();

    expect(lastOptions(observeSpy).attributeFilter).toEqual(['data-sort-dir']);
    unsubObserve();
  });

  it('widens to every attribute for a custom read function', () => {
    // CONTRACT: a custom extractor can read anything, so it cannot be narrowed.
    const unsubscribe = observe(
      { combined: { selector: '#thing', read: (el) => el.getAttribute('a') } },
      () => {}
    );

    expect(lastOptions(observeSpy).attributes).toBe(true);
    expect(lastOptions(observeSpy).attributeFilter).toBeUndefined();
    unsubscribe();
  });

  it('leaves attributes off entirely for a value-only manifest', () => {
    // CONTRACT: nothing reads an attribute, so nothing asks for one. An empty
    // attributeFilter is not reliably "match nothing", so the key is omitted.
    const unsubscribe = observe(
      { searchQuery: { selector: '#search', read: 'value' } },
      () => {}
    );

    expect(lastOptions(observeSpy).attributes).toBeFalsy();
    expect(lastOptions(observeSpy).attributeFilter).toBeUndefined();
    unsubscribe();
  });

  it('asks for characterData only when a manifest reads text', () => {
    const unsubAttr = observe(
      { sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' } },
      () => {}
    );
    expect(lastOptions(observeSpy).characterData).toBe(false);

    const unsubText = observe({ label: { selector: '#box', read: 'text' } }, () => {});
    expect(lastOptions(observeSpy).characterData).toBe(true);

    unsubAttr();
    unsubText();
  });

  it('disconnects when the last subscriber leaves', () => {
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');

    const unsubscribe = observe(
      { sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' } },
      () => {}
    );
    unsubscribe();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('does not double-register the target when the union is recomputed', async () => {
    // CONTRACT: re-observing the same node REPLACES its options. If it stacked a
    // second registration instead, every reconfiguration would duplicate every
    // record for the rest of the page's life.
    document.body.innerHTML = '<button data-sort-dir="asc">Sort</button>';

    const raw = vi.fn();
    const unsubOn = on(raw);
    // Subscribing again recomputes the union and re-observes document.body
    const unsubObserve = observe(
      { theme: { selector: '[data-theme]', read: 'data:theme' } },
      () => {}
    );

    document.querySelector('button').setAttribute('data-sort-dir', 'desc');
    await flushMutations();

    const records = raw.mock.calls
      .flatMap(([mutations]) => mutations)
      .filter(m => m.type === 'attributes' && m.attributeName === 'data-sort-dir');
    expect(records).toHaveLength(1);

    unsubOn();
    unsubObserve();
  });

  it('still delivers an unwatched attribute to on() end-to-end', async () => {
    // CONTROL: the union is not just an options object. With a narrow observe()
    // live, a raw on() subscriber must still actually receive a mutation for an
    // attribute that observe() alone would have filtered out.
    document.body.innerHTML = '<button data-sort-dir="asc">Sort</button>';

    const unsubObserve = observe(
      { sortDir: { selector: '[data-sort-dir]', read: 'attr:data-sort-dir' } },
      () => {}
    );
    const raw = vi.fn();
    const unsubOn = on(raw);

    document.querySelector('button').setAttribute('aria-busy', 'true');
    await flushMutations();

    expect(raw).toHaveBeenCalled();
    const names = raw.mock.calls.flatMap(([mutations]) =>
      mutations.map(m => m.attributeName));
    expect(names).toContain('aria-busy');

    unsubObserve();
    unsubOn();
  });
});
