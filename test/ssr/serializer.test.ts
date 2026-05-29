/* Unit tests for the SSR serializer.
 *
 * These tests intentionally import from the dist/ build so module-instance sharing
 * (server-runtime ↔ render-context) matches production behavior.
 */
import { describe, expect, it } from 'vitest';
// @ts-ignore — JS dist
import {
  defineWompo,
  html,
  attrs,
  useState,
  useMemo,
  useRef,
  useId,
  useContext,
  createContext,
  Suspense,
  useAsync,
  // @ts-ignore
} from '../../dist/wompo.js';
// @ts-ignore — JS dist
import { renderToString } from '../../dist/ssr/index.js';

// Helper: strip extra whitespace between tags for stable assertions.
const compact = (s: string) => s.replace(/\n\s*/g, '').trim();
// The serializer emits `<!--w-->...<!--/w-->` markers around node-position interpolations so the
// hydration runtime can locate the dynamic-node regions, and ` data-wompo-ssr` on every wompo
// component element so the client's connectedCallback skips a destructive re-render. Tests that
// assert on rendered content usually don't care about either; strip them for stable assertions.
const stripMarkers = (s: string) =>
  s.replace(/<!--\/?wc?-->/g, '').replace(/ data-wompo-ssr/g, '');

/* ---------- Primitives & escape ---------- */

describe('serializer: primitives', () => {
  it('renders text + numbers + escapes text content', async () => {
    function Hello({ name }: any) {
      return html`<p>Hi, ${name}! <${'span'}>${42}</${'span'}></p>`;
    }
    defineWompo(Hello, { name: 'prim-hello' });
    const r = await renderToString(Hello, { name: '<bob>' });
    expect(stripMarkers(r.html)).toContain('Hi, &lt;bob&gt;!');
    expect(stripMarkers(r.html)).toContain('<span>42</span>');
  });

  it('skips falsy node values', async () => {
    function F() {
      return html`<p>${null}${undefined}${false}${0}</p>`;
    }
    defineWompo(F, { name: 'prim-falsy' });
    const r = await renderToString(F, {});
    expect(stripMarkers(r.html)).toContain('<p>0</p>');
  });

  it('escapes attribute values', async () => {
    function A({ v }: any) {
      return html`<p title=${v}>x</p>`;
    }
    defineWompo(A, { name: 'prim-attr' });
    const r = await renderToString(A, { v: 'a"b<c' });
    expect(stripMarkers(r.html)).toContain('title="a&quot;b&lt;c"');
  });
});

/* ---------- Attributes / events / properties / spread ---------- */

describe('serializer: attributes', () => {
  it('emits static + interpolated attrs on native elements', async () => {
    function A({ cls, id }: any) {
      return html`<div class=${cls} id=${id} data-static="yes">x</div>`;
    }
    defineWompo(A, { name: 'attr-native' });
    const r = await renderToString(A, { cls: 'foo', id: 'bar' });
    expect(stripMarkers(r.html)).toContain('<div class="foo" id="bar" data-static="yes">x</div>');
  });

  it('skips @event handlers on native elements', async () => {
    function A() {
      const cb = () => {};
      return html`<button @click=${cb} type="button">x</button>`;
    }
    defineWompo(A, { name: 'attr-event-native' });
    const r = await renderToString(A, {});
    expect(r.html).not.toMatch(/@?click=/);
    expect(stripMarkers(r.html)).toContain('type="button"');
  });

  it('emits a primitive prop on a component as an HTML attribute', async () => {
    function Child({ n }: any) {
      return html`<span>${n}</span>`;
    }
    defineWompo(Child, { name: 'attr-child' });
    function Parent() {
      return html`<${Child} n=${7} />`;
    }
    defineWompo(Parent, { name: 'attr-parent' });
    const r = await renderToString(Parent, {});
    expect(stripMarkers(r.html)).toContain('<attr-child n="7"><span>7</span></attr-child>');
  });

  it('attrs() spread on a native element', async () => {
    function A() {
      const bag = attrs({ 'data-a': '1', 'data-b': 'two', disabled: true });
      return html`<button ${bag}>ok</button>`;
    }
    defineWompo(A, { name: 'attr-spread-native' });
    const r = await renderToString(A, {});
    expect(r.html).toMatch(/data-a="1"/);
    expect(r.html).toMatch(/data-b="two"/);
    expect(r.html).toMatch(/ disabled/);
  });

  it('composed attribute (prefix + interp + suffix)', async () => {
    function A({ n }: any) {
      return html`<p title="count=${n}!">x</p>`;
    }
    defineWompo(A, { name: 'attr-composed' });
    const r = await renderToString(A, { n: 3 });
    expect(stripMarkers(r.html)).toContain('title="count=3!"');
  });
});

