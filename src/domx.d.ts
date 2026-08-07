/**
 * domx - DOM State Observer for DATAOS
 * Type declarations
 */

export type Reader<T = unknown> = (el: Element) => T;
export type Writer = (el: Element, value: unknown) => void;

export interface ManifestEntry {
  selector: string;
  read: string | Reader;
  write?: string | Writer;
  watch?: string;
  /**
   * State the server owns and re-renders. observe() will not wake on this
   * element's own mutations (only on user input to it), so the swap that
   * answers a request cannot re-trigger the request that produced it.
   */
  serverOwned?: boolean;
}

export interface Manifest {
  [key: string]: ManifestEntry;
}

/**
 * Collect state from DOM based on manifest
 * @param root Element from which selectors run (defaults to document)
 */
export function collect(manifest: Manifest, root?: ParentNode): Record<string, unknown>;

/**
 * Apply state to DOM based on manifest
 * @param root Element from which selectors run (defaults to document)
 */
export function apply(manifest: Manifest, state: Record<string, unknown>, root?: ParentNode): void;

/**
 * Observe DOM state changes and call callback with full state
 * @returns Unsubscribe function
 */
export function observe(manifest: Manifest, callback: (state: Record<string, unknown>) => void): () => void;

/**
 * Subscribe to raw DOM mutations
 * @returns Unsubscribe function
 */
export function on(callback: (mutations: MutationRecord[]) => void): () => void;

/**
 * Collect state, cache to localStorage, and send via fetch
 */
export function send(url: string, manifest: Manifest, opts?: RequestInit): Promise<Response>;

/**
 * Replay cached request (for page refresh recovery)
 */
export function replay(): Promise<Response | null>;

/**
 * Clear the cached request
 */
export function clearCache(): void;

declare const domx: {
  collect: typeof collect;
  apply: typeof apply;
  observe: typeof observe;
  on: typeof on;
  send: typeof send;
  replay: typeof replay;
  clearCache: typeof clearCache;
};

export default domx;
