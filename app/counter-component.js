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
} from '../dist/womp.js';
import SecondComponent from './second-component.js';

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

	const filtered = useMemo(() => {
		return [1, 2, 3, 4, 5].filter((n) => n <= counter);
	}, [counter]);

	console.log(filtered);

	const secondRef = useRef();

	const inc = useCallback(() => {
		dispatch({ type: 'incremented_age' });
		// setCounter((oldCounter) => oldCounter + 1);
		secondRef.current.inc();
	});
	const dec = useCallback(() => {
		setCounter((oldCounter) => oldCounter - 1);
		secondRef.current.inc();
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
		<span class=${s.span}>${state.age}</span>
		<button id=${idInc} class=${s.button} @click=${inc}>+</button>
		<${SecondComponent} ref=${secondRef} counter=${counter} />
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
