import { html, defineWompo, useState, useRef, createPortal } from 'wompo';

export default function TestComponents({ styles: s }) {
	const [value, setValue] = useState([
		{
			id: 'accordion-item',
			props: {
				items: [],
				title: 'Accordion Item #1',
			},
		},
		{
			id: 'accordion-item',
			props: {
				items: [],
				title: 'Accordion Item #2',
			},
		},
		{
			id: 'accordion-item',
			props: {
				items: [],
				title: 'Accordion Item #3',
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
	const editItem = (ev, index) => {
		if (ev.isTrusted) {
			const newTitle = ev.currentTarget.value;
			setValue(
				value.map((item, i) =>
					i === index ? { ...item, props: { ...item.props, title: newTitle } } : item
				)
			);
		}
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

TestComponents.css = `
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

defineWompo(TestComponents);
