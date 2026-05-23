/* Streaming SSR with out-of-order Suspense flushing.
 *
 * The shell (page chrome + Suspense fallbacks wrapped in `<wompo-boundary id="Bn">`) is rendered
 * and emitted FIRST, so the browser can paint a meaningful screen before any slow `useAsync`
 * promises resolve. Each Suspense in the tree records its still-pending descendants on a
 * `PendingBoundary` queue. Once the shell is enqueued, the boundaries are awaited (in
 * registration order) and each resolved chunk is emitted as:
 *
 *     <template data-wompo-resolve="Bn">…resolved children…</template>
 *     <script>self.__wompoR("Bn")</script>
 *
 * A tiny `self.__wompoR` runtime (BOUNDARY_RUNTIME_SCRIPT) is enqueued before the shell; it
 * adopts the template's children into the matching `<wompo-boundary>` and discards the template.
 *
 * Boundaries run in parallel as they're awaited — we kick them off concurrently and emit
 * chunks in completion order so a slow boundary can't block a fast one.
 */
import type { WompoComponent, WompoProps } from '../wompo.js';
import { collectCss, renderInlineStyleBlock } from './css.js';
import { Serializer } from './serializer.js';
import {
  getActiveSsrContext,
  setActiveSsrContext,
} from './server-runtime.js';
import type { PendingBoundary, SsrContext, SsrOptions } from './types.js';

/** Inline runtime injected at the top of the streamed HTML. ~140 bytes. */
export const BOUNDARY_RUNTIME_SCRIPT =
  '<script>self.__wompoR=function(i){var t=document.querySelector(\'template[data-wompo-resolve="\'+i+\'"]\');var b=document.querySelector(\'wompo-boundary[id="\'+i+\'"]\');if(t&&b){b.replaceChildren.apply(b,Array.prototype.slice.call(t.content.childNodes));b.removeAttribute("id");t.remove();}};</script>';

function createStreamingContext(options: SsrOptions): SsrContext {
  return {
    options: {
      hydration: options.hydration ?? 'islands',
      base: options.base ?? '/_/',
      ...options,
    },
    usedComponents: new Map(),
    islands: [],
    contextStack: new Map(),
    idCounter: 0,
    pendingAsync: [],
    streaming: true,
    pendingBoundaries: [],
  };
}

/** Render a Wompo component to a `ReadableStream<Uint8Array>`. The shell (with Suspense
 * fallbacks) flushes first; resolved boundaries are appended as their useAsync work completes. */
export function renderToStream(
  Component: WompoComponent,
  props: WompoProps = {},
  options: SsrOptions = {},
): ReadableStream<Uint8Array> {
  const ctx = createStreamingContext(options);
  const cssMode = options.css ?? 'inline';
  const enc = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const previous = getActiveSsrContext();
      setActiveSsrContext(ctx);
      try {
        const serializer = new Serializer(ctx);
        const shellHtml = await serializer.renderRoot(Component, props);

        // Head: runtime + (optional) CSS block.
        let head = BOUNDARY_RUNTIME_SCRIPT;
        if (cssMode === 'inline') {
          const css = collectCss(ctx.usedComponents);
          head += renderInlineStyleBlock(css, options.nonce);
        }
        controller.enqueue(enc.encode(head + shellHtml));

        // Race each pending boundary against the others so a slow Suspense doesn't gate a fast
        // one. We track winners by id and emit each chunk as it resolves.
        const boundaries = ctx.pendingBoundaries ?? [];
        await flushBoundaries(controller, boundaries, enc);
      } catch (err) {
        controller.error(err);
        return;
      } finally {
        setActiveSsrContext(previous);
      }
      controller.close();
    },
  });
}

async function flushBoundaries(
  controller: ReadableStreamDefaultController<Uint8Array>,
  boundaries: PendingBoundary[],
  enc: TextEncoder,
): Promise<void> {
  if (boundaries.length === 0) return;
  // Each boundary resolves independently. We enqueue an out-of-order chunk for each as it
  // completes by attaching `.then` and aggregating into a single barrier.
  let remaining = boundaries.length;
  await new Promise<void>((done, fail) => {
    for (const b of boundaries) {
      b.resolve().then(
        (html) => {
          const chunk =
            `<template data-wompo-resolve="${b.id}">${html}</template>` +
            `<script>self.__wompoR("${b.id}")</script>`;
          controller.enqueue(enc.encode(chunk));
          if (--remaining === 0) done();
        },
        (err) => {
          fail(err);
        },
      );
    }
  });
}
