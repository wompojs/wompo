import CmxsComponent, { defineCmxsComponent, html } from '../dist/component.js';

export default class OldCounter extends CmxsComponent {
	static componentName = 'old-counter';

	static css = `
    * {
      font-size: 50px;
		}
		.span {
			width: 100px;
			display: inline-block;
			text-align: center;
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

	constructor() {
		super();
	}

	onInit() {
		this.state = {
			counter: 0,
		};
		/* setInterval(() => {
			this.setState((oldState) => ({ counter: oldState.counter + 1 }));
		}, 10); */
	}

	render() {
		const s = this.styles;
		return html`
			<button class="${s.button} ${'static'}" disabled=${false} @click=${null}>-</button>
			<span class="${s.span}">${this.state.counter}</span>
			<button class="${s.button}" @click=${null}>+</button>
		`;
	}
}

defineCmxsComponent(OldCounter);
