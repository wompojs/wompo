import { html, defineWompo, useState } from 'wompo';

export default function TestComponents() {
	const [items, setItems] = useState([{ title: 'test', content: 'test test' }]);

	const toRender = items.map();

	return html`
		<button @click=${() => setOne(!one)}>One or two</button>
		${one ? items[0] : items[1]}
	`;
}

defineWompo(TestComponents);
