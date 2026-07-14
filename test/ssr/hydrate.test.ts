/* @vitest-environment happy-dom */
/* Hydration runtime tests using happy-dom.
 *
 * Each test renders a component to a string via the SSR, then parses it into a happy-dom
 * Document, runs `hydrate()`, and asserts that the resulting custom elements behave like a
 * fully client-rendered instance (events fire, state updates, attributes reactive).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-ignore — dist
import {
  defineWompo,
  html,
  useState,
  useRef,
  // @ts-ignore
} from '../../dist/wompo.js';
// @ts-ignore — dist
import { renderToString } from '../../dist/ssr/index.js';
// @ts-ignore — dist
import { hydrate } from '../../dist/wompo/hydrate.js';
// Side-effect import: registers `hydr-link`/`hydr-menu` in the client registry so `hydrate()` can
// find them. The SAME module is rendered server-side in a Node subprocess (see `ssrFromFixture`).
import './fixtures/nested-island.mjs';
// Side-effect import: registers `cb-parent`/`cb-child` for the cross-island callback-prop test.
import './fixtures/island-callback.mjs';
// Side-effect import: registers `sh-host`/`sh-shell` for the island-with-children re-render test.
import './fixtures/island-children.mjs';
// Side-effect import: registers `hydr-host`/`hydr-chip` for the non-island dynamic-tag child test.
import './fixtures/static-child.mjs';
// Side-effect import: registers `fwd-page`/`fwd-btn`/`fwd-inner` for the forwarded-children test.
import './fixtures/forwarded-children.mjs';

// Wait for a microtask tick so `requestRender` (batched) flushes.
const tick = () => new Promise((r) => setTimeout(r, 0));

const DIST_SSR = resolve(process.cwd(), 'dist/ssr/index.js');
const NESTED_ISLAND_FIXTURE = resolve(process.cwd(), 'test/ssr/fixtures/nested-island.mjs');
const CALLBACK_ISLAND_FIXTURE = resolve(process.cwd(), 'test/ssr/fixtures/island-callback.mjs');
const CHILDREN_ISLAND_FIXTURE = resolve(process.cwd(), 'test/ssr/fixtures/island-children.mjs');
const STATIC_CHILD_FIXTURE = resolve(process.cwd(), 'test/ssr/fixtures/static-child.mjs');
const FORWARDED_CHILDREN_FIXTURE = resolve(
  process.cwd(),
  'test/ssr/fixtures/forwarded-children.mjs',
);

/* Render the `rootExport` of a fixture module to a string in a *real* Node process (no `document`).
 *
 * This test file runs under happy-dom, which defines `document` — that flips wompo's `IS_SERVER`
 * (`typeof document === 'undefined'`) to false, so `html` takes its client branch and DROPS the
 * value at each closing dynamic tag (`</${Comp}>`). That misaligns `parts`/`values` and corrupts
 * the SSR output (the dynamic-tag subtree gets truncated). Production SSR always runs in Node where
 * `IS_SERVER` is true, so to exercise hydration against *real* server output we render in a Node
 * subprocess. The fixture module is also imported by the test itself so the client-side registry
 * has the same components available for `hydrate()`. */
function ssrFromFixture(
  fixturePath: string,
  rootExport: string,
  props: Record<string, unknown>,
): string {
  const src = `import { ${rootExport} } from ${JSON.stringify(fixturePath)};
import { renderToString } from ${JSON.stringify(DIST_SSR)};
const r = await renderToString(${rootExport}, ${JSON.stringify(props)});
process.stdout.write(r.html);`;
  const tmp = `/tmp/wompo-hydrate-ssr-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`;
  writeFileSync(tmp, src);
  try {
    return execSync(`node ${JSON.stringify(tmp)}`, { encoding: 'utf8' });
  } finally {
    unlinkSync(tmp);
  }
}

beforeEach(() => {
  // Clean DOM between tests
  document.body.innerHTML = '';
});

