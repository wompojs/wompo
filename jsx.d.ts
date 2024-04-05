interface DOMGenericProperties {
	style?: string | Partial<CSSStyleDeclaration> | object;
	class?: string;
	id?: string;
	slot?: string;
	part?: string;
	is?: string;
	tabindex?: string | number;
	role?: string;
	width?: string | number;
	height?: string | number;
	[key: string]: any;
}

interface DOMEvents {
	[event: `on${string}`]: (ev: Event) => void;
}

export namespace JSX {
	interface IntrinsicElements {
		[elemName: string]: DOMGenericProperties & DOMEvents;
	}
}
