import { useEffect, html, defineWompo, useState } from 'wompo';

export default function Test() {
	const [counter, setCounter] = useState(0);

	const inc = () => [setCounter(counter + 1)];

	useEffect(() => {
		console.log('rendered Test');
	}, []);

	return html`<div>
		<button @click=${inc}>${counter}</button>
	</div>`;
}

defineWompo(Test);
