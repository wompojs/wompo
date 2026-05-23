import type { RenderHtml, WompoComponent, WompoProps } from '../wompo.js';
import type { SsrContext } from './types.js';
export declare class Serializer {
    private ctx;
    private rootBuf;
    private frames;
    constructor(ctx: SsrContext);
    /** Top-level entry: render a root component and return its HTML. */
    renderRoot(Component: WompoComponent, props: WompoProps): Promise<string>;
    /** Where output is currently being written. Inside an open-tag of a component frame, output
     * goes to the parent buffer (the opening `<componentName ...>` text); inside the children of a
     * frame, output goes to that frame's children buffer. */
    private currentBuf;
    walkTemplate(tpl: RenderHtml): Promise<void>;
    private processPart;
    /** When the parser sees `>` that ends an open tag, push the tag-close to the correct buffer
     * (parent for a component frame, current for native), inject island markers if applicable,
     * mark the frame's open tag closed, and switch to raw-text mode for raw-text elements. If
     * self-closing (`<${Comp} />`), immediately render+pop the frame. */
    private closeOpenTag;
    /** Resolve the island hydration mode for a (Component, props) pair. A `client:*` directive on
     * the call site overrides the component's default `options.island`. Returns null when the
     * component should not be hydrated. */
    private resolveIslandMode;
    /** Push ` data-wompo-island="N" data-wompo-mode="M"` to parentBuf BEFORE the open-tag '>'
     * is emitted. Stores the island in the SSR context registry. */
    private injectIslandMarkers;
    /** Mark every wompo component emitted server-side with `data-wompo-ssr`. The client-side
     * `connectedCallback` reads this marker and skips its destructive `__initElement` re-render —
     * the SSR'd DOM IS the rendered output for non-island components, and islands handle their
     * own hydration via `_$hydrate()`. */
    private injectSsrMarker;
    /** After the open-tag '>' has been emitted, emit the JSON props payload as the first child
     * of the component (read by the hydration runtime). */
    private emitIslandPropsTemplate;
    /** Strip server-only / non-serializable keys from the props payload before islanding. */
    private sanitizePropsForIsland;
    /** Bare attribute (no `=`). For native open tags the chars are already in the buf via the
     * char walker, so this only updates the open component frame's pendingProps. */
    private flushBareAttrIfNeeded;
    /** Flush a static (no-interp) attribute. For component frames, the attr name was suppressed
     * during char emission; rebuild the full ` name="value"` (or boolean form) into parentBuf. */
    private flushAccumulatedAttr;
    private processInterp;
    /** Emit a single attribute value.
     *
     * `inlineName=true` means the attribute name + `=` are already in the buffer (an interp at the
     * `name=` position). `inlineName=false` means we must emit ` name="value"` ourselves (used by
     * attrs() spread and component-frame open-tag rebuilds).
     */
    private emitAttrValue;
    /** Push the context-provider's `value` prop onto the active SSR context stack. */
    private maybePushProviderValue;
    private emitSpread;
    /** The topmost frame whose open tag is still being collected, or null. */
    private openTagFrame;
    /** Innermost enclosing `<wompo-suspense>` frame (set on `closeOpenTag` in streaming mode). */
    private enclosingSuspenseFrame;
    private renderAndPop;
    /** Emit a component with its wrapping `<componentName attrs>` / `</componentName>` — used by
     * the root entry where no caller has emitted the open tag yet. */
    private emitComponent;
    /** Render a component's own template into the given buffer, with optional shadow wrapping. */
    private emitComponentInto;
    /** Walk a template, routing all output into `targetBuf`. Saves/restores serializer state. */
    private walkTemplateInto;
    /** Emit a single value (string, RenderHtml, component, ...) into `targetBuf`. */
    private emitNodeInto;
    /** Push static-attr text (` k="v"`) into `targetBuf` for each serializable prop. */
    private emitAttrsFromProps;
    private emitNode;
}
export declare function lookupComponent(tag: string): WompoComponent | undefined;
