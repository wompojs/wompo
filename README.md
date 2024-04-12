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

### JSX

Wompo supports JSX. If you use it with Typescript, write this in your `tsconfig.json` file:

```json
"jsx": "react-jsx",
"jsxImportSource": "wompo",
```
