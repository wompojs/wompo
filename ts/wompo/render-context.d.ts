import type { Context, WompoElement } from './types.js';
/**
 * The current rendering component instance. Read by hooks via the live binding.
 * Mutated only through the setters below (or via the renderer's __callComponent).
 */
export declare let currentRenderingComponent: WompoElement;
export declare let currentHookIndex: number;
export declare const setCurrentRenderingComponent: (component: WompoElement | null) => void;
export declare const resetHookIndex: () => void;
export declare const incrementHookIndex: () => number;
/**
 * SSR-only context resolver hook. The server runtime swaps this in so `useContext` can walk a
 * non-DOM provider stack. Falls back to the context default when undefined.
 */
export declare let serverContextResolver: (<S>(c: Context<S>) => S | undefined) | null;
export declare const setServerContextResolver: (fn: (<S>(c: Context<S>) => S | undefined) | null) => void;
