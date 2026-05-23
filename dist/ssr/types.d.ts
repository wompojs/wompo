import type { WompoComponent, WompoProps } from '../wompo.js';
export interface SsrOptions {
    /** Island detection. 'islands' (default) marks islands for hydration; 'none' skips. */
    hydration?: 'islands' | 'none';
    /** URL prefix for chunks (default '/_/'). */
    base?: string;
    /** Inline runtime bootstrap module URL. The framework usually injects this. */
    bootstrap?: string;
    /** CSP nonce applied to inline <script>s. */
    nonce?: string;
    /** Optional abort signal. */
    signal?: AbortSignal;
    /**
     * CSS strategy. 'inline' (default) emits a `<style>` block in `headTags` that the caller
     * is expected to insert into the page `<head>`. 'extract' leaves the CSS map untouched
     * for the framework to write to a separate file. 'none' skips CSS collection entirely.
     */
    css?: 'inline' | 'extract' | 'none';
}
export interface IslandRef {
    /** Custom element tag name. */
    name: string;
    /** Hydration trigger. */
    mode: IslandMode;
    /** Position in document (DFS order). */
    index: number;
}
export type IslandMode = 'load' | 'idle' | 'visible';
export interface SsrResult {
    html: string;
    headTags: string;
    islands: IslandRef[];
    css: Map<string, string>;
}
/** Fake "WompoElement" used as the rendering target on the server. The shape mirrors what hooks
 * touch so we can reuse `ts/wompo/hooks.ts` unmodified for the synchronous hooks. */
export interface ServerInstance {
    hooks: any[];
    props: WompoProps;
    _$wompo: true;
    _$initialProps: WompoProps;
    _$measurePerf: boolean;
    _$usesContext: boolean;
    _$hasBeenMoved: boolean;
    _$updating: boolean;
    _$effects: any[];
    _$layoutEffects: any[];
    _$asyncCalls: any[];
    _$suspendedAsyncCalls: any[];
    _$portals: any[];
    requestRender: () => void;
    onDisconnected: () => void;
    updateProp: (k: string, v: any) => void;
    __ssrComponent: WompoComponent;
    __ssrTag: string;
    __ssrIsland: IslandMode | null;
    __ssrShadow: boolean;
}
/** A component instance that registered useAsync inside a Suspense ancestor in streaming mode.
 * Its initial render pass returned a RenderHtml whose async hook(s) hold `null`; the boundary
 * resolution phase drains those hooks and re-renders to produce the resolved HTML. */
export interface SuspendedChild {
    instance: ServerInstance;
    Component: WompoComponent;
    props: WompoProps;
    childrenHtml: string;
}
/** A Suspense boundary whose resolved content is emitted as an out-of-order chunk after the
 * main shell is flushed. */
export interface PendingBoundary {
    id: string;
    resolve: () => Promise<string>;
}
/** Mutable context passed through the entire render. */
export interface SsrContext {
    options: Required<Pick<SsrOptions, 'hydration' | 'base'>> & SsrOptions;
    /** All components rendered so far (used for CSS extraction in M4). */
    usedComponents: Map<string, WompoComponent>;
    /** Islands found, in document order. */
    islands: IslandRef[];
    /** Stack of context-provider values. Maps Context.name -> stack of current values. */
    contextStack: Map<string, any[]>;
    /** Monotonic id counter used by useId on the server. */
    idCounter: number;
    /** Async work queued during the current render pass (lazy(), useAsync). */
    pendingAsync: Promise<unknown>[];
    /** True when produced by renderToStream — enables Suspense deferral. */
    streaming?: boolean;
    /** Boundaries to be emitted after the main shell. */
    pendingBoundaries?: PendingBoundary[];
}
