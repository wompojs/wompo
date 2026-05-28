import type { Context, WompoElement } from './types.js';
export declare const getCurrentRenderingComponent: () => WompoElement | null;
export declare const setCurrentRenderingComponent: (component: WompoElement | null) => void;
export declare const getCurrentHookIndex: () => number;
export declare const resetHookIndex: () => void;
export declare const incrementHookIndex: () => number;
/**
 * SSR-only context resolver hook. The server runtime swaps this in so `useContext` can walk a
 * non-DOM provider stack. Falls back to the context default when undefined.
 */
export declare const getServerContextResolver: () => (<S>(c: Context<S>) => S | undefined) | null;
export declare const setServerContextResolver: (fn: (<S>(c: Context<S>) => S | undefined) | null) => void;
