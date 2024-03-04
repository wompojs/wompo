import { html, defineWomp, useState, useEffect } from '../dist/womp.js';

function Counter({ styles: s }) {
	const [counter, setCounter] = useState(0);

	/* useEffect(() => {
		setInterval(() => {
			setCounter((oldValue) => oldValue + 1);
		}, 10);
		return () => clearInterval(interval);
	}, []); */

	return html`
		<button
			class="${s.button} ${'static'}"
			disabled=${false}
			@click=${() => setCounter(counter - 1)}
		>
			-
		</button>
		<span class="${s.span}">${counter}</span>
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
