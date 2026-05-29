/* Shared component definitions for the dynamic-tag nested-island hydration test.
 *
 * This module is imported BOTH by the happy-dom test (so the client registry can find the
 * components during `hydrate()`) AND by a Node subprocess that renders the real server HTML (see
 * `ssrFromFixture` in hydrate.test.ts). Keeping the definitions in one plain ESM module avoids the
 * vite source transform that would otherwise rewrite `html`/`useState` references when the test
 * `.toString()`s an inline function — those rewrites are undefined in a raw Node process.
 */
import { defineWompo, html, useState } from '../../../dist/wompo.js';

export function Link({ children, href }) {
  return html`<a href=${href}>${children}</a>`;
}
defineWompo(Link, { name: 'hydr-link', island: 'load' });

export function Menu({ start = 'x' }) {
  const [t, setT] = useState(start);
  const bump = () => setT(t + '!');
  return html`
    <button @click=${bump}>inc</button>
    <${Link} href="/x">
      <span>${t}</span>
      <svg><path d="M0"></path></svg>
    </${Link}>
    <div class=${`panel-${t}`} data-panel>inner</div>
  `;
}
defineWompo(Menu, { name: 'hydr-menu', island: 'load' });
