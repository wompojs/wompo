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

interface WompElementClass {
	new (): any;
	cachedTemplate: CachedTemplate;
	getOrCreateTemplate(parts: TemplateStringsArray): CachedTemplate;
}

interface Dependency {
	type: number;
	index: number | number[];
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
const isInsideTextTag = /<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi;
const onlyTextChildrenElementsRegex = /^(?:script|style|textarea|title)$/i;

const NODE = 0;
const ATTR = 1;

const treeWalker = document.createTreeWalker(
	document,
	129 // NodeFilter.SHOW_{ELEMENT|COMMENT}
);

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

//* OK
//! HTML Nested fare il "join" delle dependencies
const createHtml = (parts: TemplateStringsArray): [string, string[]] => {
	let html = '';
	const attributes = [];
	const length = parts.length - 1;
	let attrDelimiter = '';
	let textTagName = '';
	for (let i = 0; i < length; i++) {
		let part = parts[i];
		// End of values inside an attribute
		if (attrDelimiter && part.includes(attrDelimiter)) attrDelimiter = '';
		// End of values inside a text node (script, textarea, title, style)
		if (textTagName && new RegExp(`<\/${textTagName}>`)) textTagName = '';
		if (attrDelimiter || textTagName) {
			// We are inside an attribute
			html += part + WC_MARKER;
		} else {
			// If the Regex is global, it will start from the index past the end of the last match.
			isAttrRegex.lastIndex = 0;
			const isAttr = isAttrRegex.exec(part);
			if (isAttr) {
				const [match, attrName] = isAttr;
				const beforeLastChar = match[match.length - 2];
				attrDelimiter = beforeLastChar === '"' || beforeLastChar === "'" ? beforeLastChar : '';
				part = part.substring(0, part.length - 1);
				let toAdd = `${part}${WC_MARKER}=`;
				if (attrDelimiter) toAdd += `"${WC_MARKER}`;
				else toAdd += '"0"';
				html += toAdd;
				attributes.push(attrName);
			} else {
				isInsideTextTag.lastIndex = 0;
				const insideTextTag = isInsideTextTag.exec(part);
				if (insideTextTag) {
					textTagName = insideTextTag[1];
					html += part + WC_MARKER;
				} else {
					// It's a child node
					html += part + `<?${WC_MARKER}>`;
				}
			}
		}
	}
	html += parts[parts.length - 1];
	html = html.replace(selfClosingRegex, '$1></$2>');
	return [html, attributes];
};

const createDependencies = (
	template: HTMLTemplateElement,
	parts: TemplateStringsArray,
	attributes: string[]
) => {
	const dependencies = [];
	treeWalker.currentNode = template.content;
	let node: Element;
	let dependencyIndex = 0;
	let nodeIndex = 0;
	const partsLength = parts.length;
	while (((node as Node) = treeWalker.nextNode()) !== null && dependencies.length < partsLength) {
		// Is a "normal" node
		if (node.nodeType === 1) {
			if (node.hasAttributes()) {
				const attributeNames = node.getAttributeNames();
				for (const attrName of attributeNames) {
					if (attrName.endsWith(WC_MARKER)) {
						const realName = attributes[dependencyIndex++];
						const attrValue = node.getAttribute(attrName);
						const dependency: Dependency = {
							type: ATTR,
							index: nodeIndex,
							name: realName,
						};
						if (attrValue !== '0') {
							const dynamicParts = attrValue.split(WC_MARKER);
							for (const _ of dynamicParts) {
								const dependency: Dependency = {
									type: ATTR,
									index: nodeIndex,
									name: realName,
								};
								dependencies.push(dependency);
							}
						} else {
							dependencies.push(dependency);
						}
						node.removeAttribute(attrName);
					}
				}
			}
			// A text node should be created for each dynamic part inside of
			// nodes that only have text nodes inside (script, style, textarea, title).
			if (onlyTextChildrenElementsRegex.test(node.tagName)) {
				const strings = node.textContent!.split(WC_MARKER);
				const lastIndex = strings.length - 1;
				if (lastIndex > 0) {
					node.textContent = '';
					for (let i = 0; i < lastIndex; i++) {
						node.append(strings[i], document.createComment(''));
						// Walk past the marker node we just added
						treeWalker.nextNode();
						dependencies.push({ type: NODE, index: ++nodeIndex });
					}
					// Note: because this marker is added after the walker's current
					// node, it will be walked to in the outer loop (and ignored), so
					// we don't need to adjust nodeIndex here
					node.append(strings[lastIndex], document.createComment(''));
				}
			}
		} else if (node.nodeType === 8) {
			// Is a comment
			const data = (node as unknown as Comment).data;
			if (data === `?${WC_MARKER}`) {
				dependencies.push({ type: NODE, index: nodeIndex });
			} else {
				//! Capisci sta roba
				// let i = -1;
				// while ((i = (node as unknown as Comment).data.indexOf(WC_MARKER, i + 1)) !== -1) {
				// 	// Comment node has a binding marker inside, make an inactive part
				// 	// The binding won't work, but subsequent bindings will
				// 	dependencies.push({ type: COMMENT_PART, index: nodeIndex });
				// 	// Move to the end of the match
				// 	i += WC_MARKER.length - 1;
				// }
			}
		}
		nodeIndex++;
	}
	return dependencies;
};

class DynamicNode {
	public startNode: ChildNode;
	public endNode: ChildNode | null;
	public index: number;
	public isNode = true;

