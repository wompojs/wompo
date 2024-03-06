import { html, defineWomp } from '../dist/womp.js';

function ThirdComponent({ styles: s, children, counter }) {
	return html`
		<div>
			<p>Terzo componente! ${counter}</p>
			${children}
		</div>
	`;
}

export default defineWomp(ThirdComponent);
