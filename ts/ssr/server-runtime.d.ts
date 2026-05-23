import type { RenderHtml, WompoComponent, WompoProps } from '../wompo.js';
import type { ServerInstance, SsrContext } from './types.js';
export declare function createServerInstance(Component: WompoComponent, tag: string, props: WompoProps, shadow: boolean): ServerInstance;
export declare function setActiveSsrContext(ctx: SsrContext | null): void;
export declare function getActiveSsrContext(): SsrContext | null;
/** Push a context value on the active stack. */
export declare function pushContextValue(name: string, value: unknown): void;
export declare function popContextValue(name: string): void;
/** Run a component once, returning its template. The caller owns awaiting any registered async
 * work and re-running. Sets and restores currentRenderingComponent. */
export declare function runComponentOnce(instance: ServerInstance, Component: WompoComponent, props: WompoProps): RenderHtml | null;
/** True when the instance recorded async work this render. */
export declare function hasPendingAsync(instance: ServerInstance): boolean;
/** Await every async call queued during the current render, mutating each hook's `value` so the
 * next render reads the resolved data. Returns when all are resolved. */
export declare function drainAsyncCalls(instance: ServerInstance): Promise<void>;
