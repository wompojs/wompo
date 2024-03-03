export interface WompProps {
	children?: NodeList;
	[key: string]: any;
}

export interface RenderHtml {
	parts: TemplateStringsArray;
	values: any[];
	__womp: true;
}

export interface WompComponent {
	(props: WompProps): (props: WompProps) => RenderHtml;
	componentName: string;
	css: string;
}

export interface WompElement extends HTMLElement {
	state: any[];
	props: { [key: string]: any };
}

interface WompElementStatic {
	new (): any;
	template: HTMLTemplateElement;
	getOrCreateTemplate(renderHtml: RenderHtml): HTMLTemplateElement;
}

interface Dependency {
	type: number;
	index: number | number[];
	node: ChildNode | Attr;
	name?: string;
}

/* 
================================================
START WOMP
================================================
*/

const DEV_MODE = true;

let currentRenderingComponent: WompElement = null;
let currentHookIndex: number = 0;
const WC_MARKER = '$wc$';
const isAttrRegex = /\s+([^\s]*?)="?$/g;
const selfClosingRegex = /(<([a-x]*?-[a-z]*).*?)\/>/g;

const NODE = 0;
const ATTR = 1;

/**
 * Generates the static styles of a component.
 * @returns The generated styles specific to the component
 */
const generateSpecifcStyles = (component: WompComponent) => {
	const componentCss = component.css || '';
	const invalidSelectors: string[] = [];
	if (DEV_MODE) {
		// It's appropriate that at least one class is present in each selector
		[...componentCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
			const cssSelector = selector[1].trim();
			if (!cssSelector.includes('.')) invalidSelectors.push(cssSelector);
		});
		invalidSelectors.forEach((selector) => {
			console.warn(
				`The CSS selector "${selector} {...}" in the component "${component.componentName}" is not enough specific: include at least one class.\n`
			);
		});
	}
	const classNames = new Set<string>();
	[...componentCss.matchAll(/\.(.*?)[\s|{]/gm)].forEach((match) => {
		const className = match[1];
		classNames.add(className);
	});
	let generatedCss = componentCss;
	classNames.forEach((className) => {
		const uniqueClassName = `${component.componentName}__${className}`;
		generatedCss = generatedCss.replaceAll(className, uniqueClassName);
	});
	return generatedCss;
};

const createHtml = (parts: TemplateStringsArray) => {
	console.time('Create HTML');
	let html = '';
	const length = parts.length - 1;
	let attrDelimiter = '';
	let consecutiveAttributes = 0;
	for (let i = 0; i < length; i++) {
		let part = parts[i];
		// If the Regex is global, it will start from the index past the end of the last match.
		isAttrRegex.lastIndex = 0;
		const isAttr = isAttrRegex.exec(part);
		// End of values inside an attribute
		if (attrDelimiter && part.trim()[0] === attrDelimiter) {
			part = part.replace(attrDelimiter, '');
			attrDelimiter = '';
			html += `"${consecutiveAttributes}"`;
			consecutiveAttributes = 0;
		}
		if (isAttr) {
			const [match, attrName] = isAttr;
			const beforeLastChar = match[match.length - 2];
			attrDelimiter = beforeLastChar === '"' || beforeLastChar === "'" ? beforeLastChar : '';
			const prevPart = part.substring(0, isAttr.index);
			let toAdd = `${prevPart} ${attrName}${WC_MARKER}=`;
			if (attrDelimiter) toAdd += `"${WC_MARKER}`;
			else toAdd += '"0"';
			html += toAdd;
		} else if (attrDelimiter) {
			html += part + `${WC_MARKER}`;
		} else {
			html += part + `<?${WC_MARKER}>`;
		}
	}
	html += parts[parts.length - 1];
	html = html.replace(selfClosingRegex, '$1></$2>');
	console.timeEnd('Create HTML');
	return html;
};

