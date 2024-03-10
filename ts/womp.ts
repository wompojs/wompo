const DEV_MODE = false;

/* 
================================================
TYPES
================================================
*/
/**
 * The html`` template function result type.
 */
interface RenderHtml {
	parts: TemplateStringsArray;
	values: any[];
	_$wompHtml: true;
}

/**
 * The props of any component.
 */
export interface WompProps {
	children?: WompChildren;
	[key: string]: any;
}

/**
 * The options that a component can have when instantiating.
 * The current available options are:
 * - `name` (string)
 * - `shadow` (boolean)
 * - `cssGeneration` (boolean)
 */
export interface WompComponentOptions {
	/**
	 * Default value: `null`.
	 * The component name. If not defined, the component name will be the name of the function in
	 * hyphen-case. If the component doesn't have an hyphen, a "womp" string will be placed as a suffix.
	 * E.g. TabPanel = tab-panel, Counter = counter-womp
	 */
	name?: string;
	/**
	 * Default value: `false`. If true, the component will be rendered in a shadow DOM.
	 */
	shadow?: boolean;
	/**
	 * Default value: `true`. If true, the CSS of the component will be replaced with a more unique CSS. This
	 * is done by simply putting the component name as a prefix in every class. The generated class names will
	 * be put in the [styles] prop of the component. This is done to avoid styles collisions.
	 * E.g. CounterComponent.css = `.button` => .counter-component__button
	 */
	cssGeneration?: boolean;
}

/**
 * The type of the function to create a Womp Component.
 * It can have a custom `css` property, corresponding to the specific styles of the component.
 */
export interface WompComponent {
	/** The props of the component */
	(props: WompProps): RenderHtml;
	/**
	 * The specific styles of the component.
	 */
	css: string;
}

/**
 * The type of a Womp component Instance.
 * The public accessible properties are:
 * - `hooks`: Hook[]
 * - `props`: WompProps
 * - `initialProps`: WompProps
 * - `measurePerf`: boolean
 * - `_$womp`: true
 *
 * The public accessible methods are:
 * - `requestRender()`
 * - `onDisconnected()`
 * - `updateProps(prop, newValue)`
 */
export interface WompElement extends HTMLElement {
	/**
	 * The props of the component, that are then passed in the function.
	 */
	props: WompProps;

	/**
	 * The hooks of the component. They are accessed by the position in the array.
	 */
	_$hooks: Hook[];

	/**
	 * The initial props of a component. This property is only used internally when
	 * using a dyanmic tag.
	 */
	_$initialProps: WompProps;

	/**
	 * True if the component wants to log the rendering time in the console. Only
	 * available in DEV_MODE.
	 * This property is set to true only when a component has the attribute or
	 * initial prop [wc-perf].
	 */
	_$measurePerf: boolean;

	/**
	 * Requests a render to the component.
	 * @returns void
	 */
	requestRender: () => void;

	/**
	 * A callback that gets executed whenever the component id disconnected
	 * **definitely** from the DOM. This callback is not called when the
	 * component is just moved from one node to another.
	 * @returns void
	 */
	onDisconnected: () => void;

	/**
	 * Update a [prop] of the component with the [newValue]. It automatically
	 * re-render the component if the old value and the new value differs.
	 * @param prop The prop name to update
	 * @param newValue The new value to put in the prop
	 * @returns void
	 */
	updateProps: (prop: string, newValue: any) => void;

	/**
	 * An identifier to rapidly know if a node is a womp component.
	 */
	_$womp: true;
}

export interface GlobalStateOptions<S> {
	storage?: string;
	reducer?: (oldState: S, action: { type: string; [key: string]: any }) => Partial<S>;
	async?: () => Promise<S>;
}

type Hook =
	| StateHook
	| EffectHook
	| RefHook
	| CallbackHook
	| IdHook
	| MemoHook
	| ReducerHook<any>
	| GlobalStateHook<any>;

type StateHook = [any, (newValue: any) => void];

interface EffectHook {
	dependencies: any;
	callback: VoidFunction | (() => VoidFunction);
	cleanupFunction: VoidFunction | void;
}

interface RefHook {
	current: any;
	__wcRef: true;
}

interface CallbackHook {
	(...args: any[]): any;
}

type IdHook = string;

