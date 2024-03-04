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
	(props: WompProps): RenderHtml;
	componentName: string;
	css: string;
}

type State = [any, (newValue: any) => void];

interface Effect {
	dependencies: any;
	callback: VoidFunction | (() => VoidFunction);
	cleanupFunction: VoidFunction | void;
}

export interface WompElement extends HTMLElement {
	state: State[];
	effects: Effect[];
	props: { [key: string]: any };
	requestRender: () => void;
}

interface WompElementClass {
	new (): any;
	cachedTemplate: CachedTemplate;
	getOrCreateTemplate(parts: TemplateStringsArray): CachedTemplate;
}

interface Dependency {
	type: number;
	index: number;
	name?: string;
	attrDynamics?: string;
}

/* 
================================================
START WOMP
================================================
*/

const DEV_MODE = true;

let currentRenderingComponent: WompElement = null;
let currentHookIndex: number = 0;
let currentEffectIndex: number = 0;
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

//! Replace delle classi CSS lo puoi fare con una semplice Regex, senza fare un loop.
//! La funzione "Replace" accetta una funzione per rimpiazzare, dove puoi salvare le classi.
/**
 * Generates the static styles of a component.
 * @returns The generated styles specific to the component
 */
const generateSpecifcStyles = (
	component: WompComponent
): [string, { [className: string]: string }] => {
	const componentCss = component.css || '';
	if (DEV_MODE) {
		const invalidSelectors: string[] = [];
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
	const classes: { [key: string]: string } = {};
	classNames.forEach((className) => {
		const uniqueClassName = `${component.componentName}__${className}`;
		generatedCss = generatedCss.replaceAll(className, uniqueClassName);
		classes[className] = uniqueClassName;
	});
	return [generatedCss, classes];
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
				const beforeLastChar = match[match.length - 1];
				attrDelimiter = beforeLastChar === '"' || beforeLastChar === "'" ? beforeLastChar : '';
				part = part.substring(0, part.length - attrDelimiter.length - 1);
				let toAdd = `${part}${WC_MARKER}=`;
				if (attrDelimiter) toAdd += `${attrDelimiter}${WC_MARKER}`;
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
						if (attrValue !== '0') {
							const dynamicParts = attrValue.split(WC_MARKER);
							for (let i = 0; i < dynamicParts.length - 1; i++) {
								const dependency: Dependency = {
									type: ATTR,
									index: nodeIndex,
									attrDynamics: attrValue,
									name: realName,
								};
								dependencies.push(dependency);
							}
						} else {
							const dependency: Dependency = {
								type: ATTR,
								index: nodeIndex,
								name: realName,
							};
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
					// Because this marker is added after the walker's current
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
	public isNode: true = true; // For faster access

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
	public isNode: false = false; // For faster access
	public attrStructure: string;

	private _callback: (event: Event) => void;
	private eventInitialized = false;

	constructor(node: HTMLElement, dependency: Dependency) {
		this.node = node;
		this.name = dependency.name;
		this.index = dependency.index;
		this.attrStructure = dependency.attrDynamics;
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
					dynamic = new DynamicAttribute(node as HTMLElement, templateDependency);
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

const setValues = (
	dynamics: (DynamicNode | DynamicAttribute)[],
	values: any[],
	oldValues: any[]
) => {
	for (let i = 0; i < dynamics.length; i++) {
		const currentDependency = dynamics[i];
		const currentValue = values[i];
		if (currentValue === oldValues[i] && !(currentDependency as DynamicAttribute).attrStructure)
			continue;
		if (currentDependency.isNode) {
			// Updated elements
			let newNodesList: any[] | NodeList | HTMLCollection = [currentValue];
			if (currentValue instanceof NodeList || currentValue instanceof HTMLCollection)
				newNodesList = currentValue;
			let prevNode = currentDependency.startNode;
			let currentNode = prevNode.nextSibling;
			let newNodeIndex = 0;
			let index = 0;
			const newNodesLength = newNodesList.length;
			while (currentNode !== currentDependency.endNode) {
				const newNode = newNodesList[newNodeIndex];
				const next = currentNode.nextSibling;
				const isNode = newNode instanceof Node;
				// Dont add the node if the value is false or if the newNode is undefined
				if (newNode === undefined || newNode === false) currentNode.remove();
				else if ((isNode && !currentNode.isEqualNode(newNode)) || !isNode) {
					currentNode.replaceWith(newNode);
					if (!isNode) newNodeIndex++; // So it doesn't change
				}
				prevNode = currentNode;
				currentNode = next;
				index++;
			}
			// Exceed elements must be added
			while (index < newNodesLength) {
				if (!currentNode || index === 0) currentNode = prevNode;
				const newNode = newNodesList[newNodeIndex];
				const isNode = newNode instanceof Node;
				if (newNode !== false) {
					if (!isNode) newNodeIndex++;
					currentNode.after(newNode);
				}
				currentNode = currentNode.nextSibling;
				index++;
			}
		} else if (currentDependency.isNode === false) {
			const attrName = currentDependency.name;
			if (attrName.startsWith('@')) {
				currentDependency.callback = currentValue;
			} else {
				const node = currentDependency.node;
				const attrStructure = currentDependency.attrStructure;
				if (attrStructure) {
					const parts = attrStructure.split(WC_MARKER);
					let dynamicValue = currentValue;
					for (let j = 0; j < parts.length - 1; j++) {
						parts[j] = `${parts[j]}${dynamicValue}`;
						i++; // Go to the next dynamic value
						dynamicValue = values[i];
					}
					i--; // Since it'll be already increased in the loop, decrease by one
					node.setAttribute(attrName, parts.join('').trim());
				} else if (currentValue === false) node.removeAttribute(attrName);
				else node.setAttribute(attrName, currentValue);
			}
		}
	}
};

const womp = (Component: WompComponent): WompElementClass => {
	const [generatedCSS, styles] = generateSpecifcStyles(Component);
	const style = document.createElement('style');
	style.textContent = generatedCSS;
	document.body.appendChild(style); //! Check where to attach styles: if shadow-dom, inside the element
	const WompComponent = class extends HTMLElement implements WompElement {
		state: any[] = [];
		effects: any[] = [];
		props: { [key: string]: any } = {};

		private ROOT: this | ShadowRoot;
		private dynamics: (DynamicNode | DynamicAttribute)[];
		private updating: boolean = false;
		private oldValues: any[];

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
			this.ROOT = this;
			this.ROOT.innerHTML = '';
			this.oldValues = [];
			this.props = {
				...this.props,
				styles: styles,
			};
			currentRenderingComponent = this;
			currentHookIndex = 0;
			currentEffectIndex = 0;
			const renderHtml = this.getRenderData();
			const { values, parts } = renderHtml;
			const template = (this.constructor as typeof WompComponent).getOrCreateTemplate(parts);
			const [fragment, dynamics] = template.clone();
			this.dynamics = dynamics;
			setValues(this.dynamics, values, this.oldValues);
			while (fragment.childNodes.length) {
				this.ROOT.appendChild(fragment.childNodes[0]);
			}
		}

		private getRenderData() {
			const result = Component(this.props);
			let renderHtml: RenderHtml = result as RenderHtml;
			if (typeof result === 'string' || result instanceof HTMLElement) renderHtml = html`${result}`;
			return renderHtml;
		}

		public requestRender() {
			//! Maybe improve re-rendering
			if (!this.updating) {
				this.updating = true;
				Promise.resolve().then(() => {
					currentHookIndex = 0;
					currentEffectIndex = 0;
					currentRenderingComponent = this;
					const renderHtml = this.getRenderData();
					setValues(this.dynamics, renderHtml.values, this.oldValues);
					this.oldValues = renderHtml.values;
					this.updating = false;
				});
			}
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
		component.state[index] = [
			defaultValue,
			(newValue: State) => {
				let computedValue = newValue;
				if (typeof newValue === 'function') {
					computedValue = newValue(component.state[index][0]);
				}
				if (computedValue !== component.state[index][0]) {
					component.state[index][0] = computedValue;
					component.requestRender();
				}
			},
		];
	}
	const state = component.state[currentHookIndex];
	currentHookIndex++;
	return state;
};

export const useEffect = (callback: VoidFunction | (() => VoidFunction), dependencies: any[]) => {
	const component = currentRenderingComponent;
	if (!component.effects.hasOwnProperty(currentEffectIndex)) {
		const index = currentEffectIndex;
		const cleanupFunction = callback();
		component.effects[index] = {
			dependencies: dependencies,
			callback: callback,
			cleanupFunction: cleanupFunction,
		};
	} else {
		const componentEffect = component.effects[currentEffectIndex];
		for (let i = 0; i < dependencies.length; i++) {
			const oldDep = componentEffect.dependencies[i];
			if (oldDep !== dependencies[i]) {
				if (componentEffect.cleanupFunction) componentEffect.cleanupFunction();
				componentEffect.cleanupFunction = callback();
				componentEffect.dependencies = dependencies;
				break;
			}
		}
	}
	currentEffectIndex++;
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
