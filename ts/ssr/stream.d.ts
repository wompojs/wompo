import type { WompoComponent, WompoProps } from '../wompo.js';
import type { SsrOptions } from './types.js';
/** Inline runtime injected at the top of the streamed HTML. ~140 bytes. */
export declare const BOUNDARY_RUNTIME_SCRIPT = "<script>self.__wompoR=function(i){var t=document.querySelector('template[data-wompo-resolve=\"'+i+'\"]');var b=document.querySelector('wompo-boundary[id=\"'+i+'\"]');if(t&&b){b.replaceChildren.apply(b,Array.prototype.slice.call(t.content.childNodes));b.removeAttribute(\"id\");t.remove();}};</script>";
/** Render a Wompo component to a `ReadableStream<Uint8Array>`. The shell (with Suspense
 * fallbacks) flushes first; resolved boundaries are appended as their useAsync work completes. */
export declare function renderToStream(Component: WompoComponent, props?: WompoProps, options?: SsrOptions): ReadableStream<Uint8Array>;