interface MemoHook {
	dependencies: any[];
	value: any;
}

interface ReducerAction {
	type: string;
	[key: string]: any;
}
type ReducerHook<State> = [State, (state: any, action: ReducerAction) => void];

interface GlobalStateHook<S> {
	value: S;
	subscribers: Set<WompElement>;
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
VARIABLES
================================================
*/
let currentRenderingComponent: WompElement = null;
let currentHookIndex: number = 0;

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

/* 
================================================
CLASSES
================================================
*/

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
	public stringifiedTemplate: string;
	public values: any[];
	public template: [DocumentFragment, Dynamics[]];

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

	private __callback: (event: Event) => void;
	private __eventInitialized = false;

	constructor(node: HTMLElement, dependency: Dependency) {
		this.node = node;
		this.name = dependency.name;
		this.index = dependency.index;
		this.attrStructure = dependency.attrDynamics;
	}

	public updateValue(newValue: any) {
		if (this.name === 'ref' && newValue.__wcRef) {
			newValue.current = this.node;
			if ((this.node as WompElement)._$womp) {
				const oldDisconnectedCallback = (this.node as WompElement).onDisconnected;
				(this.node as WompElement).onDisconnected = () => {
					newValue.current = null;
					oldDisconnectedCallback();
				};
			}
			return;
		}
		if (DEV_MODE && this.name === 'wc-perf') {
			(this.node as WompElement)._$measurePerf = true;
		}
		if ((this.node as WompElement)._$womp) {
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
		if (!this.__eventInitialized) {
			const eventName = this.name.substring(1);
			this.node.addEventListener(eventName, this.listener.bind(this));
			this.__eventInitialized = true;
		}
		this.__callback = callback;
	}

	private listener(event: Event) {
		if (this.__callback) this.__callback(event);
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

class WompChildren {
	public nodes: Node[];

	public _$wompChildren: true = true;

	constructor(nodes: Node[]) {
		this.nodes = nodes;
	}
}

class WompArrayDependency {
	public dynamics: DynamicNode[];
	public isArrayDependency: true = true; // For faster access

	private __oldValues: any[];
	private __parentDependency: DynamicNode;

	constructor(values: any[], dependency: DynamicNode) {
		this.dynamics = [];
		this.__parentDependency = dependency;
		this.addDependenciesFrom(dependency.startNode as HTMLElement, values.length);
		this.__oldValues = __setValues(this.dynamics, values, []);
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
			currentNode = endComment as unknown as HTMLElement;
			this.dynamics.push(dependency);
			toAddNumber--;
		}
	}

	public checkUpdates(newValues: any[]) {
		let diff = newValues.length - this.__oldValues.length;
		if (diff > 0) {
			let startNode = this.dynamics[this.dynamics.length - 1]?.endNode;
			if (!startNode) startNode = this.__parentDependency.startNode;
			this.addDependenciesFrom(startNode as HTMLElement, diff);
		} else if (diff < 0) {
			while (diff) {
				const toClean = this.dynamics.pop();
				toClean.dispose();
				diff++;
			}
		}
		this.__oldValues = __setValues(this.dynamics, newValues, this.__oldValues);
		return this;
	}
}

/* 
================================================
SUPPORT FUNCTIONS
================================================
*/

/**
 * Generates the static styles of a component.
 * @returns The generated styles specific to the component
 */
const __generateSpecifcStyles = (
	component: WompComponent,
	options: WompComponentOptions
): [string, { [className: string]: string }] => {
	const { css } = component;
	const { shadow, name, cssGeneration } = options;
	const componentName = name;
	const classes: { [key: string]: string } = {};
	let generatedCss = css;
	if (DEV_MODE) {
		if (!shadow && !cssGeneration)
			console.warn(
				`The component ${name} is not an isolated component (shadow=false) and has the cssGeneration option set to false.\n` +
					`This can lead to unexpected behaviors, becasue this component can alter other components' styles.`
			);
	}
	if (cssGeneration) {
		const completeCss = `${shadow ? ':host' : componentName} {display:block;}\n${css}`;
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
		generatedCss = completeCss.replace(/\.(.*?)[\s|{]/gm, (_, className) => {
			const uniqueClassName = `${componentName}__${className}`;
			classes[className] = uniqueClassName;
			return `.${uniqueClassName} `;
		});
	}
	return [generatedCss, classes];
};

//* OK
const __createHtml = (parts: TemplateStringsArray): [string, string[]] => {
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

const __createDependencies = (
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

const __getRenderHtmlString = (render: RenderHtml) => {
	let value = '';
	const { parts, values } = render;
	for (let i = 0; i < parts.length; i++) {
		value += parts[i];
		if (values[i]?.componentName) value += values[i].componentName;
	}
	return value;
};

const __shouldUpdate = (currentValue: any, oldValue: any, dependency: Dynamics) => {
	const valuesDiffers = currentValue !== oldValue;
	const isComposedAttribute = !!(dependency as DynamicAttribute).attrStructure;
	const isWompChildren = currentValue?._$wompChildren;
	const childrenNeedUpdate =
		isWompChildren && (dependency as DynamicNode).startNode.nextSibling !== currentValue.nodes[0];
	return valuesDiffers || isComposedAttribute || childrenNeedUpdate;
};

// This function alters the original [dynamics] array: it's not pure.
const __setValues = (dynamics: Dynamics[], values: any[], oldValues: any[]) => {
	const newValues = [...values];
	for (let i = 0; i < dynamics.length; i++) {
		const currentDependency = dynamics[i];
		const currentValue = newValues[i];
		const oldValue = oldValues[i];
		if (!__shouldUpdate(currentValue, oldValue, currentDependency))
			// Skip update: values are the same
			continue;
		if (currentDependency.isNode) {
			// Falsy values are cleared from the DOM
			if (currentValue === false) {
				currentDependency.clearValue();
				continue;
			}
			if (currentValue?._$wompHtml) {
				// handle template elements
				const oldStringified = oldValue?.stringifiedTemplate;
				const newTemplate = __getRenderHtmlString(currentValue);
				const sameString = newTemplate === oldStringified;
				if (oldValue === undefined || !sameString) {
					const cachedTemplate = __createTemplate(currentValue.parts);
					const template = cachedTemplate.clone();
					const [fragment, dynamics] = template;
					newValues[i] = new HtmlProcessedValue(newTemplate, currentValue.values, template);
					__setValues(dynamics, currentValue.values, oldValue?.values ?? oldValue ?? []);
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
					const processedValues = __setValues(
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
			const oldIsPrimitive = oldValue !== Object(oldValue) && oldValue !== undefined;
			const startNode = currentDependency.startNode;
			if (isPrimitive) {
				if (oldIsPrimitive) {
					// At this point there's already a content in the node
					if (startNode.nextSibling) startNode.nextSibling.textContent = currentValue;
					else startNode.after(currentValue);
				} else {
					currentDependency.clearValue();
					startNode.after(currentValue);
				}
			} else {
				let currentNode = startNode.nextSibling;
				let newNodeIndex = 0;
				let index = 0;
				if (currentValue._$wompChildren) {
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
						if (!(oldValue as WompArrayDependency)?.isArrayDependency) {
							currentDependency.clearValue();
							newValues[i] = new WompArrayDependency(currentValue, currentDependency);
						} else newValues[i] = (oldValue as WompArrayDependency).checkUpdates(currentValue);
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
			const isCustomComponent = currentValue._$womp;
			const newNodeName: string = isCustomComponent ? currentValue.componentName : currentValue;
			if (node.nodeName !== newNodeName.toUpperCase()) {
				const oldAttributes = (node as HTMLElement).getAttributeNames();
				if (isCustomComponent) {
					// Is a Womp Element
					if (DEV_MODE) {
						if ((node as WompElement)._$womp) {
							console.error(
								'Dynamic tags are currently not supported, unsless used to render for the first time a custom component.\n' +
									'Instead, you can use conditional rendering (e.g. condition ? html`<${First} />` : html`<${Second} />`).'
							);
							continue;
						}
					}
					const initialProps: WompProps = {};
					for (const attrName of oldAttributes) {
						// attributes on the dom will be set when creating the element
						const attrValue = (node as HTMLElement).getAttribute(attrName);
						initialProps[attrName] = attrValue === '' ? true : attrValue;
					}
					customElement = new currentValue() as WompElement;
					(customElement as WompElement)._$initialProps = initialProps;
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
					if (currentDynamic?.name && currentDynamic?.name !== 'ref')
						(customElement as WompElement)._$initialProps[currentDynamic.name] = values[index];
				}
				node.replaceWith(customElement);
			}
		}
	}
	return newValues;
};

const __createTemplate = (parts: TemplateStringsArray) => {
	const [dom, attributes] = __createHtml(parts);
	const template = document.createElement('template');
	template.innerHTML = dom;
	const dependencies = __createDependencies(template, parts, attributes);
	return new CachedTemplate(template, dependencies);
};

/* 
================================================
WOMP COMPONENT DEFINITION
================================================
*/
const _$womp = (Component: WompComponent, options: WompComponentOptions): WompElementClass => {
	const [generatedCSS, styles] = __generateSpecifcStyles(Component, options);
	const style = document.createElement('style');
	const styleClassName = `${options.name}__styles`;
	style.classList.add(styleClassName);
	style.textContent = generatedCSS;
	if (!options.shadow) {
		document.body.appendChild(style);
	}
	const WompComponent = class extends HTMLElement implements WompElement {
		static componentName = options.name;
		static _$womp = true;

		public props: WompProps = {};
		public _$hooks: Hook[] = [];
		public _$measurePerf: boolean = false;
		public _$womp: true = true;
		public _$initialProps: WompProps = {};

		private __ROOT: this | ShadowRoot;
		private __dynamics: Dynamics[];
		private __updating: boolean = false;
		private __oldValues: any[] = [];
		private __isInitializing: boolean = true;
		private __connected: boolean = false;
		private __isInDOM: boolean = false;

		static cachedTemplate: CachedTemplate;

		static getOrCreateTemplate(parts: TemplateStringsArray) {
			if (!this.cachedTemplate) this.cachedTemplate = __createTemplate(parts);
			return this.cachedTemplate;
		}

		constructor() {
			super();
		}

		/** @override component is connected to DOM */
		connectedCallback() {
			this.__isInDOM = true;
			if (!this.__connected) this.initElement();
		}

		/** @override component is connected to DOM */
		disconnectedCallback() {
			// When a component is just "moved" to another element but not
			// removed from the DOM, it still calls the disconnected and
			// then the connected callback again. This prevents it.
			if (this.__connected) {
				this.__isInDOM = false;
				Promise.resolve().then(() => {
					// If the connectedCallback is called again, isInTheDOM will be true
					if (!this.__isInDOM) {
						this.onDisconnected();
						if (DEV_MODE) console.warn('Disconnected', this);
					}
				});
			}
		}

		public onDisconnected() {}

		/**
		 * Initializes the component with the state, props, and styles.
		 */
		private initElement() {
			this.__ROOT = this; // Shadow DOM is eventually attached later
			this.props = {
				...this._$initialProps,
				styles: styles,
			};
			const componentAttributes = this.getAttributeNames();
			for (const attrName of componentAttributes) {
				if (!this.props.hasOwnProperty(attrName)) {
					const attrValue = this.getAttribute(attrName);
					this.props[attrName] = attrValue === '' ? true : attrValue;
				}
				if (DEV_MODE && attrName === 'wc-perf') {
					this._$measurePerf = true;
				}
			}
			if (DEV_MODE && this.props['wc-perf']) {
				this._$measurePerf = true;
			}

			if (DEV_MODE && this._$measurePerf) console.time('First render ' + options.name);
			// The children are saved in a WompChildren instance, so that
			// they are not lost even when disconnected from the DOM.
			const childNodes = this.__ROOT.childNodes;
			const childrenArray: Node[] = [];
			// Using a template to temporarily put children, so that
			// they are removed from the DOM and put on it where needed.
			const supportTemplate = document.createElement('template');
			while (childNodes.length) {
				childrenArray.push(childNodes[0]);
				supportTemplate.appendChild(childNodes[0]);
			}
			const children = new WompChildren(childrenArray);
			this.props.children = children;

			// Create shadow DOM
			if (options.shadow) this.__ROOT = this.attachShadow({ mode: 'open' });

			// Attach styles only if we are inside a shadow root and the same style is
			// not already present.
			const root = this.getRootNode();
			if (
				(options.shadow || root !== document) &&
				!(root as ShadowRoot).querySelector(`.${styleClassName}`)
			) {
				const clonedStyles = style.cloneNode(true);
				this.__ROOT.appendChild(clonedStyles);
			}

			const renderHtml = this.callComponent();
			const { values, parts } = renderHtml;
			const template = (this.constructor as typeof WompComponent).getOrCreateTemplate(parts);
			const [fragment, dynamics] = template.clone();
			this.__dynamics = dynamics;
			const elaboratedValues = __setValues(this.__dynamics, values, this.__oldValues);
			this.__oldValues = elaboratedValues;

			while (fragment.childNodes.length) {
				this.__ROOT.appendChild(fragment.childNodes[0]);
			}
			this.__isInitializing = false;
			this.__connected = true;
			if (DEV_MODE && this._$measurePerf) console.timeEnd('First render ' + options.name);
		}

		private callComponent() {
			currentRenderingComponent = this;
			currentHookIndex = 0;
			const result = Component.call(this, this.props);
			let renderHtml: RenderHtml = result as RenderHtml;
			if (typeof result === 'string' || result instanceof HTMLElement) renderHtml = html`${result}`;
			return renderHtml;
		}

		public requestRender() {
			if (!this.__updating) {
				this.__updating = true;
				Promise.resolve().then(() => {
					if (DEV_MODE && this._$measurePerf) console.time('Re-render ' + options.name);
					const renderHtml = this.callComponent();
					const oldValues = __setValues(this.__dynamics, renderHtml.values, this.__oldValues);
					this.__oldValues = oldValues;
					this.__updating = false;
					if (DEV_MODE && this._$measurePerf) console.timeEnd('Re-render ' + options.name);
				});
			}
		}

		public updateProps(prop: string, value: any) {
			if (this.props[prop] !== value) {
				this.props[prop] = value;
				if (!this.__isInitializing) {
					console.warn(`Updating ${prop}`, this.__isInitializing);
					this.requestRender();
				}
			}
		}
	};

	return WompComponent;
};

/* 
================================================
HOOKS
================================================
*/

export const useHook = (): [WompElement, number] => {
	const currentComponent = currentRenderingComponent;
	const currentIndex = currentHookIndex;
	const res: [WompElement, number] = [currentComponent, currentIndex];
	currentHookIndex++;
	return res;
};

export const useState = <State>(defaultValue: State) => {
	const [component, hookIndex] = useHook();
	if (!component._$hooks.hasOwnProperty(hookIndex)) {
		const index = hookIndex;
		component._$hooks[index] = [
			defaultValue,
			(newValue: State) => {
				let computedValue = newValue;
				const stateHook = component._$hooks[index] as StateHook;
				if (typeof newValue === 'function') {
					computedValue = newValue(stateHook[0]);
				}
				if (computedValue !== stateHook[0]) {
					stateHook[0] = computedValue;
					component.requestRender();
				}
			},
		];
	}
	const state = component._$hooks[hookIndex];
	return state;
};

export const useEffect = (callback: VoidFunction | (() => VoidFunction), dependencies: any[]) => {
	const [component, hookIndex] = useHook();
	if (!component._$hooks.hasOwnProperty(hookIndex)) {
		const effectHook = {
			dependencies: dependencies,
			callback: callback,
			cleanupFunction: null,
		} as EffectHook;
		component._$hooks[hookIndex] = effectHook;
		Promise.resolve().then(() => {
			effectHook.cleanupFunction = callback();
		});
	} else {
		const componentEffect = component._$hooks[hookIndex] as EffectHook;
		for (let i = 0; i < dependencies.length; i++) {
			const oldDep = componentEffect.dependencies[i];
			if (oldDep !== dependencies[i]) {
				if (typeof componentEffect.cleanupFunction === 'function')
					componentEffect.cleanupFunction();
				Promise.resolve().then(() => {
					componentEffect.cleanupFunction = callback();
					componentEffect.dependencies = dependencies;
				});
				break;
			}
		}
	}
};

export const useLayoutEffect = (
	callback: VoidFunction | (() => VoidFunction),
	dependencies: any[]
) => {
	const [component, hookIndex] = useHook();
	if (!component._$hooks.hasOwnProperty(hookIndex)) {
		const effectHook = {
			dependencies: dependencies,
			callback: callback,
			cleanupFunction: null,
		} as EffectHook;
		component._$hooks[hookIndex] = effectHook;
		effectHook.cleanupFunction = callback();
	} else {
		const componentEffect = component._$hooks[hookIndex] as EffectHook;
		for (let i = 0; i < dependencies.length; i++) {
			const oldDep = componentEffect.dependencies[i];
			if (oldDep !== dependencies[i]) {
				if (typeof componentEffect.cleanupFunction === 'function')
					componentEffect.cleanupFunction();
				componentEffect.cleanupFunction = callback();
				componentEffect.dependencies = dependencies;
				break;
			}
		}
	}
};

export const useRef = <T>(initialValue: T | null = null) => {
	const [component, hookIndex] = useHook();
	if (!component._$hooks.hasOwnProperty(hookIndex)) {
		component._$hooks[hookIndex] = {
			current: initialValue,
			__wcRef: true,
		} as RefHook;
	}
	const ref = component._$hooks[hookIndex];
	return ref;
};

// State update must use callbacks
export const useCallback = (callbackFn: CallbackHook) => {
	const [component, hookIndex] = useHook();
	if (!component._$hooks.hasOwnProperty(hookIndex)) {
		component._$hooks[hookIndex] = callbackFn;
	}
	const callback = component._$hooks[hookIndex];
	return callback as CallbackHook;
};

const useIdMemo = () => {
	let counter = 0;
	return () => {
		const [component, hookIndex] = useHook();
		if (!component._$hooks.hasOwnProperty(hookIndex)) {
			component._$hooks[hookIndex] = `:r${counter}:` as IdHook;
			counter++;
		}
		const callback = component._$hooks[hookIndex];
		return callback as IdHook;
	};
};
export const useId = useIdMemo();

export const useMemo = (callbackFn: () => any, dependencies: any[]) => {
	const [component, hookIndex] = useHook();
	if (!component._$hooks.hasOwnProperty(hookIndex)) {
		component._$hooks[hookIndex] = {
			value: callbackFn(),
			dependencies: dependencies,
		} as MemoHook;
	} else {
		const oldMemo = component._$hooks[hookIndex] as MemoHook;
		for (let i = 0; i < dependencies.length; i++) {
			const oldDep = oldMemo.dependencies[i];
			if (oldDep !== dependencies[i]) {
				oldMemo.dependencies = dependencies;
				oldMemo.value = callbackFn();
				break;
			}
		}
	}
	const memoizedResult = component._$hooks[hookIndex] as MemoHook;
	return memoizedResult.value;
};

export const useReducer = <State>(
	reducer: (state: State, action: ReducerAction) => Partial<State>,
	initialState: State
) => {
	const [component, hookIndex] = useHook();
	const index = hookIndex;
	if (!component._$hooks.hasOwnProperty(index)) {
		const dispatch = (action: ReducerAction) => {
			const currentState = (component._$hooks[index] as ReducerHook<State>)[0];
			const partialState = reducer(currentState, action);
			const keys = Object.keys(partialState);
			for (const key of keys) {
				if ((partialState as any)[key] !== (currentState as any)[key]) {
					component.requestRender();
					break;
				}
			}
			const newState = {
				...currentState,
				...partialState,
			} as State;
			(component._$hooks[hookIndex] as ReducerHook<State>)[0] = newState;
		};
		const reducerHook: ReducerHook<State> = [initialState, dispatch];
		component._$hooks[hookIndex] = reducerHook;
	}
	const stateAndReducer = component._$hooks[hookIndex];
	return stateAndReducer;
};

export const useExposed = (toExpose: { [key: string]: any }) => {
	const component = currentRenderingComponent;
	const keys = Object.keys(toExpose);
	for (const key of keys) {
		(component as any)[key] = toExpose[key];
	}
};

//? NO useDebugValue (because is for react-dev-tools)
//? NO useContext (because there is no context)
//? NO useDeferredValue
//? NO useImperativeHandle
//? NO useInsertionEffect
//? NO useOptimistic

/* 
================================================
GLOBAL STORE MANAGEMENT
================================================
*/

export const useGlobalState = <S>(defaultValue: S, options: GlobalStateOptions<S> = {}) => {
	const allOptions: GlobalStateOptions<S> = {
		storage: null,
		reducer: null,
		...options,
	};
	let initialValue = defaultValue;
	if (allOptions.storage) {
		initialValue = JSON.parse(localStorage.getItem(allOptions.storage)) as S;
		if (initialValue === null) initialValue = defaultValue;
	}
	if (allOptions.async) {
		initialValue = {
			state: 'loading',
			data: initialValue,
			error: null,
		} as any;
	}
	const subscribers = new Set<WompElement>();
	let setter: any;
	if (allOptions.reducer) {
		setter = (action: { type: string; [key: string]: any }) => {
			const oldState = allOptions.async ? (globalState.value as any).data : globalState.value;
			const partialState = allOptions.reducer(oldState, action);
			if (
				typeof partialState === 'object' &&
				!Array.isArray(partialState) &&
				partialState !== null
			) {
				globalState.value = {
					...globalState.value,
					...partialState,
				};
			} else {
				globalState.value = partialState as S;
			}
			if (allOptions.storage) {
				localStorage.setItem(allOptions.storage, JSON.stringify(globalState.value));
			}
			for (const subscriber of subscribers) {
				subscriber.requestRender();
			}
		};
	} else {
		setter = (newStateVal: S | ((oldState: S) => S)) => {
			let newState = newStateVal as S;
			const oldState = allOptions.async ? (globalState.value as any).data : globalState.value;
			if (typeof newStateVal === 'function')
				newState = (newStateVal as (oldState: S) => S)(structuredClone<S>(oldState));
			if (DEV_MODE) {
				const errString =
					'The type of the new value is different from the previous type. Alway keep the same value type.';
				if (Array.isArray(oldState) && !Array.isArray(newState)) console.error(errString);
				else if (typeof oldState === 'object' && typeof newState !== 'object')
					console.error(errString);
				else if (typeof oldState !== 'object' && typeof newState === 'object')
					console.error(errString);
			}
			if (oldState !== newState) {
				if (allOptions.async) {
					(globalState.value as any).data = newState;
				} else {
					globalState.value = newState;
				}
				if (allOptions.storage) {
					localStorage.setItem(allOptions.storage, JSON.stringify(globalState.value));
				}
				for (const subscriber of subscribers) {
					subscriber.requestRender();
				}
			}
		};
	}
	if (allOptions.async) {
		allOptions
			.async()
			.then((data) => {
				globalState.value = {
					state: 'hasData',
					data: data,
					error: null,
				} as any;
				for (const subscriber of subscribers) {
					subscriber.requestRender();
				}
			})
			.catch((err) => {
				globalState.value = {
					state: 'hasError',
					data: null,
					error: err,
				} as any;
				for (const subscriber of subscribers) {
					subscriber.requestRender();
				}
			});
	}
	const globalState = {
		value: initialValue,
		subscribers: subscribers,
		setter: setter,
	} as GlobalStateHook<S>;
	return (
		isOnlySetter = false
	): [S, (oldState: S, action?: { type: string; [key: string]: any }) => S] => {
		const [component, hookIndex] = useHook();
		if (!component._$hooks.hasOwnProperty(hookIndex)) {
			const oldDisconnectedCallback = component.onDisconnected;
			component.onDisconnected = () => {
				subscribers.delete(component);
				oldDisconnectedCallback();
			};
			if (!isOnlySetter) subscribers.add(component);
			component._$hooks[hookIndex] = globalState;
		}
		return [globalState.value, setter];
	};
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
		_$wompHtml: true,
	};
}

/* 
================================================
DEFAULT OPTIONS
================================================
*/
export const wompDefaultOptions: WompComponentOptions = {
	shadow: false,
	name: '',
	cssGeneration: true,
};

/* 
================================================
DEFINE WOMP COMPONENT
================================================
*/
export function defineWomp(component: WompComponent, options: WompComponentOptions = {}) {
	if (!component.css) component.css = '';
	const componentOptions = {
		...wompDefaultOptions,
		...options,
	};
	if (!componentOptions.name) {
		let newName = component.name
			.replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`)
			.toLowerCase();
		if (!newName.includes('-')) newName += '-womp';
		componentOptions.name = newName;
	}
	const Component = _$womp(component, componentOptions);
	customElements.define(componentOptions.name, Component);
	return Component;
}

//! Aggiungi commenti alle funzioni/classi
//! Crea file .d.ts
//! Crea documentazione
