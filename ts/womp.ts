export interface WompProps {
	children?: WompChildren;
	[key: string]: any;
}

export interface RenderHtml {
	parts: TemplateStringsArray;
	values: any[];
	__wompHtml: true;
}

export interface WompComponentOptions {
	name?: string;
	shadow?: boolean;
}

export interface WompComponent {
	(props: WompProps): RenderHtml;
	css: string;
	__womp: true;
}

type State = [any, (newValue: any) => void];

export interface WompElement extends HTMLElement {
	state: State[];
	effects: Effect[];
	props: WompProps;
	initialProps: WompProps;
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
	component: WompComponent,
	options: WompComponentOptions
): [string, { [className: string]: string }] => {
	const { css } = component;
	const componentName = options.name;
	const completeCss = `${componentName} {display:block;}\n${css}`;
	if (DEV_MODE) {
		const invalidSelectors: string[] = [];
		// It's appropriate that at least one class is present in each selector
		[...completeCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
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

	const generatedCss = completeCss.replace(/\.(.*?)[\s|{]/gm, (_, className) => {
		const uniqueClassName = `${componentName}__${className}`;
		classes[className] = uniqueClassName;
		return `.${uniqueClassName} `;
	});
	return [generatedCss, classes];
};

//* OK
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

	public isNode: true = true; // For faster access
	public isAttr: false = false; // For faster access
	public isTag: false = false; // For faster access

	constructor(startNode: ChildNode, endNode: ChildNode | null) {
		this.startNode = startNode;
		this.endNode = endNode;
	}

	public clearValue() {
		let currentNode = this.startNode.nextSibling;
		while (currentNode !== this.endNode) {
			currentNode.remove();
			currentNode = this.startNode.nextSibling;
		}
	}

	public dispose() {
		this.clearValue();
		this.startNode.remove();
		this.endNode.remove();
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
		else if (this.name === 'style') {
			let styleString = '';
			const styles = Object.keys(newValue);
			for (const key of styles) {
				let styleValue = newValue[key];
				let styleKey = key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
				if (typeof styleValue === 'number') styleValue = `${styleValue}px`;
				styleString += `${styleKey}:${styleValue};`;
			}
			this.node.setAttribute(this.name, styleString);
		}
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
					dynamic = new DynamicNode(node as HTMLElement, node.nextSibling);
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

class HtmlProcessedValue {
	stringifiedTemplate: string;
	values: any[];
	template: [DocumentFragment, Dynamics[]];

	constructor(
		stringifiedTemplate: string,
		values: any[],
		template: [DocumentFragment, Dynamics[]]
	) {
		this.stringifiedTemplate = stringifiedTemplate;
		this.values = values;
		this.template = template;
	}
}

class WompChildren {
	nodes: Node[];
	owner: WompElement;

	public __wompChildren: true = true;

	constructor(nodes: Node[], owner: WompElement) {
		this.nodes = nodes;
		this.owner = owner;
	}
}

class WompArrayDependency {
	dynamics: DynamicNode[];

	public isArrayDependency: true = true; // For faster access

	private oldValues: any[];
	private parentDependency: DynamicNode;

	constructor(values: any[], dependency: DynamicNode) {
		this.dynamics = [];
		this.parentDependency = dependency;
		this.addDependenciesFrom(dependency.startNode as HTMLElement, values.length);
		this.oldValues = setValues(this.dynamics, values, []);
	}

	private addDependenciesFrom(startNode: HTMLElement, toAdd: number) {
		let currentNode = startNode;
		let toAddNumber = toAdd;
		while (toAddNumber) {
			const startComment = document.createComment(`?START`);
			const endComment = document.createComment(`?END`);
			currentNode.after(startComment);
			startComment.after(endComment);
			const dependency = new DynamicNode(startComment, endComment);
			currentNode = endComment.nextSibling as HTMLElement;
			this.dynamics.push(dependency);
			toAddNumber--;
		}
	}

	public checkUpdates(newValues: any[]) {
		let diff = newValues.length - this.oldValues.length;
		if (diff > 0) {
			let startNode = this.dynamics[this.dynamics.length - 1]?.endNode;
			if (!startNode) startNode = this.parentDependency.startNode;
			this.addDependenciesFrom(startNode as HTMLElement, diff);
		} else if (diff < 0) {
			while (diff) {
				const toClean = this.dynamics.pop();
				toClean.dispose();
				diff++;
			}
		}
		this.oldValues = setValues(this.dynamics, newValues, this.oldValues);
		return this;
	}
}

const getRenderHtmlString = (render: RenderHtml) => {
	let value = '';
	const { parts, values } = render;
	for (let i = 0; i < parts.length; i++) {
		value += parts[i];
		if (values[i]?.componentName) value += values[i].componentName;
	}
	return value;
};

const shouldUpdate = (currentValue: any, oldValue: any, dependency: Dynamics) => {
	const valuesDiffers = currentValue !== oldValue;
	const isComposedAttribute = !!(dependency as DynamicAttribute).attrStructure;
	const isWompChildren = currentValue?.__wompChildren;
	const childrenNeedUpdate =
		isWompChildren && (dependency as DynamicNode).startNode.nextSibling !== currentValue.nodes[0];
	return valuesDiffers || isComposedAttribute || childrenNeedUpdate;
};

// This function alters the original [dynamics] array: it's not pure.
const setValues = (dynamics: Dynamics[], values: any[], oldValues: any[]) => {
	const newValues = [...values];
	for (let i = 0; i < dynamics.length; i++) {
		const currentDependency = dynamics[i];
		const currentValue = newValues[i];
		const oldValue = oldValues[i];
		if (!shouldUpdate(currentValue, oldValue, currentDependency))
			// Skip update: values are the same
			continue;
		if (currentDependency.isNode) {
			//! If the current value is === false, empty values <> start and end node.
			//! Use the currentDependency.clearValue() method
			if (currentValue?.__wompHtml) {
				// handle template elements
				const oldStringified = oldValue?.stringifiedTemplate;
				const newTemplate = getRenderHtmlString(currentValue);
				const sameString = newTemplate === oldStringified;
				if (oldValue === undefined || !sameString) {
					const cachedTemplate = createTemplate(currentValue.parts);
					const template = cachedTemplate.clone();
					const [fragment, dynamics] = template;
					newValues[i] = new HtmlProcessedValue(newTemplate, currentValue.values, template);
					setValues(dynamics, currentValue.values, oldValue?.values ?? oldValue ?? []);
					const endNode = (currentDependency as DynamicNode).endNode;
					const startNode = (currentDependency as DynamicNode).startNode;
					let currentNode = startNode.nextSibling;
					while (currentNode !== endNode) {
						currentNode.remove();
						currentNode = startNode.nextSibling;
					}
					currentNode = startNode;
					while (fragment.childNodes.length) {
						currentNode.after(fragment.childNodes[0]);
						currentNode = currentNode.nextSibling;
					}
				} else {
					const [_, dynamics] = (oldValue as HtmlProcessedValue).template;
					const processedValues = setValues(
						dynamics,
						currentValue.values,
						(oldValue as HtmlProcessedValue).values
					);
					(oldValue as HtmlProcessedValue).values = processedValues;
					newValues[i] = oldValue;
				}
				continue;
			}
			// It's not necessary to check every single node: if a dependency updates,
			// it'll be automatically updated. It's only necessary to update the
			// textContent of primitive values.
			const isPrimitive = currentValue !== Object(currentValue);
			const startNode = currentDependency.startNode;
			if (isPrimitive) {
				if (startNode.nextSibling === currentDependency.endNode) startNode.after(currentValue);
				else startNode.nextSibling.textContent = currentValue;
			} else {
				let currentNode = startNode.nextSibling;
				let newNodeIndex = 0;
				let index = 0;
				if (currentValue.__wompChildren) {
					const childrenNodes = (currentValue as WompChildren).nodes;
					while (index < childrenNodes.length) {
						if (!currentNode || index === 0) currentNode = startNode;
						const newNode = childrenNodes[newNodeIndex];
						newNodeIndex++;
						currentNode.after(newNode);
						currentNode = currentNode.nextSibling;
						index++;
					}
				} else {
					if (Array.isArray(currentValue)) {
						if (!(oldValue as WompArrayDependency)?.isArrayDependency)
							newValues[i] = new WompArrayDependency(currentValue, currentDependency);
						else newValues[i] = (oldValue as WompArrayDependency).checkUpdates(currentValue);
					} else if (DEV_MODE) {
						console.warn(
							'Rendering objects is not supported. Doing a stringified version of it can rise errors.\n' +
								'This node will be ignored.'
						);
					}
				}
			}
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
						dynamicValue = newValues[i];
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
				const oldAttributes = (node as HTMLElement).getAttributeNames();
				if (isCustomComponent) {
					// Is a Womp Element
					if (DEV_MODE) {
						if ((node as WompElement).__womp) {
							throw new Error(
								'Changing the rendering component using a dynamic tag is currently not supported.\n' +
									'Instead, use conditional rendering.'
							);
						}
					}
					const initialProps: WompProps = {};
					for (const attrName of oldAttributes) {
						// attributes on the dom will be set when creating the element
						initialProps[attrName] = (node as HTMLElement).getAttribute(attrName);
					}
					customElement = new currentValue() as WompElement;
					(customElement as WompElement).initialProps = initialProps;
					const childNodes = node.childNodes;
					while (childNodes.length) {
						customElement.appendChild(childNodes[0]);
					}
				} else {
					// Is normal element
					customElement = document.createElement(newNodeName);
					for (const attrName of oldAttributes) {
						customElement.setAttribute(attrName, (node as HTMLElement).getAttribute(attrName));
					}
				}
				let index = i;
				let currentDynamic = dynamics[index] as DynamicAttribute;
				while (currentDynamic?.node === node) {
					// Update node pointer of dynamics pointing to the old one.
					currentDynamic.node = customElement;
					currentDynamic = dynamics[++index] as DynamicAttribute;
					// Set initial props of the correct type, so a number doesn't become a string
					if (currentDynamic.name)
						(customElement as WompElement).initialProps[currentDynamic.name] = values[index];
				}
				node.replaceWith(customElement);
			}
		}
	}
	return newValues;
};

const createTemplate = (parts: TemplateStringsArray) => {
	const [dom, attributes] = createHtml(parts);
	const template = document.createElement('template');
	template.innerHTML = dom;
	const dependencies = createDependencies(template, parts, attributes);
	return new CachedTemplate(template, dependencies);
};

/* 
================================================
Womp Component
================================================
*/

const womp = (Component: WompComponent, options: WompComponentOptions): WompElementClass => {
	const [generatedCSS, styles] = generateSpecifcStyles(Component, options);
	const style = document.createElement('style');
	style.textContent = generatedCSS;
	if (!options.shadow) {
		document.body.appendChild(style);
	}
	const WompComponent = class extends HTMLElement implements WompElement {
		static componentName = options.name;
		static __womp = true;

		state: any[] = [];
		effects: any[] = [];
		props: { [key: string]: any } = {};
		__womp: true = true;

		public initialProps: WompProps = {};

		private ROOT: this | ShadowRoot;
		private dynamics: Dynamics[];
		private updating: boolean = false;
		private oldValues: any[] = [];
		private isInitializing: boolean = true;
		private connected: boolean = false;
		private isInTheDOM: boolean = false;

		static cachedTemplate: CachedTemplate;

		static getOrCreateTemplate(parts: TemplateStringsArray) {
			if (!this.cachedTemplate) this.cachedTemplate = createTemplate(parts);
			return this.cachedTemplate;
		}

		constructor() {
			super();
		}

		/** @override component is connected to DOM */
		connectedCallback() {
			this.isInTheDOM = true;
			if (!this.connected) this.initElement();
		}

		/** @override component is connected to DOM */
		disconnectedCallback() {
			// When a component is just "moved" to another element but not
			// removed from the DOM, it still calls the disconnected and
			// then the connected callback again. This prevents it.
			if (this.connected) {
				this.isInTheDOM = false;
				Promise.resolve().then(() => {
					// If the connectedCallback is called again, isInTheDOM will be true
					if (!this.isInTheDOM) {
						if (DEV_MODE) console.warn('Disconnected', this);
					}
				});
			}
		}

		/**
		 * Initializes the component with the state, props, and styles.
		 */
		private initElement() {
			this.ROOT = this; // Shadow DOM is eventually attached later
			//! Handle prop "ref"
			this.props = {
				...this.initialProps,
				styles: styles,
			};
			const componentAttributes = this.getAttributeNames();
			for (const attrName of componentAttributes) {
				if (!this.props.hasOwnProperty(attrName))
					this.props[attrName] = this.getAttribute(attrName);
			}

			// The children are saved in a WompChildren instance, so that
			// they are not lost even when disconnected from the DOM.
			const childNodes = this.ROOT.childNodes;
			const childrenArray: Node[] = [];
			// Using a template to temporarily put children, so that
			// they are removed from the DOM and put on it where needed.
			const supportTemplate = document.createElement('template');
			while (childNodes.length) {
				childrenArray.push(childNodes[0]);
				supportTemplate.appendChild(childNodes[0]);
			}
			const children = new WompChildren(childrenArray, this);
			this.props.children = children;

			// Create shadow DOM
			if (options.shadow) this.ROOT = this.attachShadow({ mode: 'open' });
			if (options.shadow || this.getRootNode() !== document) {
				const clonedStyles = style.cloneNode(true);
				this.ROOT.appendChild(clonedStyles);
				//! Multiple components of the same time will attach the same
				//? style over and over. Check if the style is already present
				//? in the root by select the style element with a class using
				//? this.getRootNode() as a selector.
			}

			const renderHtml = this.callComponent();
			const { values, parts } = renderHtml;
			const template = (this.constructor as typeof WompComponent).getOrCreateTemplate(parts);
			const [fragment, dynamics] = template.clone();
			this.dynamics = dynamics;
			const elaboratedValues = setValues(this.dynamics, values, this.oldValues);
			this.oldValues = elaboratedValues;

			while (fragment.childNodes.length) {
				this.ROOT.appendChild(fragment.childNodes[0]);
			}
			this.isInitializing = false;
			this.connected = true;
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
					const renderHtml = this.callComponent();
					const oldValues = setValues(this.dynamics, renderHtml.values, this.oldValues);
					this.oldValues = oldValues;
					this.updating = false;
				});
			}
		}

		public updateProps(prop: string, value: any) {
			if (this.props[prop] !== value) {
				this.props[prop] = value;
				if (!this.isInitializing) {
					console.warn(`Updating ${prop}`, this.isInitializing);
					this.requestRender();
				}
			}
		}
	};

	return WompComponent;
};

//! Aggiungi un parametro "debug" solo per il DEV mode (o un attributo per il singolo componente??)
export function defineWomp(component: WompComponent, options: WompComponentOptions = {}) {
	if (!component.css) component.css = '';
	const defaultOptions = {
		shadow: false,
		name: '',
	};
	const componentOptions = {
		...defaultOptions,
		...options,
	};
	if (!componentOptions.name) {
		let newName = component.name
			.replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`)
			.toLowerCase();
		if (!newName.includes('-')) newName += '-womp';
		componentOptions.name = newName;
	}
	const Component = womp(component, componentOptions);
	customElements.define(componentOptions.name, Component);
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
		__wompHtml: true,
	};
}

//! Testa casi un pò più complessi
//! Sostituisci il fatto di usare "this" con un hook tipo expose({counter, incCounter})
//! Crea i vari hooks
//! Crea la gestione stato globale stile Zustand
//! Ordina il codice
//! Aggiungi commenti alle funzioni/classi
//! Crea file .d.ts
//! Crea documentazione
