import { html, defineWomp, useState, useExposed } from '../dist/womp.js';
import { useTheme, useTodos, useUserReducer } from './counter-component.js';

function SecondComponent({ styles: s, children, counter, name }) {
	const [innerCounter, setInnerCounter] = useState(0);
	const [theme] = useTheme();
	const [user] = useUserReducer();
	const [todos] = useTodos();

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
			<li>Name: ${user.name} ${user.lastname}, Counter: ${counter}</li>
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

export default defineWomp(SecondComponent);
