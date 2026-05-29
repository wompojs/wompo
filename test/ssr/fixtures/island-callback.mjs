/* Shared component definitions for the cross-island callback-prop hydration test.
 *
 * Mirrors the real-world "interactive layout" shape: a PARENT island owns state and a callback
 * (`bump`), and passes that callback + a serializable value down to a CHILD island. The child's
 * button calls the parent-provided callback. Functions cannot cross the JSON island payload, so
 * this verifies that the parent island's hydration re-render assigns the live function onto the
 * already-present child element (via `updateProp`) BEFORE the child island merges its own
 * (callback-less) serialized props — leaving the callback intact.
 *
 * Imported BOTH by the happy-dom test (client registry) AND by a Node subprocess that renders the
 * real server HTML (see `ssrFromFixture` in hydrate.test.ts), so it must be a plain ESM module.
 */
import { defineWompo, html, useState } from '../../../dist/wompo.js';

export function Child({ onPing, count }) {
  return html`<button @click=${onPing}>ping</button><em>${count}</em>`;
}
defineWompo(Child, { name: 'cb-child', island: 'load' });

export function Parent({ start = 0 }) {
  const [count, setCount] = useState(start);
  const bump = () => setCount(count + 1);
  return html`
    <output>${count}</output>
    <${Child} onPing=${bump} count=${count} />
  `;
}
defineWompo(Parent, { name: 'cb-parent', island: 'load' });
