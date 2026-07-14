/* Shared component definitions for the "children forwarded through a nested component" test.
 *
 * `Btn` mirrors the real-world "Button wraps Link" pattern: it re-homes ITS `${children}` inside
 * a NESTED template (the ternary branch), which the hydrating render cannot adopt in place — it
 * falls back to cloning fresh DOM. Two things must hold for the SSR'd text to survive:
 *  - the enclosing island's adopt() must bind its children dep inside BTN's own
 *    `<!--wc:<id>-->` region (Inner's region comes first in document order — matching on the
 *    owner id, paired with `data-wompo-ssr="<id>"`, disambiguates);
 *  - Btn's hydrating render must collect the real SSR'd children nodes as `props.children` and
 *    re-insert them into the fresh clone instead of rendering an empty children slot.
 */
import { defineWompo, html } from '../../../dist/wompo.js';

export function Inner({ href, children }) {
	return html`<a href=${href}>${children}</a>`;
}
defineWompo(Inner, { name: 'fwd-inner' });

export function Btn({ href, children }) {
	return html`${
		href
			? html`<${Inner} href=${href}><span data-arrow>→</span> ${children}</${Inner}>`
			: html`<button>${children}</button>`
	}`;
}
defineWompo(Btn, { name: 'fwd-btn' });

export function Page({ label = 'Index' }) {
	return html`<div data-top>
    <${Btn} href="/projects">${label}</${Btn}>
  </div>`;
}
defineWompo(Page, { name: 'fwd-page', island: 'load' });
