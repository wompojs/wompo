export interface WompProps {
	children?: WompChildren;
	[key: string]: any;
}

interface WompChildren {
	__wompChildren: true;
	static: boolean;
	nodes: NodeList;
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
	__womp: true;
}

type State = [any, (newValue: any) => void];

export interface WompElement extends HTMLElement {
	state: State[];
	effects: Effect[];
	props: { [key: string]: any };
	staticChildren: HTMLTemplateElement;
	requestRender: () => void;
	updateProps: (prop: string, newValue: any) => void;

	__womp: true;
}

interface Effect {
	dependencies: any;
	callback: VoidFunction | (() => VoidFunction);
	cleanupFunction: VoidFunction | void;
}

interface WompElementClass {
	new (props: WompProps): HTMLElement;
	cachedTemplate: CachedTemplate;
	getOrCreateTemplate(parts: TemplateStringsArray): CachedTemplate;
}

interface Dependency {
	type: number;
	index: number;
	name?: string;
	attrDynamics?: string;
}

type Dynamics = DynamicNode | DynamicAttribute | DynamicTag;

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
const DYNAMIC_TAG_MARKER = 'wc-wc';
const isDynamicTagRegex = /<\/?$/g;
const isAttrRegex = /\s+([^\s]*?)="?$/g;
const selfClosingRegex = /(<([a-x]*?-[a-z]*).*?)\/>/g;
const isInsideTextTag = /<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi;
const onlyTextChildrenElementsRegex = /^(?:script|style|textarea|title)$/i;

const NODE = 0;
const ATTR = 1;
const TAG_NAME = 2;

const treeWalker = document.createTreeWalker(
	document,
	129 // NodeFilter.SHOW_{ELEMENT|COMMENT}
);

/**
 * Generates the static styles of a component.
 * @returns The generated styles specific to the component
 */
const generateSpecifcStyles = (
	component: WompComponent
): [string, { [className: string]: string }] => {
	const { css, componentName } = component;
	if (DEV_MODE) {
		const invalidSelectors: string[] = [];
		// It's appropriate that at least one class is present in each selector
		[...css.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
			const cssSelector = selector[1].trim();
			if (!cssSelector.includes('.')) invalidSelectors.push(cssSelector);
		});
		invalidSelectors.forEach((selector) => {
			console.warn(
				`The CSS selector "${selector} {...}" in the component "${componentName}" is not enough specific: include at least one class.\n`
			);
		});
	}
	const classes: { [key: string]: string } = {};

	const generatedCss =
		css.replace(/\.(.*?)[\s|{]/gm, (_, className) => {
			const uniqueClassName = `${componentName}__${className}`;
			classes[className] = uniqueClassName;
			return `.${uniqueClassName} `;
		}) + `${componentName} {display:block;}`;
	return [generatedCss, classes];
};

