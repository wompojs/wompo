import { html, defineWomp } from '../dist/womp.js';

export default function ThirdComponent({ styles: s, children, counter, name }) {
	return html`
		<div>
			<p>Terzo componente ${name}! ${counter}</p>
			${children}
		</div>
	`;
}

defineWomp(ThirdComponent, {
	shadow: true,
});
