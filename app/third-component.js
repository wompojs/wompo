import { html, defineWomp } from '../dist/womp.js';

function ThirdComponent({ styles: s, children, counter, name }) {
	return html`
		<div>
			<p>Terzo componente ${name}! ${counter}</p>
			${children}
		</div>
	`;
}

export default defineWomp(ThirdComponent);
