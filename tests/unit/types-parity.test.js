/**
 * Type declaration parity.
 *
 * These are source-shape checks, not behaviour tests — they pin that every
 * runtime export has a declared counterpart, and nothing more. They cannot
 * catch signature drift: dist/domx.d.ts was missing the `root` parameter of
 * collect() and apply() for an entire release and would have passed this.
 * Treat them as a wiring pin.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// import.meta.url is an http:// URL under the jsdom environment, so resolve
// from the vitest root instead.
const read = (relative) =>
  readFileSync(resolve(process.cwd(), 'src', relative), 'utf8');

/**
 * Value exports declared by a module or a declaration file.
 * Types and interfaces are deliberately excluded — only runtime bindings.
 */
function exportedNames(source) {
  const names = new Set();

  for (const m of source.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?function\s+(\w+)/g)) {
    names.add(m[1]);
  }
  for (const m of source.matchAll(/export\s+(?:declare\s+)?const\s+(\w+)/g)) {
    names.add(m[1]);
  }
  for (const m of source.matchAll(/export\s+(?!type\b)\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }

  return names;
}

const sorted = (set) => [...set].sort();

describe('type declaration parity', () => {
  it('declares every value export of domx.js', () => {
    expect(sorted(exportedNames(read('domx.d.ts'))))
      .toEqual(sorted(exportedNames(read('domx.js'))));
  });

  it('declares every value export of domx-htmx.js', () => {
    expect(sorted(exportedNames(read('domx-htmx.d.ts'))))
      .toEqual(sorted(exportedNames(read('domx-htmx.js'))));
  });

  it('declares the manifest keys observe() actually reads', () => {
    // serverOwned is consumed by buildMutationPlan; a manifest entry using it
    // must type-check for a TypeScript consumer.
    const declaration = read('domx.d.ts');

    expect(declaration).toContain('serverOwned?: boolean');
    expect(declaration).toContain('watch?: string');
  });
});