const traverse = (
	childNodes: NodeList,
	values: any[],
	index: number,
	dependencies: Dependency[]
) => {
	const dependencyValue = values[index];
	for (const childNode of childNodes) {
		const child = childNode as HTMLElement;
		const attributes = child.attributes;
		if (attributes) {
			const toRemove = [];
			const toSet = [];
			for (const attr of attributes) {
				const attrName = attr.name;
				if (attrName.endsWith(WC_MARKER)) {
					const name = attrName.substring(0, attrName.length - WC_MARKER.length);
					const attrValue = attr.value;
					const dependency: Dependency = {
						type: ATTR,
						name: name,
						node: child,
						index: index,
					};
					if (attrValue !== '0') {
					} else {
						toRemove.push(attrName);
						if (!child.nodeName.includes('-')) {
							if (name[0] === '@') {
								//! Handle events
							} else if (dependencyValue !== false) {
								toSet.push({ name: name, value: dependencyValue });
							}
						}
					}
					dependencies.push(dependency);
					index++;
				}
			}
			for (const name of toRemove) {
				child.removeAttribute(name);
			}
			for (const attr of toSet) {
				child.setAttribute(attr.name, attr.value);
			}
		} else if (child.nodeName === '#comment' && (childNode as Comment).data === `?${WC_MARKER}`) {
			(childNode as Comment).after(dependencyValue);
			const dependency: Dependency = {
				type: NODE,
				name: '',
				node: childNode.nextSibling,
				index: index,
			};
			dependencies.push(dependency);
			index++;
		}
		traverse(child.childNodes, values, index, dependencies);
	}
};

const womp = (Component: WompComponent): WompElementStatic => {
	// const styles = generateSpecifcStyles(Component);
	const WompComponent = class extends HTMLElement implements WompElement {
		state: any[] = [];
		props: { [key: string]: any };
		ROOT: this | ShadowRoot;

		static template: HTMLTemplateElement;

		static getOrCreateTemplate(renderHtml: RenderHtml) {
			const { values, parts } = renderHtml;
			if (!this.template) {
				const dom = createHtml(parts);
				const template = document.createElement('template');
				template.innerHTML = dom;
				const dependencies: Dependency[] = [];
				console.time('Traverse');
				traverse(template.content.childNodes, values, 0, dependencies);
				console.timeEnd('Traverse');
				this.template = template;
				console.log(dependencies);
			}
			return this.template;
		}

		constructor() {
			super();
			this.initElement();
		}

		/** @override component is connected to DOM */
		connectedCallback() {}

		/**
		 * Initializes the component with the state, props, and styles.
		 */
		private initElement() {
			console.time('Init');
			const constructor = this.constructor as typeof WompComponent;
			this.ROOT = this;
			currentRenderingComponent = this;
			currentHookIndex = 0;
			const result = Component.call(this, {});
			let renderHtml: RenderHtml = result as RenderHtml;
			if (typeof result === 'string' || result instanceof HTMLElement) renderHtml = html`${result}`;
			const template = constructor.getOrCreateTemplate(renderHtml);
			const clone = template.cloneNode(true) as HTMLTemplateElement;
			this.ROOT.replaceChildren(...clone.content.childNodes);
			// TODO: Clone and set dependencies
			// TODO: Events
			console.timeEnd('Init');
		}
	};
	return WompComponent;
};

export function defineWomp(component: WompComponent) {
	const Component = womp(component);
	customElements.define(component.componentName, Component);
	return Component;
}

/* 
================================================
HOOKS
================================================
*/

export const useState = <State>(defaultValue: State) => {
	const component = currentRenderingComponent;
	if (!component.state.hasOwnProperty(currentHookIndex)) {
		const index = currentHookIndex;
		component.state[index] = {
			value: defaultValue,
			setter: (newValue: State) => {
				component.state[index].value = newValue;
			},
		};
	}
	const state = component.state[currentHookIndex];
	currentHookIndex++;
	return [state.value, state.setter];
};

/* 
================================================
HTML
================================================
*/

/**
 * Elaborate the string representation of the rendering content of the component.
 *
 * This function must be called without the use of the parentheses, like in the following example:
 *
 * @example
 * ```javascript
 * render(){
 *   return html`<div>Hello World!</div>`;
 * }
 * ```
 * @param template The list of string to concatenate with the values
 * @param values The list of values to concatenate with the templates
 */
export function html(templateParts: TemplateStringsArray, ...values: any[]): RenderHtml {
	return {
		parts: templateParts,
		values: values,
		__womp: true,
	};
}
