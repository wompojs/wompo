import { html, defineWomp, useState } from '../dist/womp.js';

function Counter() {
	const [counter, setCounter] = useState(0);
	return html`
		<button disabled=${false} @click=${() => setCounter(counter - 1)}>-</button>
		<span>${counter}</span>
		<button @click=${console.log}>+</button>
	`;
}
Counter.componentName = 'counter-component';
Counter.css = `
  .p {
    color: red;
  }
`;

export default defineWomp(Counter);
