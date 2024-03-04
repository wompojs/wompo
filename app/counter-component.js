import { html, defineWomp, useState } from '../dist/womp.js';

function Counter({ styles: s }) {
	const [counter, setCounter] = useState(0);
	return html`
		<button class=${s.button} disabled=${false} @click=${() => setCounter(counter - 1)}>-</button>
		<span class=${s.span}>${counter}</span>
		<button class=${s.button} @click=${() => setCounter(counter + 1)}>+</button>
	`;
}
Counter.componentName = 'counter-component';
Counter.css = `
		* {
      font-size: 50px;
		}
		.span {
			width: 100px;
			display: inline-block;
			text-align: center;
		}
		.button {
			width: 100px;
			height: 100px;
			border: none;
			border-radius: 10px;
			background-color: seagreen;
			color: white;
		}
`;

export default defineWomp(Counter);