/* ---------- Children and nested components ---------- */

describe('serializer: nested components', () => {
  it('passes children to a component via ${children}', async () => {
    function Card({ children }: any) {
      return html`<article>${children}</article>`;
    }
    defineWompo(Card, { name: 'nest-card' });
    function App() {
      return html`<${Card}><h1>title</h1><p>body</p></${Card}>`;
    }
    defineWompo(App, { name: 'nest-app' });
    const r = await renderToString(App, {});
    expect(stripMarkers(r.html)).toContain(
      '<nest-card><article><h1>title</h1><p>body</p></article></nest-card>',
    );
  });

  it('wraps re-homed dynamic-tag children in a distinct <!--wc--> marker', async () => {
    // When a parent passes structured children INTO a component via a dynamic tag
    // (`<${Comp}>…children…</${Comp}>`), the component re-homes them through `${children}`. A
    // parent-owned NODE interp inside those children still needs its own `<!--w-->` marker, but the
    // whole re-homed region is wrapped in `<!--wc-->`/`<!--/wc-->` so the parent's hydration adopt()
    // can tell the dynamic-tag children apart from the component's own node interpolations.
    function Link({ children, href }: any) {
      return html`<a href=${href}>${children}</a>`;
    }
    defineWompo(Link, { name: 'wc-link' });
    function Nav({ label }: any) {
      return html`<${Link} href="/x"><span>${label}</span></${Link}>`;
    }
    defineWompo(Nav, { name: 'wc-nav' });
    const r = await renderToString(Nav, { label: 'hello' });
    // The component body wraps re-homed children in <!--wc-->, and the parent-owned ${label} interp
    // keeps its own <!--w--> inside that region.
    expect(r.html).toContain('<a href="/x"><!--wc-->');
    expect(r.html).toContain('<span><!--w-->hello<!--/w--></span>');
    expect(r.html).toContain('<!--/wc--></a>');
  });

  it('renders an array of templates', async () => {
    function Item({ v }: any) {
      return html`<li>${v}</li>`;
    }
    defineWompo(Item, { name: 'nest-item' });
    function List({ items }: any) {
      return html`<ul>${items.map((v: any) => html`<${Item} v=${v} />`)}</ul>`;
    }
    defineWompo(List, { name: 'nest-list' });
    const r = await renderToString(List, { items: ['a', 'b', 'c'] });
    expect(stripMarkers(r.html)).toContain('<nest-item v="a"><li>a</li></nest-item>');
    expect(stripMarkers(r.html)).toContain('<nest-item v="b"><li>b</li></nest-item>');
    expect(stripMarkers(r.html)).toContain('<nest-item v="c"><li>c</li></nest-item>');
  });
});

/* ---------- Shadow DOM ---------- */

describe('serializer: shadow DOM', () => {
  it('wraps rendered output in <template shadowrootmode="open"> when shadow:true', async () => {
    function S() {
      return html`<p>shadowed</p>`;
    }
    defineWompo(S, { name: 'shadow-x', shadow: true });
    const r = await renderToString(S, {});
    expect(stripMarkers(r.html)).toContain('<shadow-x><template shadowrootmode="open"><p>shadowed</p></template></shadow-x>');
  });
});

/* ---------- Hooks runtime ---------- */

