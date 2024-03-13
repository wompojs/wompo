import { html, defineWomp, useState } from '../dist/womp.js';

function Counter({ styles: s }) {
	const [counter, setCounter] = useState(0);

	const inc = () => {
		setCounter(counter + 1);
	};
	const dec = () => {
		setCounter(counter - 1);
	};

	return html`
		<button class=${s.button} @click=${dec}>-</button>
		<span class=${s.span}>${counter}</span>
		<button class=${s.button} @click=${inc}>+</button>
	`;
}
Counter.css = `
		* {
      font-size: 50px;
		}
		p {
			color: blue;
		}
		.span {
			width: 100px;
			display: inline-block;
			text-align: center;
		}
		.span a {
			color: red;
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
