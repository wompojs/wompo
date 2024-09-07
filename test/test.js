import { html, defineWompo, useState, useContext, createContext } from '../dist/wompo.js';

const Context = createContext(null);

function SecondComponent({ title }) {
	console.log(title);
	return html`<${ThirdComponent} title=${title}></${ThirdComponent}>`;
}

function ThirdComponent({ title }) {
	console.log(title);
	return html`<h1>${title}</h1>`;
}

export default function Test() {
	const ctx = useContext(Context);
	const [counter, setCounter] = useState(0);

	const inc = () => [setCounter(counter + 1)];

	return html`<div>
		<${SecondComponent} title="Element Super ${counter}" />
		<button @click=${inc}>${counter}</button>
	</div>`;
}

defineWompo(ThirdComponent);
defineWompo(SecondComponent);
defineWompo(Test);
