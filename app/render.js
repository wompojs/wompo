import Counter from './counter-component.js';

let length = 1000;

while (length--) {
	const counter = new Counter();
	document.body.appendChild(counter);
}
