/* @vitest-environment happy-dom */
/* Hydration runtime tests using happy-dom.
 *
 * Each test renders a component to a string via the SSR, then parses it into a happy-dom
 * Document, runs `hydrate()`, and asserts that the resulting custom elements behave like a
 * fully client-rendered instance (events fire, state updates, attributes reactive).
 */
import { describe, expect, it, beforeEach } from 'vitest';
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

// Wait for a microtask tick so `requestRender` (batched) flushes.
const tick = () => new Promise((r) => setTimeout(r, 0));

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
});
