import { html, defineWomp } from '../dist/womp.js';

function ThirdComponent({ styles: s, children }) {
	return html`
		<div>
			<p>Terzo componente!</p>
			${children}
		</div>
	`;
}

export default defineWomp(ThirdComponent);
