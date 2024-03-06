import { html, defineWomp, useState } from '../dist/womp.js';

function SecondComponent({ styles: s, children, counter, name }) {
	const [innerCounter, setInnerCounter] = useState(0);
	console.log(children[1]);
	return html`
		<ul>
			<li @click=${() => setInnerCounter(innerCounter + 1)}>Secondo componente ${innerCounter}!</li>
			<li>Name: ${name}, Counter: ${counter}</li>
			<li>${children}</li>
		</ul>
	`;
}

export default defineWomp(SecondComponent);
