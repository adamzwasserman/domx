/**
 * domx/htmx - htmx Extension for domx
 * Type declarations
 */

import type { Manifest } from './domx';

/**
 * htmx extension definition, registered as "domx".
 *
 * Registers itself with htmx automatically when htmx is present on the page;
 * export it for manual registration via htmx.defineExtension('domx', ...).
 */
export interface DomxExtension {
  init(api: unknown): void;
  onEvent(name: string, evt: Event & { detail?: Record<string, unknown> }): void;
}

export declare const domxExtension: DomxExtension;

export { collect, apply, observe, send, replay, clearCache } from './domx';
export type { Manifest, ManifestEntry, Reader, Writer } from './domx';