//* OK
//! HTML Nested fare il "join" delle dependencies (???)
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
				if (part.match(isDynamicTagRegex)) {
					html += part + DYNAMIC_TAG_MARKER;
					continue;
				}
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
			if (node.nodeName === DYNAMIC_TAG_MARKER.toUpperCase()) {
				const dependency: Dependency = {
					type: TAG_NAME,
					index: nodeIndex,
				};
				dependencies.push(dependency);
			}
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
					// It's not necessary to adjust nodeIndex here
					node.append(strings[lastIndex], document.createComment(''));
				}
			}
		} else if (node.nodeType === 8) {
			// Is a comment
			const data = (node as unknown as Comment).data;
			if (data === `?${WC_MARKER}`) dependencies.push({ type: NODE, index: nodeIndex });
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
	public isAttr: false = false; // For faster access
	public isTag: false = false; // For faster access

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
	public attrStructure: string;

	public isNode: false = false; // For faster access
	public isAttr: true = true; // For faster access
	public isTag: false = false; // For faster access

	private _callback: (event: Event) => void;
	private eventInitialized = false;

	constructor(node: HTMLElement, dependency: Dependency) {
		this.node = node;
		this.name = dependency.name;
		this.index = dependency.index;
		this.attrStructure = dependency.attrDynamics;
	}

	public updateValue(newValue: any) {
		if ((this.node as WompElement).__womp) {
			(this.node as WompElement).updateProps(this.name, newValue);
		}
		const isPrimitive = newValue !== Object(newValue);
		if (newValue === false) this.node.removeAttribute(this.name);
		else if (isPrimitive) this.node.setAttribute(this.name, newValue);
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

class DynamicTag {
	public node: ChildNode;

	public isNode: false = false; // For faster access
	public isAttr: false = false; // For faster access
	public isTag: true = true; // For faster access

	constructor(node: ChildNode) {
		this.node = node;
	}
}

class CachedTemplate {
	public template: HTMLTemplateElement;
	public dependencies: Dependency[];

	constructor(template: HTMLTemplateElement, dependencies: Dependency[]) {
		this.template = template;
		this.dependencies = dependencies;
	}

	public clone(): [DocumentFragment, Dynamics[]] {
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
				let dynamic: Dynamics;
				const type = templateDependency.type;
				if (type === NODE) {
					dynamic = new DynamicNode(
						node as HTMLElement,
						node.nextSibling,
						templateDependency.index
					);
				} else if (type === ATTR) {
					dynamic = new DynamicAttribute(node as HTMLElement, templateDependency);
				} else if (type === TAG_NAME) {
					dynamic = new DynamicTag(node as HTMLElement);
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

const handleChildren = (children: WompChildren, dependency: DynamicNode) => {
	console.log('isChildren');
	if (children.static) {
		let currentNode = dependency.startNode;
		while (children.nodes.length) {
			currentNode.after(children.nodes[0]);
			currentNode = currentNode.nextSibling;
		}
	}
};

// This function alters the original [dynamics] array: it's not pure.
const setValues = (dynamics: Dynamics[], values: any[], oldValues: any[]) => {
	for (let i = 0; i < dynamics.length; i++) {
		const currentDependency = dynamics[i];
		const currentValue = values[i];
		if (currentValue === oldValues[i] && !(currentDependency as DynamicAttribute).attrStructure)
			continue;
		if (currentDependency.isNode) {
			// Updated elements
			const newNode = currentValue;
			if (newNode.__wompChildren) {
				handleChildren(newNode, currentDependency);
			}
			//! Metti dentro il loop sotto

			//! Una cosa alla volta. Prima singoli elementi, poi array
			/* let newNodesList: any[] = [currentValue];
			let prevNode = currentDependency.startNode;
			let currentNode = prevNode?.nextSibling;
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
			} */
		} else if (currentDependency.isAttr) {
			const attrName = currentDependency.name;
			if (attrName.startsWith('@')) {
				currentDependency.callback = currentValue;
			} else {
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
					currentDependency.updateValue(parts.join('').trim());
				} else {
					currentDependency.updateValue(currentValue);
				}
			}
		} else if (currentDependency.isTag) {
			const node = currentDependency.node;
			let customElement: HTMLElement = null;
			const isCustomComponent = currentValue.__womp;
			const newNodeName: string = isCustomComponent ? currentValue.componentName : currentValue;
			if (node.nodeName !== newNodeName.toUpperCase()) {
				//! DA FINIRE TAG DINAMICI: PROBLEMA CON I CHILDREN
				const oldAttributes = (node as HTMLElement).getAttributeNames();
				if (isCustomComponent) {
					// Is a Womp Element
					let children = node.childNodes;
					if (!!(node as WompElement).__womp) {
						children = (node as WompElement).staticChildren.content.childNodes;
					}
					const initialProps: WompProps = {
						children: {
							static: false,
							__wompChildren: true,
							nodes: children,
						},
					};
					for (const attrName of oldAttributes) {
						// attributes on the dom will be set when creating the element
						initialProps[attrName] = (node as HTMLElement).getAttribute(attrName);
					}
					customElement = new currentValue(initialProps) as WompElement;
				} else {
					// Is normal element
					customElement = document.createElement(newNodeName);
					for (const attrName of oldAttributes) {
						customElement.setAttribute(attrName, (node as HTMLElement).getAttribute(attrName));
					}
				}
				// Update references of the node to other dynamics elements
				let index = i;
				let currentDynamic = dynamics[index] as DynamicAttribute;
				while (currentDynamic.node === node) {
					// Alters the original value
					currentDynamic.node = customElement;
					currentDynamic = dynamics[++index] as DynamicAttribute;
				}
				node.replaceWith(customElement);
			}
		}
	}
};

/* 
================================================
Womp Component
================================================
*/

//! Se un component vuole esporre dei metodi?? ( es. modal.open() )
//! Dovrei metterli nella chiave this. Opzioni:
//! 1. puoi fare this.method dentro il componente: viene già chiamato con this impostato
//! 2. Crea un hook tipo "useExposedState(nome, defaultValue)"
const womp = (Component: WompComponent): WompElementClass => {
	const [generatedCSS, styles] = generateSpecifcStyles(Component);
	const style = document.createElement('style');
	style.textContent = generatedCSS;
	document.body.appendChild(style); //! Check where to attach styles: if shadow-dom, inside the element

	const WompComponent = class extends HTMLElement implements WompElement {
		static componentName = Component.componentName;
		static __womp = true;

		state: any[] = [];
		effects: any[] = [];
		props: { [key: string]: any } = {};
		__womp: true = true;
		staticChildren: HTMLTemplateElement;

		private ROOT: this | ShadowRoot;
		private dynamics: Dynamics[];
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

		constructor(initialProps: WompProps) {
			super();
			this.initElement(initialProps ?? {});
		}

		/** @override component is connected to DOM */
		connectedCallback() {}

		/**
		 * Initializes the component with the state, props, and styles.
		 */
		private initElement(initialProps: WompProps) {
			this.ROOT = this;
			this.oldValues = [];

			this.props = {
				...initialProps,
				styles: styles,
			};

			const componentAttributes = this.getAttributeNames();
			for (const attrName of componentAttributes) {
				this.props[attrName] = this.getAttribute(attrName);
			}

			//! Da finire!
			if (!initialProps.children) {
				const children = initialProps.children ? initialProps.children.nodes : this.ROOT.childNodes;
				// Clone children, only in init phase
				const childrenTemplate = document.createElement('template');
				let currentChild = null;
				while (children.length) {
					currentChild = children[0];
					childrenTemplate.content.appendChild(currentChild);
				}
				this.props.children = {
					__wompChildren: true,
					static: true,
					nodes: document.importNode(
						childrenTemplate.content /* this.staticChildren.content */,
						true
					).childNodes,
				};
			} /*  else {
				this.staticChildren = initialProps.children;
			} */

			const renderHtml = this.callComponent();
			const { values, parts } = renderHtml;
			const template = (this.constructor as typeof WompComponent).getOrCreateTemplate(parts);
			const [fragment, dynamics] = template.clone();
			this.dynamics = dynamics;
			setValues(this.dynamics, values, this.oldValues);
			while (fragment.childNodes.length) {
				this.ROOT.appendChild(fragment.childNodes[0]);
			}
		}

		private callComponent() {
			currentRenderingComponent = this;
			currentHookIndex = 0;
			currentEffectIndex = 0;
			const result = Component.call(this, this.props);
			let renderHtml: RenderHtml = result as RenderHtml;
			if (typeof result === 'string' || result instanceof HTMLElement) renderHtml = html`${result}`;
			return renderHtml;
		}

		public requestRender() {
			if (!this.updating) {
				this.updating = true;
				Promise.resolve().then(() => {
					if (this.staticChildren)
						// Static children. Copy whole node
						this.props.children = document.importNode(this.staticChildren.content, true);
					const renderHtml = this.callComponent();
					setValues(this.dynamics, renderHtml.values, this.oldValues);
					this.oldValues = renderHtml.values;
					this.updating = false;
				});
			}
		}

		public updateProps(prop: string, value: any) {
			if (this.props[prop] !== value) {
				this.props[prop] = value;
				console.log(`Updating ${prop}`);
				//! Test how many times it requests an update and how many it actually updates
				this.requestRender();
			}
		}
	};

	return WompComponent;
};

export function defineWomp(component: WompComponent) {
	if (!component.css) component.css = '';
	if (!component.componentName) {
		let newName = component.name
			.replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`)
			.toLowerCase();
		if (!newName.includes('-')) newName += '-womp';
		component.componentName = newName;
	}
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
	const cleanValues = [];
	const length = templateParts.length - 1; // skip last element
	for (let i = 0; i < length; i++) {
		// Don't include dynamic closing tags
		if (!templateParts[i].endsWith('</')) cleanValues.push(values[i]);
	}
	return {
		parts: templateParts,
		values: cleanValues,
		__womp: true,
	};
}
