import { html, defineWompo, useState } from '../dist/wompo.js';

function SecondComponent({ title }) {
	console.log(title);
	return html`<div>${title}</div>`;
}

export default function Test() {
	const [list, setList] = useState([1, 2, 3]);

	const objects = list.map((el) => {
		return html`<${SecondComponent} title=${`Element ${el}`} />`;
	});

	return html`<div>
		<h1>Elements:</h1>
		${objects}
	</div>`;
}

defineWompo(SecondComponent);
defineWompo(Test);
