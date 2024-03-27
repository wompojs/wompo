import { html, defineWomp, useState } from '../dist/womp.js';

export default function Counter({ styles: s }) {
	const [counter, setCounter] = useState(0);

	const inc = () => {
		setCounter(counter + 1);
	};
	const dec = () => {
		setCounter(counter - 1);
	};

	return html`
		<button @click=${dec}>-</button>
		<span>${counter}</span>
		<button @click=${inc}>+</button>
	`;
}
Counter.css = `
		* {
      font-size: 50px;
		}
		span {
			width: 100px;
			display: inline-block;
			text-align: center;
		}
		button {
			width: 100px;
			height: 100px;
			border: none;
			border-radius: 10px;
			background-color: seagreen;
			color: white;
		}
`;

defineWomp(Counter, { cssModule: false });
