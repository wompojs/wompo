# Womp

Womp is a React-like library to create reusable, shareable, and fast Web-Components.

Womp has the following benefits:

- _React-like_ - no need to learn a completely new library. If you know React,
  you already know also Womp. Or at least the 90% of it. If you don't, Womp has a
  super fast learning curve. By simply reading the "Quick start" section, you will
  already know how to build the 80% of your components.
- _Performant_ - Faster than React, Preact, and Atomico, and only slightly slower
  than Lit.
- _Built-in CSS modules_ - With Womp there is no need to worry about style
  collisions: your class names will be automatically replaced with a unique class
  name.
- _Automatic component naming_ - Womp components will generate an automatic name
  for your DOM elements. Your `TodoList` will simply become a "todo-list", right?
- _Re-Usable_ - Unlike other libraries, you don't need a compiler or anything,
  because Womp it's built with native Javascript functionalities. This means you can
  use your components _everywhere_. Wheter you already use React, Angular, Vue,
  or any other library (or none), you will not have to worry about anything, and your
  Womp components will always work.
- _JSX Support_ - Yeah, exactly. If you really can't leave without JSX, we got it
  for you: html check, props validation, and more. Of course, you will need a compiler
  for that.
- _Bundle free_ - With most compiled libraries, you have to create a bundle with
  all your components in order to make it work. With Womp you can even share a single
  component, and it will run _everywhere_ without problems.

## Creating a component

All you will need to do is just create a function and "declare" the component with the helper
function `defineWomp`. This function will have to return the result of the html function, which is
a template function that will contain your HTML structure.

```js
import { defineWomp, html } from 'womp';

export default function GreetingsComponent() {
	return html`<div>Hello, World!</div>`;
}

defineWomp(GreetingsComponent);
```

Then, you can simply render it in you HTML:

```html
<greetings-component></greetings-component>
<!-- Will render: <div>Hello, World!</div> -->
```

## Counter component

Simple example for creating a counter component:

```js
function Counter() {
	const [counter, setCounter] = useState(0);
	const onClick = () => setCounter(counter + 1);
	return html`<button @click=${onClick}>Current value: ${counter}</button>`;
}
```

## JSX

Womp supports JSX. If you use it with Typescript, write this in your `tsconfig.json` file:

```json
"jsx": "react-jsx",
"jsxImportSource": "womp",
```
