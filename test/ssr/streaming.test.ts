/* Streaming Suspense tests.
 *
 * Verifies that:
 *  - renderToStream emits a shell first that contains the fallback wrapped in <wompo-boundary>.
 *  - Pending useAsync work resolves AFTER the shell has flushed — confirming the consumer can
 *    paint the fallback before the slow promise resolves.
 *  - Resolved chunks carry <template data-wompo-resolve="…"> + a runtime activation <script>.
 */
import { describe, expect, it } from 'vitest';
// @ts-ignore — dist
import { defineWompo, html, Suspense, useAsync } from '../../dist/wompo.js';
// @ts-ignore — dist
import { renderToStream } from '../../dist/ssr/index.js';

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

describe('streaming Suspense', () => {
  it('flushes the shell with fallback BEFORE async resolves', async () => {
    let resolveAsync!: (v: string) => void;
    const slowPromise = new Promise<string>((r) => {
      resolveAsync = r;
    });
    function Slow() {
      const data = useAsync(() => slowPromise, []);
      return html`<i data-test="slow">${data ?? ''}</i>`;
    }
    defineWompo(Slow, { name: 'sstream-slow' });

    function Page() {
      return html`<div>
        <${Suspense} fallback=${html`<b data-test="fallback">Loading...</b>`}>
          <${Slow} />
        </${Suspense}>
      </div>`;
    }
    defineWompo(Page, { name: 'sstream-page' });

    const stream = renderToStream(Page, {});
    const reader = stream.getReader();
    const dec = new TextDecoder();
    let collected = '';

    // Read until we see the fallback marker.
    let sawFallback = false;
    while (!sawFallback) {
      const { value, done } = await reader.read();
      if (done) break;
      collected += dec.decode(value);
      if (collected.includes('Loading...')) sawFallback = true;
    }
    expect(sawFallback).toBe(true);
    expect(collected).toContain('<wompo-boundary id="B0">');
    expect(collected).toContain('Loading...');
    // The slow content has NOT been emitted yet.
    expect(collected).not.toContain('data-test="slow"');

    // Resolve the async work — the resolution chunk should follow.
    resolveAsync('the-data');

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      collected += dec.decode(value);
    }

    expect(collected).toContain('<template data-wompo-resolve="B0">');
    expect(collected).toContain('the-data');
    expect(collected).toContain('self.__wompoR("B0")');
  });

  it('renders inline (no boundary) when no descendant has pending async', async () => {
    function Fast() {
      return html`<i>fast</i>`;
    }
    defineWompo(Fast, { name: 'sstream-fast' });

    function Page() {
      return html`<div>
        <${Suspense} fallback=${html`<b>Loading</b>`}>
          <${Fast} />
        </${Suspense}>
      </div>`;
    }
    defineWompo(Page, { name: 'sstream-page-2' });

    const full = await collectStream(renderToStream(Page, {}));
    expect(full).toContain('<i>fast</i>');
    expect(full).not.toContain('<wompo-boundary id=');
    expect(full).not.toContain('<template data-wompo-resolve');
  });

  it('multiple boundaries resolve independently', async () => {
    let resolveA!: (v: string) => void;
    let resolveB!: (v: string) => void;
    const pA = new Promise<string>((r) => { resolveA = r; });
    const pB = new Promise<string>((r) => { resolveB = r; });

    function A() {
      const d = useAsync(() => pA, []);
      return html`<u>${d ?? ''}</u>`;
    }
    defineWompo(A, { name: 'sstream-a' });
    function B() {
      const d = useAsync(() => pB, []);
      return html`<u>${d ?? ''}</u>`;
    }
    defineWompo(B, { name: 'sstream-b' });
    function Page() {
      return html`<div>
        <${Suspense} fallback=${html`<i>la</i>`}><${A}/></${Suspense}>
        <${Suspense} fallback=${html`<i>lb</i>`}><${B}/></${Suspense}>
      </div>`;
    }
    defineWompo(Page, { name: 'sstream-page-3' });

    const stream = renderToStream(Page, {});
    // Kick off resolution after a tick, in reverse order.
    queueMicrotask(() => resolveB('B-done'));
    setTimeout(() => resolveA('A-done'), 5);

    const full = await collectStream(stream);
    expect(full).toContain('B-done');
    expect(full).toContain('A-done');
    // B should appear before A in the stream because it resolved first.
    expect(full.indexOf('B-done')).toBeLessThan(full.indexOf('A-done'));
  });
});
