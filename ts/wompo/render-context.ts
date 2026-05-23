/* Mutable global state shared between the renderer and the hook system. */
import type { Context, WompoElement } from './types.js';

// Module-load guard: if a host loads two copies of this module (npm-linked dual-instance
// hazard, common when a Vite SSR config uses `wompro` via Node and the user's pages import
// `wompo` via Vite's transform), the hook state would silently diverge. Yell loudly instead.
const DUP_KEY = '__wompo_render_context_loaded__';
if (typeof globalThis !== 'undefined') {
  if ((globalThis as any)[DUP_KEY]) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[wompo] render-context loaded more than once — hooks will likely throw. Configure your bundler to dedupe `wompo` (e.g. Vite resolve.dedupe + ssr.noExternal).',
      );
    }
  }
  (globalThis as any)[DUP_KEY] = true;
}

/**
 * The current rendering component instance. Read by hooks via the live binding.
 * Mutated only through the setters below (or via the renderer's __callComponent).
 */
export let currentRenderingComponent: WompoElement = null;
export let currentHookIndex = 0;

export const setCurrentRenderingComponent = (component: WompoElement | null) => {
  currentRenderingComponent = component;
};
export const resetHookIndex = () => {
  currentHookIndex = 0;
};
export const incrementHookIndex = () => currentHookIndex++;

/**
 * SSR-only context resolver hook. The server runtime swaps this in so `useContext` can walk a
 * non-DOM provider stack. Falls back to the context default when undefined.
 */
export let serverContextResolver: (<S>(c: Context<S>) => S | undefined) | null = null;
export const setServerContextResolver = (
  fn: (<S>(c: Context<S>) => S | undefined) | null,
) => {
  serverContextResolver = fn;
};
