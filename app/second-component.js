import { html, defineWomp, useState } from '../dist/womp.js';

function SecondComponent({ styles: s, children, counter, name }) {
	const [innerCounter, setInnerCounter] = useState(0);
	return html`
		<ul>
			<li>
				<button @click=${() => setInnerCounter(innerCounter + 1)}>Inc</button>
				Secondo componente ${innerCounter}!
			</li>
			<li>Name: ${name}, Counter: ${counter}</li>
			<li>${children}</li>
		</ul>
	`;
}

export default defineWomp(SecondComponent);