describe('hydrate', () => {
  it('binds click events to an SSR\'d island', async () => {
    function Counter({ start = 0 }: any) {
      const [count, setCount] = useState(start);
      const inc = () => setCount(count + 1);
      return html`<button @click=${inc}>${count}</button>`;
    }
    defineWompo(Counter, { name: 'hydr-counter', island: 'load' });

    const r = await renderToString(Counter, { start: 5 });
    document.body.innerHTML = r.html;
    expect(document.body.innerHTML).toContain('data-wompo-island="0"');

    hydrate(document);
    await tick();

    const btn = document.querySelector('button')!;
    expect(btn.textContent?.trim()).toBe('5');
    btn.dispatchEvent(new Event('click'));
    await tick();
    expect(btn.textContent?.trim()).toBe('6');
  });

  it('hydration removes data-wompo-island marker', async () => {
    function C() {
      return html`<i>hi</i>`;
    }
    defineWompo(C, { name: 'hydr-cleanup', island: 'load' });
    const r = await renderToString(C, {});
    document.body.innerHTML = r.html;
    hydrate(document);
    await tick();
    const el = document.querySelector('hydr-cleanup');
    expect(el?.hasAttribute('data-wompo-island')).toBe(false);
    expect(el?.hasAttribute('data-wompo-mode')).toBe(false);
  });

  it('non-island components are not hydrated', async () => {
    function C() {
      return html`<i>plain</i>`;
    }
    defineWompo(C, { name: 'hydr-plain' });
    const r = await renderToString(C, {});
    document.body.innerHTML = r.html;
    hydrate(document);
    await tick();
    // Element renders, no marker
    expect(document.body.innerHTML).toContain('plain');
    expect(document.body.innerHTML).not.toContain('data-wompo-island');
  });

  it('passes island props from JSON payload', async () => {
    function Greet({ name }: any) {
      return html`<p>Hello ${name}</p>`;
    }
    defineWompo(Greet, { name: 'hydr-greet', island: 'load' });
    const r = await renderToString(Greet, { name: 'Wompo' });
    document.body.innerHTML = r.html;
    hydrate(document);
    await tick();
    const p = document.querySelector('p')!;
    expect(p.textContent?.replace(/\s+/g, '')).toBe('HelloWompo');
  });

  it('non-string props (numbers, arrays) survive hydration', async () => {
    function List({ items }: any) {
      return html`<ul>${items.map((v: number) => html`<li>${v}</li>`)}</ul>`;
    }
    defineWompo(List, { name: 'hydr-list', island: 'load' });
    const r = await renderToString(List, { items: [1, 2, 3] });
    document.body.innerHTML = r.html;
    hydrate(document);
    await tick();
    const items = document.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[0].textContent?.trim()).toBe('1');
    expect(items[2].textContent?.trim()).toBe('3');
  });

  it('hydrates a dynamic-tag nested island with structured children + a node interp', async () => {
    // Regression for: `[wompo] hydration mismatch in <sub-menu>: expected '<!--w-->' at node
    // index 2, got <a> — falling back to client render`. A parent island uses `<${Link}>` (itself
    // an island) with structured children that contain a parent-owned NODE interp (`${t}` inside a
    // <span>). The Link component re-homes those children into its own `<a>${children}</a>` render
    // output, interposing a `<template data-wompo-props>` and the `<a>` wrapper between the dynamic
    // tag element and the span. The parent's adopt walker must still bind: the dynamic TAG, the
    // re-homed NODE interp (inside the <a>), and the trailing <div>'s attribute dep.
    // The `Link`/`Menu` components live in ./fixtures/nested-island.mjs (imported above) so that
    // the real server HTML can be generated in a Node subprocess where IS_SERVER is true.
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));
    try {
      const serverHtml = ssrFromFixture(NESTED_ISLAND_FIXTURE, 'Menu', { start: 'hello' });
      document.body.innerHTML = serverHtml;
      hydrate(document);
      await tick();

      expect(warnings.some((w) => w.includes('hydration mismatch'))).toBe(false);

      const span = document.querySelector('hydr-menu span')!;
      const div = document.querySelector('hydr-menu div[data-panel]')!;
      expect(span.textContent?.trim()).toBe('hello');
      expect(div.getAttribute('class')).toBe('panel-hello');

      // The span physically lives inside the nested island's <a>; updating the parent's state must
      // still drive that re-homed NODE dep and the trailing <div>'s class dep.
      const btn = document.querySelector('hydr-menu button')!;
      btn.dispatchEvent(new Event('click'));
      await tick();
      expect(span.textContent?.trim()).toBe('hello!');
      expect(div.getAttribute('class')).toBe('panel-hello!');
    } finally {
      console.warn = origWarn;
    }
  });

  it('dependencies after a multi-child node interpolation still resolve', async () => {
    // Regression: a node interpolation whose value is an array of nested templates emits multiple
    // element/comment children between `<!--w-->` and `<!--/w-->`. The adopt walker used to let
    // its node counter drift past the next dep, falling back to a destructive client render. The
    // marker `data-from-attr` on the trailing <p> only survives if hydration succeeds.
    function Hero({ words = [], body = '' }: any) {
      return html`
        <section>
          <h1>${words.map((w: string) => html`<span>${w}</span>`)}</h1>
          <p data-from-attr=${body}>${body}</p>
        </section>
      `;
    }
    defineWompo(Hero, { name: 'hydr-hero', island: 'load' });
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));
    try {
      const r = await renderToString(Hero, { words: ['a', 'b', 'c'], body: 'tail' });
      document.body.innerHTML = r.html;
      hydrate(document);
      await tick();
      const p = document.querySelector('p')!;
      expect(p.getAttribute('data-from-attr')).toBe('tail');
      expect(p.textContent?.trim()).toBe('tail');
      expect(warnings.some((w) => w.includes('hydration mismatch'))).toBe(false);
    } finally {
      console.warn = origWarn;
    }
  });

  it('passes a callback prop from a parent island to a child island', async () => {
    // Real-world "interactive layout" shape: a parent island owns state + a `bump` callback and
    // passes it (plus a serializable `count`) to a child island whose button calls it. Functions
    // can't ride the JSON island payload, so this asserts the parent's hydration re-render assigns
    // the live function onto the already-present child element BEFORE the child island merges its
    // own (callback-less) serialized props — and that a child-button click drives parent state,
    // which then re-propagates `count` back into the child island.
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));
    try {
      const serverHtml = ssrFromFixture(CALLBACK_ISLAND_FIXTURE, 'Parent', { start: 0 });
      document.body.innerHTML = serverHtml;
      hydrate(document);
      await tick();

      expect(warnings.some((w) => w.includes('hydration mismatch'))).toBe(false);

      const out = document.querySelector('cb-parent > output')!;
      const em = document.querySelector('cb-child em')!;
      expect(out.textContent?.trim()).toBe('0');
      expect(em.textContent?.trim()).toBe('0');

      const btn = document.querySelector('cb-child button')!;
      btn.dispatchEvent(new Event('click'));
      await tick();
      expect(out.textContent?.trim()).toBe('1');
      expect(em.textContent?.trim()).toBe('1');
    } finally {
      console.warn = origWarn;
    }
  });

  it('island that owns re-homed children keeps them across a state re-render', async () => {
    // Layout shape: a non-island host re-homes route content as `children` into an island shell
    // that owns interactive state. The re-homed `<p data-content>` must survive both hydration
    // and the island's subsequent state-driven re-render (the menu-toggle case). Regression guard
    // against the empty-WompoChildren re-render wiping the SSR'd children.
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));
    try {
      const serverHtml = ssrFromFixture(CHILDREN_ISLAND_FIXTURE, 'ShellHost', { label: 'kept' });
      document.body.innerHTML = serverHtml;
      hydrate(document);
      await tick();

      expect(warnings.some((w) => w.includes('hydration mismatch'))).toBe(false);

      const content = () => document.querySelector('sh-shell p[data-content]');
      const section = document.querySelector('sh-shell section')!;
      const btn = document.querySelector('sh-shell button')!;
      expect(content()?.textContent?.trim()).toBe('kept');
      expect(btn.textContent?.trim()).toBe('closed');
      expect(section.getAttribute('class')).toBe('is-closed');

      // Toggle the island's own state: the class flips, and the re-homed child must still be there.
      btn.dispatchEvent(new Event('click'));
      await tick();
      expect(btn.textContent?.trim()).toBe('open');
      expect(section.getAttribute('class')).toBe('is-open');
      expect(content()?.textContent?.trim()).toBe('kept');
    } finally {
      console.warn = origWarn;
    }
  });

  it('brings a NON-island dynamic-tag child to life when the enclosing island hydrates', async () => {
    // `<${Chip}>…</${Chip}>` directly in an island template, where Chip is a plain (non-island)
    // component whose class IS loaded client-side. Two regressions guarded here:
    //  1. The upgraded child used to drop `data-wompo-ssr` in connectedCallback BEFORE the island
    //     adopted, so adopt() missed the dynamic-tag frame and threw "expected '<!--w-->' …, got
    //     <span>" → destructive client re-render on every load.
    //  2. The child used to stay INERT (no events, no state) unless wrapped in a redundant
    //     `${html`…`}`; now the island's hydration pass calls `_$hydrateStatic()` on it.
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));
    try {
      const ssrHtml = ssrFromFixture(STATIC_CHILD_FIXTURE, 'Host', {});
      expect(ssrHtml).toContain('<hydr-chip');
      document.body.innerHTML = ssrHtml;

      hydrate(document);
      await tick();
      expect(warnings.some((w) => w.includes('hydration mismatch'))).toBe(false);

      const chip = document.querySelector('hydr-chip')!;
      // Hydrated in place (marker consumed by _$hydrateStatic), not left inert.
      expect(chip.hasAttribute('data-wompo-ssr')).toBe(false);

      // The child's own state is live: its internal button increments.
      const chipBtn = chip.querySelector('[data-chip-btn]')!;
      expect(chipBtn.textContent?.trim()).toBe('0');
      chipBtn.dispatchEvent(new Event('click'));
      await tick();
      expect(chipBtn.textContent?.trim()).toBe('1');

      // A parent re-render updates both the re-homed children region and the child's prop.
      const hostBtn = document.querySelector('[data-host-btn]')!;
      hostBtn.dispatchEvent(new Event('click'));
      await tick();
      await tick();
      expect(chip.querySelector('[data-body]')?.textContent).toContain('child-1');
      expect(chip.querySelector('strong')?.textContent?.trim()).toBe('L1');
      // The child's own state survives the parent's prop-driven re-render.
      expect(chipBtn.textContent?.trim()).toBe('1');
    } finally {
      console.warn = origWarn;
    }
  });

  it('keeps children forwarded through a nested component across hydration', async () => {
    // Regression: an island renders `<${Btn}>Index</${Btn}>` and `Btn` re-homes its ${children}
    // INSIDE a nested template branch (`${href ? html`<${Inner}>…${children}…</${Inner}>` : …}`).
    // Nested templates are not adopted — the hydrating render clones them fresh — so the SSR'd
    // "Index" text used to vanish: children were seeded EMPTY during hydration, and the island's
    // adopt() bound its "Index" dep to the wrong `<!--wc-->` region (Inner's own children region
    // starts first in document order). Owner-tagged `<!--wc:<id>-->` markers + collecting the real
    // SSR'd nodes as props.children keep the content alive.
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));
    try {
      const ssrHtml = ssrFromFixture(FORWARDED_CHILDREN_FIXTURE, 'Page', { label: 'Index' });
      expect(ssrHtml).toContain('Index');
      document.body.innerHTML = ssrHtml;

      hydrate(document);
      await tick();
      expect(warnings.some((w) => w.includes('hydration mismatch'))).toBe(false);

      const a = document.querySelector('fwd-page a')!;
      expect(a.getAttribute('href')).toBe('/projects');
      // Both the sibling rendered by Btn's own template AND the forwarded children survive.
      expect(a.querySelector('[data-arrow]')?.textContent).toBe('→');
      expect(a.textContent).toContain('Index');
    } finally {
      console.warn = origWarn;
    }
  });
});
