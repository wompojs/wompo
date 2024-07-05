import { html, defineWompo, useState, useExposed, useContext } from '../dist/wompo.js';
import { ThemeProvider } from './counter-component.js';

export default function SecondComponent({ styles: s, children, counter, name }) {
	const [innerCounter, setInnerCounter] = useState(0);
	const theme = useContext(ThemeProvider);
	const todos = { data: [] };

	const inc = () => {
		setInnerCounter(innerCounter + 1);
	};

	useExposed({ inc, counter });

	return html`
		<ul>
			<li>
				<button @click=${this.inc}>Inc</button>
				Secondo componente ${theme} ${innerCounter}!
			</li>
			<li>Name: ${name}, Counter: ${counter}</li>
			${todos.state === 'loading'
				? html`<li>Loading...</li>`
				: todos.state === 'hasError'
				? html`<li>Error</li>`
				: todos.data.map((todo) => html`<li>${todo.title}</li>`)}
			<li>${children}</li>
		</ul>
	`;
}
SecondComponent.css = `
	li {
		color: blue;
	}
`;

defineWompo(SecondComponent);