	constructor(startNode: ChildNode, endNode: ChildNode | null, index: number) {
		this.startNode = startNode;
		this.endNode = endNode;
		this.index = index;
	}
}

class DynamicAttribute {
	public node: HTMLElement;
	public name: string;
	public index: number;
	public isNode = false;

	private _callback: (event: Event) => void;
	private eventInitialized = false;

	constructor(node: HTMLElement, name: string, index: number) {
		this.node = node;
		this.name = name;
		this.index = index;
	}

	set callback(callback: (event: Event) => void) {
		if (!this.eventInitialized) {
			const eventName = this.name.substring(1);
			this.node.addEventListener(eventName, this.listener.bind(this));
			this.eventInitialized = true;
		}
		this._callback = callback;
	}

	private listener(event: Event) {
		if (this._callback) this._callback(event);
	}
}

class CachedTemplate {
	public template: HTMLTemplateElement;
	public dependencies: Dependency[];

	constructor(template: HTMLTemplateElement, dependencies: Dependency[]) {
		this.template = template;
		this.dependencies = dependencies;
	}

	public clone(): [DocumentFragment, (DynamicNode | DynamicAttribute)[]] {
		const content = this.template.content;
		const dependencies = this.dependencies;
		const fragment = document.importNode(content, true);
		treeWalker.currentNode = fragment;
		let node = treeWalker.nextNode();
		let nodeIndex = 0;
		let dynamicIndex = 0;
		let templateDependency = dependencies[0];
		const dynamics = [];
		while (templateDependency !== undefined) {
			if (nodeIndex === templateDependency.index) {
				let dynamic: DynamicNode | DynamicAttribute;
				if (templateDependency.type === NODE) {
					dynamic = new DynamicNode(
						node as HTMLElement,
						node.nextSibling,
						templateDependency.index
					);
				} else if (templateDependency.type === ATTR) {
					dynamic = new DynamicAttribute(
						node as HTMLElement,
						templateDependency.name,
						templateDependency.index
					);
				}
				dynamics.push(dynamic);
				templateDependency = dependencies[++dynamicIndex];
			}
			if (nodeIndex !== templateDependency?.index) {
				node = treeWalker.nextNode()!;
				nodeIndex++;
			}
		}
		treeWalker.currentNode = document;
		return [fragment, dynamics];
	}
}

const setValues = (dynamics: (DynamicNode | DynamicAttribute)[], values: any[]) => {
	for (let i = 0; i < dynamics.length; i++) {
		const currentDependency = dynamics[i];
		const currentValue = values[i];
		if (currentDependency.isNode) {
			(currentDependency as DynamicNode).startNode.after(currentValue);
			(currentDependency as DynamicNode).endNode = (currentValue as HTMLElement).nextSibling;
		} else {
			const attrName = (currentDependency as DynamicAttribute).name;
			if (attrName.startsWith('@')) {
				(currentDependency as DynamicAttribute).callback = currentValue;
			} else {
				const node = (currentDependency as DynamicAttribute).node;
				if (currentValue === false) node.removeAttribute(attrName);
				else node.setAttribute(attrName, currentValue);
			}
		}
	}
};

const womp = (Component: WompComponent): WompElementClass => {
	// const styles = generateSpecifcStyles(Component);
	const WompComponent = class extends HTMLElement implements WompElement {
		state: any[] = [];
		props: { [key: string]: any };
		ROOT: this | ShadowRoot;

		static cachedTemplate: CachedTemplate;

		static getOrCreateTemplate(parts: TemplateStringsArray) {
			if (!this.cachedTemplate) {
				const [dom, attributes] = createHtml(parts);
				const template = document.createElement('template');
				template.innerHTML = dom;
				const dependencies = createDependencies(template, parts, attributes);
				this.cachedTemplate = new CachedTemplate(template, dependencies);
			}
			return this.cachedTemplate;
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
			//console.time('Init');
			this.ROOT = this;
			this.ROOT.innerHTML = '';
			currentRenderingComponent = this;
			currentHookIndex = 0;
			const result = Component.call(this, {});
			let renderHtml: RenderHtml = result as RenderHtml;
			if (typeof result === 'string' || result instanceof HTMLElement) renderHtml = html`${result}`;
			const { values, parts } = renderHtml;
			const template = (this.constructor as typeof WompComponent).getOrCreateTemplate(parts);
			//console.time('Cloning');
			const [fragment, dynamics] = template.clone();
			//console.timeEnd('Cloning');
			//console.time('Setting values');
			setValues(dynamics, values);
			//console.timeEnd('Setting values');
			//console.time('Children');
			while (fragment.childNodes.length) {
				this.ROOT.appendChild(fragment.childNodes[0]);
			}
			//console.timeEnd('Children');
			//console.timeEnd('Init');
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