describe('serializer: hooks', () => {
  it('useState returns the initial value', async () => {
    function C() {
      const [n] = useState(42);
      return html`<p>${n}</p>`;
    }
    defineWompo(C, { name: 'hook-state' });
    const r = await renderToString(C, {});
    expect(stripMarkers(compact(r.html))).toContain('<p>42</p>');
  });

  it('useMemo runs and returns a value', async () => {
    function C() {
      const sum = useMemo(() => 1 + 2 + 3, []);
      return html`<p>${sum}</p>`;
    }
    defineWompo(C, { name: 'hook-memo' });
    const r = await renderToString(C, {});
    expect(stripMarkers(r.html)).toContain('<p>6</p>');
  });

  it('useRef returns { current: initial }', async () => {
    function C() {
      const ref = useRef({ x: 10 });
      return html`<p>${ref.current.x}</p>`;
    }
    defineWompo(C, { name: 'hook-ref' });
    const r = await renderToString(C, {});
    expect(stripMarkers(r.html)).toContain('<p>10</p>');
  });

  it('useId returns a deterministic id', async () => {
    function C() {
      const a = useId();
      const b = useId();
      return html`<p id=${a}>${b}</p>`;
    }
    defineWompo(C, { name: 'hook-id' });
    const r = await renderToString(C, {});
    expect(r.html).toMatch(/id=":[a-zA-Z0-9_]+:"/);
  });

  it('useContext reads from provider', async () => {
    const Ctx = createContext('default');
    function Child() {
      const v = useContext(Ctx);
      return html`<span>${v}</span>`;
    }
    defineWompo(Child, { name: 'hook-ctx-child' });
    function App() {
      return html`<${Ctx.Provider} value="hello"><${Child} /></${Ctx.Provider}>`;
    }
    defineWompo(App, { name: 'hook-ctx-app' });
    const r = await renderToString(App, {});
    expect(stripMarkers(r.html)).toContain('<span>hello</span>');
  });

  it('useContext default when no provider', async () => {
    const Ctx = createContext('fallback');
    function C() {
      const v = useContext(Ctx);
      return html`<span>${v}</span>`;
    }
    defineWompo(C, { name: 'hook-ctx-default' });
    const r = await renderToString(C, {});
    expect(stripMarkers(r.html)).toContain('<span>fallback</span>');
  });

  it('useAsync resolves before render output', async () => {
    function C() {
      const data = useAsync(() => Promise.resolve('async-data'), []);
      return html`<span>${data ?? 'pending'}</span>`;
    }
    defineWompo(C, { name: 'hook-async' });
    const r = await renderToString(C, {});
    expect(stripMarkers(r.html)).toContain('<span>async-data</span>');
  });
});

/* ---------- Suspense (sync — streaming is in M5) ---------- */

describe('serializer: Suspense', () => {
  it('renders children of Suspense (server awaits async work)', async () => {
    function Slow() {
      const data = useAsync(
        () => new Promise<string>((r) => setTimeout(() => r('ok'), 10)),
        [],
      );
      return html`<i>${data ?? '?'}</i>`;
    }
    defineWompo(Slow, { name: 'susp-slow' });
    function App() {
      return html`<${Suspense} fallback=${html`<b>load</b>`}><${Slow} /></${Suspense}>`;
    }
    defineWompo(App, { name: 'susp-app' });
    const r = await renderToString(App, {});
    expect(stripMarkers(r.html)).toContain('<i>ok</i>');
  });
});

/* ---------- Edge cases ---------- */

describe('serializer: edge cases', () => {
  it('script/style raw-text content is preserved verbatim', async () => {
    function C() {
      return html`<style>.a { color: red; }</style>`;
    }
    defineWompo(C, { name: 'edge-rawtext' });
    const r = await renderToString(C, {});
    expect(stripMarkers(r.html)).toContain('<style>.a { color: red; }</style>');
  });

  it('comments survive', async () => {
    function C() {
      return html`<p><!-- keep me --></p>`;
    }
    defineWompo(C, { name: 'edge-comment' });
    const r = await renderToString(C, {});
    expect(stripMarkers(r.html)).toContain('<!-- keep me -->');
  });

  it('boolean attribute via ?bool=', async () => {
    function Child({ enabled }: any) {
      return html`<span data-on=${enabled ? 'y' : 'n'}>${enabled ? 'on' : 'off'}</span>`;
    }
    defineWompo(Child, { name: 'edge-bool-child' });
    function Parent() {
      return html`<${Child} ?enabled=${true} />`;
    }
    defineWompo(Parent, { name: 'edge-bool-parent' });
    const r = await renderToString(Parent, {});
    expect(stripMarkers(r.html)).toContain('<edge-bool-child enabled>');
    expect(stripMarkers(r.html)).toContain('<span data-on="y">on</span>');
  });
});
