import Counter from './perf-counter.js';

let length = 1000;

while (length--) {
	const counter = new Counter.class();
	document.body.appendChild(counter);
}
