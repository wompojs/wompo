import { html, defineWomp, useState, useExposed } from '../dist/womp.js';

function SecondComponent({ styles: s, children, counter, name }) {
	const [innerCounter, setInnerCounter] = useState(0);
	const inc = () => {
		setInnerCounter(innerCounter + 1);
	};

	useExposed({ inc, counter });

	return html`
		<ul>
			<li>
				<button @click=${this.inc}>Inc</button>
				Secondo componente ${innerCounter}!
			</li>
			<li>Name: ${name}, Counter: ${counter}</li>
			<li>${children}</li>
		</ul>
	`;
}
SecondComponent.css = `
	li {
		color: blue;
	}
`;

export default defineWomp(SecondComponent);
