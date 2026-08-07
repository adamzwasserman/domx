/**
 * Type-level usage fixture.
 *
 * This file is never executed and never bundled. It exists so that `tsc
 * --noEmit` fails when src/*.d.ts drifts from the actual signatures in src/*.js
 * — the failure mode the export-parity test cannot see. Every call below is one
 * a real consumer would write; if a signature changes without the declaration
 * following, one of them stops compiling.
 */

import {
  collect,
  apply,
  observe,
  on,
  send,
  replay,
  clearCache
} from '../../src/domx';
import type { Manifest, ManifestEntry } from '../../src/domx';
import { domxExtension } from '../../src/domx-htmx';

// --- Manifest shape -------------------------------------------------------

const entry: ManifestEntry = { selector: '#search', read: 'value' };

const manifest: Manifest = {
  searchQuery: entry,
  sortDir: {
    selector: '[data-sort]',
    read: 'attr:data-sort-dir',
    write: 'attr:data-sort-dir'
  },
  // watch overrides the event inferred from read
  blurred: { selector: '#search', read: 'value', watch: 'change' },
  // serverOwned suppresses self-triggering on the element's own mutations
  chips: { selector: '#chips', read: 'attr:data-chips', serverOwned: true },
  // read and write also accept functions
  combined: {
    selector: '#thing',
    read: (el: Element) => el.getAttribute('data-x'),
    write: (el: Element, value: unknown) => el.setAttribute('data-x', String(value))
  }
};

// --- collect / apply, with and without the root parameter -----------------

const state: Record<string, unknown> = collect(manifest);
const scopedRoot: ParentNode = document.querySelector('#section') as ParentNode;
const scoped: Record<string, unknown> = collect(manifest, scopedRoot);

apply(manifest, state);
apply(manifest, state, scopedRoot);

// --- observe / on ---------------------------------------------------------

const unobserve: () => void = observe(manifest, (next: Record<string, unknown>) => {
  void next;
});
unobserve();

const unlisten: () => void = on((mutations: MutationRecord[]) => {
  void mutations.length;
});
unlisten();

// --- send / replay / clearCache -------------------------------------------

async function roundTrip(): Promise<void> {
  const response: Response = await send('/api/search', manifest);
  void response.ok;

  const withOpts: Response = await send('/api/search', manifest, {
    headers: { 'X-Custom': 'value' }
  });
  void withOpts.ok;

  const replayed: Response | null = await replay();
  void replayed;

  clearCache();
}

void roundTrip;
void scoped;
void domxExtension;
