/* Island detection + props payload serialization. */
import { describe, expect, it } from 'vitest';
// @ts-ignore — dist
import { defineWompo, html } from '../../dist/wompo.js';
// @ts-ignore — dist
import { renderToString, devalue } from '../../dist/ssr/index.js';

function extractIslandPayload(html: string, index = 0): unknown {
  const re = new RegExp(
    `data-wompo-island="${index}"[^>]*>\\s*<template data-wompo-props type="application/json">([\\s\\S]*?)<\\/template>`,
  );
  const m = re.exec(html);
  if (!m) throw new Error('no island payload found');
  // Reverse the safeJsonForTemplate `<` -> `<` escape.
  const json = m[1].replace(/\\u003c/g, '<');
  return devalue.parse(json);
}

describe('islands', () => {
  it('component with island default option is marked as island', async () => {
    function Counter({ start = 0 }: any) {
      return html`<span>${start}</span>`;
    }
    defineWompo(Counter, { name: 'isle-counter', island: 'idle' });
    const r = await renderToString(Counter, { start: 5 });
    expect(r.html).toContain('data-wompo-island="0"');
    expect(r.html).toContain('data-wompo-mode="idle"');
    expect(r.islands).toEqual([{ name: 'isle-counter', mode: 'idle', index: 0 }]);
  });

  it('client:* attribute on call site overrides default', async () => {
    function Counter() {
      return html`<i>x</i>`;
    }
    defineWompo(Counter, { name: 'isle-override', island: 'idle' });
    function Page() {
      return html`<${Counter} client:visible />`;
    }
    defineWompo(Page, { name: 'isle-override-page' });
    const r = await renderToString(Page, {});
    expect(r.html).toContain('data-wompo-mode="visible"');
    expect(r.islands[0].mode).toBe('visible');
  });

  it('non-island component does not emit markers', async () => {
    function Plain() {
      return html`<i>x</i>`;
    }
    defineWompo(Plain, { name: 'isle-plain' });
    const r = await renderToString(Plain, {});
    expect(r.html).not.toContain('data-wompo-island');
    expect(r.islands).toEqual([]);
  });

  it('client:load opt-in on a non-default component', async () => {
    function C() {
      return html`<i>x</i>`;
    }
    defineWompo(C, { name: 'isle-optin' });
    function Page() {
      return html`<${C} client:load />`;
    }
    defineWompo(Page, { name: 'isle-optin-page' });
    const r = await renderToString(Page, {});
    expect(r.html).toContain('data-wompo-mode="load"');
  });

  it('client:none opts out of an island default', async () => {
    function C() {
      return html`<i>x</i>`;
    }
    defineWompo(C, { name: 'isle-optout', island: 'idle' });
    function Page() {
      return html`<${C} client:none />`;
    }
    defineWompo(Page, { name: 'isle-optout-page' });
    const r = await renderToString(Page, {});
    expect(r.html).not.toContain('data-wompo-island');
  });

  it('island props payload is serialized as JSON in a <template data-wompo-props>', async () => {
    function C({ count, label, list }: any) {
      return html`<span>${label}:${count}</span>`;
    }
    defineWompo(C, { name: 'isle-payload', island: 'load' });
    const r = await renderToString(C, {
      count: 3,
      label: 'apples',
      list: [1, 2, 3],
    });
    const payload = extractIslandPayload(r.html);
    expect(payload).toEqual({ count: 3, label: 'apples', list: [1, 2, 3] });
  });

  it('strips events, refs, styles, children from the island payload', async () => {
    function C() {
      return html`<i>x</i>`;
    }
    defineWompo(C, { name: 'isle-strip', island: 'load' });
    function Page() {
      const fn = () => {};
      return html`<${C} @click=${fn} foo="keep" />`;
    }
    defineWompo(Page, { name: 'isle-strip-page' });
    const r = await renderToString(Page, {});
    const payload = extractIslandPayload(r.html) as Record<string, unknown>;
    expect(payload.foo).toBe('keep');
    expect(payload).not.toHaveProperty('@click');
    expect(payload).not.toHaveProperty('children');
    expect(payload).not.toHaveProperty('styles');
  });

  it('hydration: "none" skips all islands', async () => {
    function C() {
      return html`<i>x</i>`;
    }
    defineWompo(C, { name: 'isle-none', island: 'load' });
    const r = await renderToString(C, {}, { hydration: 'none' });
    expect(r.html).not.toContain('data-wompo-island');
    expect(r.islands).toEqual([]);
  });

  it('multiple islands get sequential indices', async () => {
    function A() {
      return html`<i>a</i>`;
    }
    defineWompo(A, { name: 'isle-multi-a', island: 'load' });
    function B() {
      return html`<i>b</i>`;
    }
    defineWompo(B, { name: 'isle-multi-b', island: 'visible' });
    function Page() {
      return html`<${A} /><${B} />`;
    }
    defineWompo(Page, { name: 'isle-multi-page' });
    const r = await renderToString(Page, {});
    expect(r.html).toContain('data-wompo-island="0"');
    expect(r.html).toContain('data-wompo-island="1"');
    expect(r.islands.map((i) => i.name)).toEqual(['isle-multi-a', 'isle-multi-b']);
  });
});
