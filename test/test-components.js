import { html, defineWompo, useState } from 'wompo';

const Grid = ({ children }) => {
	return html` <div style="display: flex;">${children}</div> `;
};
defineWompo(Grid);

const GridItem = ({ children }) => {
	return html`<div>${children}</div> `;
};
defineWompo(GridItem);

const items = [
	html`
    <${Grid}>
      <${GridItem}>
        One Item
      </${GridItem}>
    </${Grid}>
  `,
	html`
    <${Grid}>
      <${GridItem}>
        One Item
      </${GridItem}>
      <${GridItem}>
        Two Items
      </${GridItem}>
    </${Grid}>
  `,
];

export default function TestComponents() {
	const [one, setOne] = useState(true);

	return html`
		<button @click=${() => setOne(!one)}>One or two</button>
		${one ? items[0] : items[1]}
	`;
}

defineWompo(TestComponents);
