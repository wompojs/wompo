import type { WompoComponent } from '../wompo.js';
export interface CollectCssOptions {
    /** When `'exclude'` (default), shadow-DOM components' CSS is omitted from the inline block
     * (it's already in the shadow root). When `'include'`, it's emitted anyway. */
    shadow?: 'include' | 'exclude';
}
/** Build a `componentName -> css` map from used components, applying shadow rules. */
export declare function collectCss(usedComponents: Map<string, WompoComponent>, opts?: CollectCssOptions): Map<string, string>;
/** Concatenate component CSS into a single string, separated by newlines. */
export declare function joinCss(map: Map<string, string>): string;
/** Produce a `<style>` block for inlining into the rendered HTML. Returns empty string when there
 * is no CSS to emit. Accepts an optional CSP nonce. */
export declare function renderInlineStyleBlock(map: Map<string, string>, nonce?: string): string;
