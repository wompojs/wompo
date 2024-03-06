import { html, defineWomp, useState } from '../dist/womp.js';

function SecondComponent({ styles: s, children, counter, name }) {
	const [innerCounter, setInnerCounter] = useState(0);
	console.log('rendered');
	return html`
		<div>
			<p @click=${() => setInnerCounter(innerCounter + 1)}>Secondo componente ${innerCounter}!</p>
			<p>Name: ${name}, Counter: ${counter}</p>
			${children}
		</div>
	`;
}

export default defineWomp(SecondComponent);
