/* Mutable global state shared between the renderer and the hook system.
 *
 * The state lives on `globalThis` rather than as module-local `let` so that two duplicate
 * `wompo` module instances (a common hazard with --preserve-symlinks + workspaces where the
 * bundler can't dedupe) still see the SAME render context. Otherwise the renderer running
 * inside instance A would set `currentRenderingComponent` on its private copy of this module
 * while a component imported from instance B would read `null` from its own copy, and the
 * very next hook call would throw.
 *
 * Consumers MUST go through the `getX`/`setX` helpers below — never re-bind the variables.
 */
import type { Context, WompoElement } from './types.js';

interface SharedState {
  currentRenderingComponent: WompoElement | null;
  currentHookIndex: number;
  serverContextResolver: (<S>(c: Context<S>) => S | undefined) | null;
}

const STATE_KEY = '__wompo_render_state__';
const DUP_KEY = '__wompo_render_context_loaded__';

const shared: SharedState =
  ((globalThis as any)[STATE_KEY] as SharedState | undefined) ??
  ((globalThis as any)[STATE_KEY] = {
    currentRenderingComponent: null,
    currentHookIndex: 0,
    serverContextResolver: null,
  });

// Duplicate-load detector. The shared state now genuinely merges, but devs should still know
// that their bundler isn't deduping — it bloats the bundle and risks divergent class metadata.
if (typeof globalThis !== 'undefined') {
  if ((globalThis as any)[DUP_KEY]) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[wompo] render-context loaded more than once — state is being shared via globalThis, but you should still dedupe `wompo` in your bundler (e.g. Vite resolve.dedupe + ssr.noExternal).',
      );
    }
  }
  (globalThis as any)[DUP_KEY] = true;
}

export const getCurrentRenderingComponent = (): WompoElement | null =>
  shared.currentRenderingComponent;

export const setCurrentRenderingComponent = (component: WompoElement | null) => {
  shared.currentRenderingComponent = component;
};

export const getCurrentHookIndex = (): number => shared.currentHookIndex;

export const resetHookIndex = () => {
  shared.currentHookIndex = 0;
};

export const incrementHookIndex = (): number => shared.currentHookIndex++;

/**
 * SSR-only context resolver hook. The server runtime swaps this in so `useContext` can walk a
 * non-DOM provider stack. Falls back to the context default when undefined.
 */
export const getServerContextResolver = ():
  | (<S>(c: Context<S>) => S | undefined)
  | null => shared.serverContextResolver;

export const setServerContextResolver = (
  fn: (<S>(c: Context<S>) => S | undefined) | null,
) => {
  shared.serverContextResolver = fn;
};
