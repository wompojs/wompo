/* CSS extraction tests.
 *
 * Verifies that the SSR result's `css` map and `headTags` reflect:
 *  - which components were rendered (light DOM ⇒ included)
 *  - shadow DOM exclusion (their CSS lives inside the declarative shadow template)
 *  - dedup when the same component is rendered N times
 *  - css: 'none' ⇒ empty map, no headTags
 *  - css: 'extract' ⇒ map populated, headTags empty
 */
import { describe, expect, it } from 'vitest';
// @ts-ignore — dist
import { defineWompo, html } from '../../dist/wompo.js';
// @ts-ignore — dist
import { renderToString } from '../../dist/ssr/index.js';

describe('css extraction', () => {
  it('light-DOM components contribute CSS to the map', async () => {
    function Card({ styles }: any) {
      return html`<div class=${styles.box}>x</div>`;
    }
    (Card as any).css = '.box { color: red }';
    defineWompo(Card, { name: 'css-card', cssModule: true });

    const r = await renderToString(Card, {});
    expect(r.css.has('css-card')).toBe(true);
    expect(r.css.get('css-card')).toContain('css-card__box');
  });

  it('shadow components are excluded from inline by default', async () => {
    function ShadowOne() {
      return html`<i>s</i>`;
    }
    (ShadowOne as any).css = ':host { display: block }';
    defineWompo(ShadowOne, { name: 'css-shadow', shadow: true });

    const r = await renderToString(ShadowOne, {});
    expect(r.css.has('css-shadow')).toBe(false);
    expect(r.headTags).toBe('');
  });

  it('dedupes identical components rendered multiple times', async () => {
    function Item({ n, styles }: any) {
      return html`<li class=${styles.row}>${n}</li>`;
    }
    (Item as any).css = '.row { padding: 4px }';
    defineWompo(Item, { name: 'css-item', cssModule: true });
    function List() {
      return html`<ul>
        <${Item} n=${1} />
        <${Item} n=${2} />
        <${Item} n=${3} />
      </ul>`;
    }
    (List as any).css = '.list { margin: 0 }';
    defineWompo(List, { name: 'css-list', cssModule: true });

    const r = await renderToString(List, {});
    // The map keys are unique component names; the rule appears once in the inline block.
    const occurrences = (r.headTags.match(/css-item__row/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("css: 'extract' populates map but emits no inline block", async () => {
    function P({ styles }: any) {
      return html`<p class=${styles.txt}>hi</p>`;
    }
    (P as any).css = '.txt { font-weight: bold }';
    defineWompo(P, { name: 'css-extract-p', cssModule: true });

    const r = await renderToString(P, {}, { css: 'extract' });
    expect(r.css.size).toBeGreaterThan(0);
    expect(r.headTags).toBe('');
  });

  it("css: 'none' yields empty map and empty headTags", async () => {
    function Q() {
      return html`<span>q</span>`;
    }
    (Q as any).css = 'span { color: blue }';
    defineWompo(Q, { name: 'css-none-q', cssModule: false });

    const r = await renderToString(Q, {}, { css: 'none' });
    expect(r.css.size).toBe(0);
    expect(r.headTags).toBe('');
  });

  it('inline block carries CSP nonce when provided', async () => {
    function W() {
      return html`<u>w</u>`;
    }
    (W as any).css = 'u { text-decoration: underline }';
    defineWompo(W, { name: 'css-nonce-w', cssModule: false });
    const r = await renderToString(W, {}, { nonce: 'abc123' });
    expect(r.headTags).toMatch(/<style[^>]*nonce="abc123"/);
  });
});
