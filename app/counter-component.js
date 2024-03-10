import {
	html,
	defineWomp,
	useState,
	useEffect,
	useRef,
	useCallback,
	useId,
	useLayoutEffect,
	useMemo,
	useReducer,
	useGlobalState,
} from '../dist/womp.js';
import SecondComponent from './second-component.js';

const userReducer = (prev, action) => {
	if (action.type === 'name') return { name: 'Vaso' };
	if (action.type === 'lastname') return { lastname: 'Kalamara' };
	throw new Error('unknown action type');
};

export const useTheme = useGlobalState('light', { storage: 'theme' });
export const useTodos = useGlobalState([], {
	async: async () => {
		const res = await fetch('https://jsonplaceholder.typicode.com/todos');
		const data = res.json();
		return data;
	},
});
export const useUserReducer = useGlobalState(
	{ name: 'Lorenzo', lastname: 'Lannino' },
	{ reducer: userReducer }
);

function reducer(state, action) {
	if (action.type === 'incremented_age') {
		return {
			age: state.age + 1,
		};
	}
	throw Error('Unknown action.');
}

function Counter({ styles: s, children }) {
	const [counter, setCounter] = useState(0);
	const [state, dispatch] = useReducer(reducer, { age: 20 });
	const [theme, setTheme] = useTheme();
	const [user, dispatchUser] = useUserReducer(true);
	const [todos, setTodos] = useTodos(true);

	const filtered = useMemo(() => {
		return [1, 2, 3, 4, 5].filter((n) => n <= counter);
	}, [counter]);
	console.log(filtered);

	const secondRef = useRef();

	const inc = () => {
		dispatch({ type: 'incremented_age' });
		setCounter((oldCounter) => oldCounter + 1);
		if (secondRef.current) secondRef.current.inc();
		setTheme((oldTheme) => {
			if (oldTheme === 'light') return 'dark';
			return 'light';
		});
		dispatchUser({ type: 'name' });
		setTodos((oldTodos) => {
			oldTodos.push({ title: `Todo ${counter}` });
			return oldTodos;
		});
	};
	const dec = useCallback(() => {
		dispatchUser({ type: 'lastname' });
		setCounter((oldCounter) => oldCounter - 1);
		if (secondRef.current) secondRef.current.inc();
	});

	const idInc = useId();
	const idDec = useId();

	useLayoutEffect(() => {
		console.log('useLayoutEffect');
	}, []);

	useEffect(() => {
		console.log('useEffect');
	}, []);

	return html`
		<button id=${idDec} class=${s.button} @click=${dec}>-</button>
		<span class=${s.span}>${state.age} - ${counter}</span>
		<button id=${idInc} class=${s.button} @click=${inc}>+</button>
		<p>${theme}</p>
		<${SecondComponent} ref=${secondRef} wc-perf />
	`;
}

Counter.css = `
		* {
      font-size: 50px;
		}
		p {
			color: blue;
		}
		.span {
			width: 100px;
			display: inline-block;
			text-align: center;
		}
		.span a {
			color: red;
		}
		.button {
			width: 100px;
			height: 100px;
			border: none;
			border-radius: 10px;
			background-color: seagreen;
			color: white;
		}
`;

export default defineWomp(Counter, {
	shadow: true,
});
