<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg" alt="Wompo" width="300" height="141">
  </source>
  <source media="(prefers-color-scheme: light)" srcset="./assets/logo.svg" alt="Wompo" width="300" height="141">
  </source>
  <img src="./assets/logo.svg" alt="Wompo" width="300" height="141">
</picture>

### Fast, React-like, Web-Components.


[![Published on npm](https://img.shields.io/npm/v/wompo.svg?logo=npm)](https://www.npmjs.com/package/wompo)

</div>


### Documentation

Check the full documentation for Wompo at [wompo.dev](https://wompo.dev).

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/wompo)

### Quick Example: Counter

Creating a custom Counter component is very easy with Wompo, and works exactly like React!

```js
import { defineWompo, html } from 'wompo';

export default function CounterComponent({ styles: s }) {
  const [count, setCount] = useState(0);
  const inc = () => setCount(count + 1);
  return html`<button class=${s.button} @click=${inc}>
    Current value: ${count}
  </button>`;
}

CounterComponent.css = `
  .button {
    border-radius: 10px;
    background-color: #573ef6;
    color: #fff;
    padding: 10px 20px;
    border: none;
  }
`

defineWompo(CounterComponent);
```

Then, you can simply render it in you HTML:

```html
<counter-component></counter-component>
<!-- Will render: <button>Current value: 0!</button> -->
```

## Server-Side Rendering

Wompo ships a string-based SSR engine and a client-side hydration runtime. The same `defineWompo`
components render on the server, hydrate selectively on the client (islands-first), and stream
suspended content out of order.

### Render to string

```js
import { renderToString } from 'wompo/ssr';
import Counter from './counter.js';

const { html, headTags, css, islands } = await renderToString(Counter, { start: 5 });
// html:    `<counter-component ...>…</counter-component>`
// headTags: inline `<style>` block with the CSS of every component used (dedup'd)
// css:     Map<componentName, css> for extraction into separate files
// islands: per-component hydration metadata (name, mode, doc-order index)
```

### Streaming Suspense

```js
import { renderToStream, BOUNDARY_RUNTIME_SCRIPT } from 'wompo/ssr';

const stream = renderToStream(Page, props);
// → ReadableStream<Uint8Array>:
//   1. <script>__wompoR=…</script> + <style> + shell with <wompo-boundary id="Bn">FALLBACK</…>
//   2. for each resolved boundary (in completion order):
//      <template data-wompo-resolve="Bn">…real content…</template>
//      <script>self.__wompoR("Bn")</script>
```

The runtime script (~140 bytes) swaps each `<template data-wompo-resolve>` into its
`<wompo-boundary>` placeholder as chunks arrive.

### Islands & hydration

A component becomes an island by passing `island: 'load' | 'idle' | 'visible'` to `defineWompo`,
or by writing `client:load|idle|visible` on the call site (the attribute wins). The server
emits `data-wompo-island` plus a `<template data-wompo-props>` carrying its initial props
serialized with a minimal devalue-style codec (supports `Date`, `Map`, `Set`, `BigInt`,
cycles, `undefined`, `NaN`, `Infinity`).

```js
// Page.js (server)
defineWompo(MyCounter, { name: 'my-counter', island: 'visible' });
```

```js
// Page.client.js (loaded by the document shell)
import { hydrate } from 'wompo/hydrate';
hydrate(document);
// Each [data-wompo-island] is hydrated per its mode:
//   load    → immediately
//   idle    → requestIdleCallback (fallback setTimeout)
//   visible → IntersectionObserver with rootMargin: 200px
```

On a structural mismatch between the SSR'd DOM and what the component would clone, hydration
falls back to a destructive re-render with a `console.warn`.

### Server Actions

```js
import { defineAction } from 'wompo/ssr';

export const addItem = defineAction(async (name) => {
  // …hit a DB, queue, etc.
  return { id: 1, name };
});
```

`defineAction` returns the function as-is on the server. When the wrapped reference is passed
through an island's props payload, the client receives a `{__wompoAction: '<id>'}` marker and
substitutes a fetch proxy hitting your framework's `/_action/:id` endpoint. The companion
[`seawomp`](https://github.com/wompojs/seawomp) framework wires this endpoint up for you.

### Build / link

```sh
npm run build      # tsc + esbuild → dist/
```

`dist/wompo.js` (core), `dist/ssr/index.js` (SSR + actions + stream), and `dist/wompo/hydrate.js`
(client) are the published subpaths.
