import { html, svg, defineWompo } from 'wompo';

export default function CustomButton({}) {
	const circles = [
		{ x: 20, y: 30 },
		{ x: 50, y: 50 },
		{ x: 80, y: 70 },
	];

	return html`
		<svg style="width: 100px; height: 100px;">
			${circles.map((c, i) => {
				return svg`
					<circle
						cx="${c.x}%"
						cy="${c.y}%"
						r="5"
						stroke="black"
						stroke-width="2"
					/>
				`;
			})}
		</svg>
	`;
}

defineWompo(CustomButton, { name: 'dynamic-svg' });
