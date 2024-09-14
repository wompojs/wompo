import { Suspense, useAsync, useEffect } from 'wompo';
import { html, defineWompo, useState, useContext, createContext } from '../dist/wompo.js';

const Context = createContext(null);

const request = async () => {
	console.log('requesting data...');
	const res = await fetch('https://jsonplaceholder.typicode.com/todos');
	const json = await res.json();
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(json);
		}, 3000);
	});
};

const AsyncComp = () => {
	const counter = useContext(Context);
	const data = useAsync(request, [Math.floor(counter / 5)]);
	useEffect(() => {
		console.log('rendered AsyncComp');
		return () => {
			console.log('removed');
		};
	}, []);

	return html`
		<p>Counter: ${counter}</p>
		<p>
			Data:
			<ul>
				${data?.map((el) => html`<li>${el.id} - ${el.title}</li>`)}
			</ul>
		</p>
	`;
};

defineWompo(AsyncComp);

const AsyncCompNoSus = () => {
	const counter = useContext(Context);
	const data = useAsync(request, [Math.floor(counter / 5)], false);
	useEffect(() => {
		console.log('rendered AsyncComp');
		return () => {
			console.log('removed');
		};
	}, []);

	return html`
		<p>Counter: ${counter}</p>
		<p>
			Data:
			<ul>
				${data?.map((el) => html`<li>${el.id} - ${el.title}</li>`)}
			</ul>
		</p>
	`;
};
defineWompo(AsyncCompNoSus);

export default function AsyncTest() {
	const [counter, setCounter] = useState(0);

	const inc = () => [setCounter(counter + 1)];

	useEffect(() => {
		console.log('rendered Test');
	}, []);

	return html`<div>
		<${Context.Provider} value=${counter}>
			<button @click=${inc}>${counter}</button>
      <${Suspense} fallback=${html`Loading...`}>
        DOESNT TRIGGER SUSPENSE
				<${AsyncCompNoSus} />
			</${Suspense}>
      <hr />
      <${Suspense}>
        NO FALLBACK
				<${AsyncComp} />
			</${Suspense}>
      <hr />
			<${Suspense} fallback=${html`Loading...`}>
      FALLBACK
				<${AsyncComp} />
			</${Suspense}>
		</${Context.Provider}>
	</div>`;
}

defineWompo(AsyncTest);
