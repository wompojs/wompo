/* Shared component definitions for the "island that owns children re-renders" hydration test.
 *
 * Mirrors the real-world layout shape: a non-island host re-homes route content as `children`
 * into an ISLAND shell (`<${Shell}>…</${Shell}>`). The shell owns interactive state (`open`) and
 * renders `${children}` somewhere in its tree. During hydration the island gets an empty
 * WompoChildren (the SSR'd subtree IS the children), so the re-homed content must (a) survive
 * hydration and (b) survive a subsequent state-driven re-render of the island.
 *
 * Imported BOTH by the happy-dom test AND by a Node subprocess that renders the real server HTML.
 */
import { defineWompo, html, useState } from '../../../dist/wompo.js';

export function Shell({ children }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen(!open);
  return html`
    <button @click=${toggle}>${open ? 'open' : 'closed'}</button>
    <section class=${open ? 'is-open' : 'is-closed'}>${children}</section>
  `;
}
defineWompo(Shell, { name: 'sh-shell', island: 'load' });

export function ShellHost({ label = 'X' }) {
  return html`<${Shell}><p data-content>${label}</p></${Shell}>`;
}
defineWompo(ShellHost, { name: 'sh-host' });
