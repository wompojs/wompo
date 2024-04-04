# Wompo

Wompo is a React-like library to create reusable, shareable, and fast Web-Components.

Wompo has the following benefits:

- _React-like_ - no need to learn a completely new library. If you know React,
  you already know also Wompo. Or at least the 90% of it.
- _Easy_ - If you don't, Wompo has a super fast learning curve: no need to learn
  Typescript, understanding Javascript classes, and the **this** keyword. All you
  need to know is basic Javascript, basic HTML, and basic CSS.
- _Performant_ - Faster than React, Preact, and Atomico, and only slightly slower
  than Lit.
- _Lightweight_ - Wompo weights less than 5Kb compressed and gzipped!
- _Built-in CSS modules_ - With Wompo there is no need to worry about styles
  collisions: your class names will be automatically replaced with a unique class
  name.
- _Automatic component naming_ - Wompo components will generate an automatic name
  for your DOM elements. Your `TodoList` will simply become a "todo-list", right?
- _Re-Usable_ - Unlike other libraries, you don't need a compiler or anything,
  because Wompo it's built with native Javascript functionalities. This means you can
  use your components _everywhere_. Wheter you already use React, Angular, Vue,
  or any other library (or none), you will not have to worry about anything, and your
  Wompo components will always work.
- _JSX Support_ - Yeah, exactly. If you really can't leave without JSX, we got it
  for you: html check, props validation, and more. Of course, you will need a compiler
  for that.
- _Bundle free_ - With most compiled libraries, you have to create a bundle with
  all your components in order to make it work. With Wompo you can even share a single
  component, and it will run _everywhere_ without problems.

## Creating a component

All you will need to do is just create a function and "declare" the component with the helper
function `defineWompo`. This function will have to return the result of the html function, which is
a template function that will contain your HTML structure.

```js
import { defineWompo, html } from 'wompo';

export default function GreetingsComponent() {
	return html`<div>Hello, World!</div>`;
}

defineWompo(GreetingsComponent);
```

Then, you can simply render it in you HTML:

```html
<greetings-component></greetings-component>
<!-- Will render: <div>Hello, World!</div> -->
```

## Counter component

Simple example for creating a counter component:

```js
import { defineWompo, html, useState } from 'wompo';

function Counter() {
	const [counter, setCounter] = useState(0);
	const onClick = () => setCounter(counter + 1);
	return html`<button @click=${onClick}>Current value: ${counter}</button>`;
}

defineWompo(Counter, { name: 'simple-counter' });
```

## No default Shadow DOM

Shadow DOM is cool, but not always, for the following reasons:

- CSS Styling can be difficult for external developers.
- Most of third party libraries usually require to select elements through
  document.querySelector, which will not work with Shadow DOM.
- For the same reason above, most testing libraries will not work (or need
  additional code to make it work).

For these reasons, Wompo components are by default NOT inside a Shadow DOM.
Instead, you can style your components through Built-in CSS modules.

## Built-in CSS Modules

You can style your components by adding a `.css` property in your functional
component. The class names found in there will automatically be replaced with
a more unique class. For example, the "container" class for the "CoolComponent"
will be replaced with "cool-component\__container". Of course, you don't need to
know the name of the replaced class: they will be put into the \_styles_ prop
object of your component, like below:

```javascript
function CoolComponent({ styles: s }) {
	return html`<div class=${s.container}>
		I have No shadow DOM, but I still won't affect other components' styles!
	</div>`;
}
CoolComponent.css = `
  .container {
    padding: 20px;
    background-color: blue;
    border-radius:
  }
`;
```

## JSX

Wompo supports JSX. If you use it with Typescript, write this in your `tsconfig.json` file:

```json
"jsx": "react-jsx",
"jsxImportSource": "wompo",
```
