import { html, defineWompo, useState, useRef, createPortal, useEffect } from 'wompo';

export default function ListComponent({ styles: s }) {
	const [value, setValue] = useState([
		{
			id: 'accordion-item',
			props: {
				items: [],
				title: 'Item #1',
			},
		},
		{
			id: 'accordion-item',
			props: {
				items: [],
				title: 'Item #2',
			},
		},
		{
			id: 'accordion-item',
			props: {
				items: [],
				title: 'Item #3',
			},
		},
	]);

	const inputRef = useRef();

	const addItem = () => {
		const title = inputRef.current.value;
		inputRef.current.value = '';
		setValue([
			...value,
			{
				id: 'accordion-item',
				props: {
					title: title,
					items: [],
				},
			},
		]);
	};

	const handleKeyboard = (ev) => {
		if (ev.key === 'Enter') addItem();
	};

	return html`
		<input ref=${inputRef} autocomplete="off" label="Number of items" @keydown=${handleKeyboard} />
		${createPortal(
			html`
				<ul class=${s.list}>
					${value.map((item, i) => {
						return html`<li>${item.props.title}</li>`;
					})}
				</ul>
			`,
			document.body
		)}
	`;
}

ListComponent.css = `
	.list {
		position: fixed;
		bottom: 40px;
		right: 40px;
		background-color: #333;
		color: #fff;
		padding: 20px;
		border-radius: 10px;
	}
`;

defineWompo(ListComponent);

function TestComponents() {
	const [show, setShow] = useState(true);
	useEffect(() => {
		setTimeout(() => {
			setShow(!show);
		}, 5000);
	}, [show]);
	return html`Emmm?? ${show && html`<${ListComponent} />`} `;
}

defineWompo(TestComponents);
