import {
	html,
	defineWomp,
	useState,
	useRef,
	useCallback,
	useId,
	useReducer,
	createContext,
	lazy,
	Suspense,
	useAsync,
	/* useGlobalState, */
} from '../dist/womp.js';

function delayForDemo(promise, ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	}).then(() => promise);
}

const SecondComponent = lazy(() => delayForDemo(import('./second-component.js'), 4000));
const PerfCounter = lazy(() => delayForDemo(import('./perf-counter.js'), 10000));

export const ThemeProvider = createContext('light');

function reducer(state, action) {
	if (action.type === 'incremented_age') {
		return {
			age: state.age + 1,
		};
	}
	throw Error('Unknown action.');
}

const fetchResults = async () => {
	const res = await new Promise((resolve, reject) => {
		setTimeout(() => {
			reject();
		}, 5000);
	}).catch((err) => {
		return '❌ Errore!';
	});
	return res;
};

function Results() {
	const [counter, setCounter] = useState(10);
	const data = useAsync(() => fetchResults(), [counter]);
	return html`<button @click=${() => setCounter(counter + 1)}>${counter}</button> ${data}`;
}
defineWomp(Results);

export default function Counter({ styles: s, children }) {
	const [counter, setCounter] = useState(0);
	const [state, dispatch] = useReducer(reducer, { age: 20 });
	const [theme, setTheme] = useState('dark');
	/* const [theme, setTheme] = useTheme();
	const [user, dispatchUser] = useUserReducer(true);
	const [todos, setTodos] = useTodos(true); */

	/* const filtered = useMemo(() => {
		return [1, 2, 3, 4, 5].filter((n) => n <= counter);
	}, [counter]);
	console.log(filtered); */

	const secondRef = useRef();

	const inc = () => {
		dispatch({ type: 'incremented_age' });
		setCounter((oldCounter) => oldCounter + 1);
		// if (secondRef.current) secondRef.current.inc();
		setTheme((oldTheme) => {
			if (oldTheme === 'light') return 'dark';
			return 'light';
		});
		// dispatchUser({ type: 'name' });
		/* setTodos((oldTodos) => {
			oldTodos.push({ title: `Todo ${counter}` });
			return oldTodos;
		}); */
	};
	const dec = useCallback(() => {
		// dispatchUser({ type: 'lastname' });
		setCounter((oldCounter) => oldCounter - 1);
		if (secondRef.current) secondRef.current.inc();
	});

	const idInc = useId();
	const idDec = useId();

	/* useLayoutEffect(() => {
		console.log('useLayoutEffect');
	}, []);

	useEffect(() => {
		console.log('useEffect');
	}, []); */

	return html`
		<button id=${idDec} class=${s.button} @click=${dec}>-</button>
		<span class=${s.span}>${state.age} - ${counter}</span>
		<button id=${idInc} class=${s.button} @click=${inc}>+</button>
		<p>${theme}</p>
		<${ThemeProvider.Provider} value=${theme}>
			<${Suspense} fallback=${html`<i>Loading...</i>`}>
				<${Results} />
			</${Suspense}>
			<${Suspense} fallback=${html`<i>Loading...</i>`}>
				<${SecondComponent} ref=${secondRef} wc-perf name="Lorenzo" counter=${counter} />
				<${Suspense} fallback=${html`<i>Loading...</i>`}>
					<${PerfCounter} ref=${secondRef} wc-perf name="Lorenzo" counter=${counter} />
				</${Suspense}>
			</${Suspense}>
		</${ThemeProvider.Provider}>
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

defineWomp(Counter, {
	shadow: true,
	name: 'counter-component-test',
});
