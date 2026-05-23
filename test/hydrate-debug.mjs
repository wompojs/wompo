// Debug: trace what happens during hydration of a counter island.
import { Window } from 'happy-dom';
const w = new Window();
globalThis.window = w;
globalThis.document = w.document;
globalThis.HTMLElement = w.HTMLElement;
globalThis.customElements = w.customElements;
globalThis.Event = w.Event;
globalThis.MouseEvent = w.MouseEvent;
globalThis.MutationObserver = w.MutationObserver;
globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
globalThis.CSSStyleSheet = w.CSSStyleSheet;
globalThis.NodeFilter = w.NodeFilter;

const { defineWompo, html, useState } = await import('../dist/wompo.js');
const { renderToString } = await import('../dist/ssr/index.js');
const { hydrate } = await import('../dist/wompo/hydrate.js');

function Counter({ start = 0 }) {
  const [count, setCount] = useState(start);
  console.log('  [render] start=' + start + ' typeof start=' + typeof start + ' count=' + count + ' typeof count=' + typeof count);
  const inc = () => {
    console.log('  [inc] count=' + count + ' typeof=' + typeof count + '  -> setCount(' + (count + 1) + ')');
    setCount(count + 1);
  };
  return html`<button @click=${inc}>${count}</button>`;
}
defineWompo(Counter, { name: 'hydr-counter', island: 'load' });

const r = await renderToString(Counter, { start: 5 });
console.log('SSR html:');
console.log(r.html);
console.log();
document.body.innerHTML = r.html;
console.log('After innerHTML set:');
const host = document.querySelector('hydr-counter');
console.log('  start attribute =', JSON.stringify(host.getAttribute('start')));
console.log('  __isHydrating =', host.__isHydrating);
console.log('  __connected =', host.__connected);
console.log('  _$initialProps =', JSON.stringify(host._$initialProps));
console.log('  props.start =', host.props?.start, 'typeof', typeof host.props?.start);
console.log('--- hydrate(document) ---');
hydrate(document);
await new Promise((r) => setTimeout(r, 0));
console.log('After hydrate:');
console.log('  _$initialProps =', JSON.stringify(host._$initialProps));
console.log('  props.start =', host.props.start, 'typeof', typeof host.props.start);
const btn = document.querySelector('button');
console.log('  button textContent =', JSON.stringify(btn.textContent));

console.log('--- click ---');
btn.dispatchEvent(new w.Event('click'));
await new Promise((r) => setTimeout(r, 0));
console.log('After click, button textContent =', JSON.stringify(btn.textContent));
