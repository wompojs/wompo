/* Shared component definitions for the "non-island dynamic-tag child" hydration test.
 *
 * `Chip` is deliberately NOT an island: it is SSR'd inert (`data-wompo-ssr`) and must be brought
 * to life by the enclosing `Host` island's hydration pass (`_$hydrateStatic`), adopting its SSR'd
 * DOM in place — no mismatch fallback, no re-render flicker, working internal state afterwards.
 */
import { defineWompo, html, useState } from '../../../dist/wompo.js';

export function Chip({ label = '?', children }) {
  const [n, setN] = useState(0);
  const bump = () => setN(n + 1);
  return html`<span class="chip"><strong>${label}</strong><span data-body>${children}</span><button data-chip-btn @click=${bump}>${n}</button></span>`;
}
defineWompo(Chip, { name: 'hydr-chip' });

export function Host() {
  const [t, setT] = useState(0);
  const bump = () => setT(t + 1);
  return html`
    <button data-host-btn @click=${bump}>${t}</button>
    <${Chip} label=${'L' + t}>
      <em>${'child-' + t}</em>
    </${Chip}>
  `;
}
defineWompo(Host, { name: 'hydr-host', island: 'load' });
