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

/**
 * The optional parameters to configure a global state variable.
 * It currently only supports the following parameters:
 * - `storage`: string
 * - `reducer`: (oldState: State, action: { type: string; [key: string]: any }) => State;
 * - `async`: () => Promise<State>
 */
export interface GlobalStateOptions<S> {
	/**
	 * Default: null. When valorized, the Stringified version of global data will be saved in the
	 * localStorage. It must be a string corresponding to the key of the value saved in the storage.
	 */
	storage?: string;
	/**
	 * Default: null. When valorized, the global state will not return a simple "setState" function,
	 * but a dispatch function that will then execute the reducer. This option can be used if you'd
	 * like to implement a redux-like behavior.
	 * @param oldState The old state
	 * @param action The action to dispatch
	 * @returns The partial or whole new state
	 */
	reducer?: (oldState: S, action: { type: string; [key: string]: any }) => Partial<S>;
	/**
	 * Default: null. If the initial state depends on some data in the DB, you can set this
	 * initializer function that will fetch the data and return them. When this parameter is set,
	 * the state data will be:
	 *
	 * ```typescript
	 * {
	 *   status: 'loading' | 'hasData' | 'hasError';
	 *   data?: any;
	 *   error?: any;
	 * }
	 * ```
	 *
	 * @returns A promise that will resolve the fetched data.
	 */
	async?: () => Promise<S>;
}

/** The possible hooks that a component can have. */
type Hook =
	| StateHook
	| EffectHook
	| RefHook
	| CallbackHook
	| IdHook
	| MemoHook
	| ReducerHook<any>
	| GlobalStateHook<any>;

/** The hook generate by the useState function */
type StateHook = [any, (newValue: any) => void];

/** The hook generate by the useEffect and useLayoutEffect functions */
interface EffectHook {
	dependencies: any;
	callback: VoidFunction | (() => VoidFunction);
	cleanupFunction: VoidFunction | void;
}

/** The hook generate by the useRef function */
interface RefHook {
	current: any;
	__wcRef: true;
}

/** The hook generate by the useCallback function */
interface CallbackHook {
	(...args: any[]): any;
}

/** The hook generate by the useId function */
type IdHook = string;

/** The hook generate by the useMemo function */
interface MemoHook {
	dependencies: any[];
	value: any;
}

interface ReducerAction {
	type: string;
	[key: string]: any;
}
/** The hook generate by the useState function */
type ReducerHook<State> = [State, (state: any, action: ReducerAction) => void];

/** The hook generate by the useGlobalState function */
interface GlobalStateHook<S> {
	value: S;
	subscribers: Set<WompElement>;
}

/**
 * The type of the class generated by the womp() function.
 */
interface WompElementClass {
	/** The constructor */
	new (): HTMLElement;
	/** The cached template data. This is generated only the first time a component renders. */
	_$cachedTemplate: CachedTemplate;
	/** This function will get or create a new CachedTemplate instance. */
	_$getOrCreateTemplate(parts: TemplateStringsArray): CachedTemplate;
}

/**
 * Each CachedTemplate will generate an array of Dependencies that are metadata to efficientluy
 * update the elements.
 */
interface Dependency {
	/** The type of the dependency (ATTRIBUTE, NODE, TAG) */
	type: number;
	/** The index of the element when walked with the treeWalker */
	index: number;
	/** This option is valorized if the type is ATTRIBUTE */
	name?: string;
	/**
	 * This option is valorized if the type is ATTRIBUTE and it's a composed attribute.
	 * (e.g. class="button ${'button-primary'}")
	 */
	attrDynamics?: string;
}

/**
 * The possible dynamic values: DynamicNode | DynamicAttribute | DynamicTag.
 */
type Dynamics = DynamicNode | DynamicAttribute | DynamicTag;

/* 
================================================
VARIABLES
================================================
*/
/**
 * The current rendering component instance. This is used when creating hooks.
 * This variable is exposed only in the `useHook` hook.
 */
let currentRenderingComponent: WompElement = null;
/**
 * The current hook index in a component. This is used when creating hooks.
 * This variable is exposed only in the `useHook` hook.
 */
let currentHookIndex: number = 0;

const WC_MARKER = '$wc$';
const DYNAMIC_TAG_MARKER = 'wc-wc';
const isDynamicTagRegex = /<\/?$/g;
const isAttrRegex = /\s+([^\s]*?)="?$/g;
const selfClosingRegex = /(<([a-x]*?-[a-z]*).*?)\/>/g;
const isInsideTextTag = /<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi;
const onlyTextChildrenElementsRegex = /^(?:script|style|textarea|title)$/i;

const NODE = 0; // Is a NODE Dependency.
const ATTR = 1; // Is an ATTRIBUTE Dependency.
const TAG = 2; // Is a TAG Dependency.

/** The tree walker used to walk through the DOM Tree to create dependencies */
const treeWalker = document.createTreeWalker(
	document,
	129 // NodeFilter.SHOW_{ELEMENT|COMMENT}
);

/* 
================================================
CLASSES
================================================
*/
/**
 * The CachedTemplate class is used to efficiently render components. The template HTML element is
 * stored here and only cloned when a new component is instantiated.
 */
class CachedTemplate {
	/**
	 * The HTML Template element that has all the structure and comments built in to identify dynamic
	 * elements.
	 */
	public template: HTMLTemplateElement;
	/**
	 * The list of metadata dependencies used to know which node/attribute should listen to updates
	 * when a variable changes.
	 */
	public dependencies: Dependency[];

	/**
	 * Create a new CachedTemplate instance.
	 * @param template The HTML Template already elaborated to handle the dynamic parts.
	 * @param dependencies The metadata dependencies for the template.
	 */
	constructor(template: HTMLTemplateElement, dependencies: Dependency[]) {
		this.template = template;
		this.dependencies = dependencies;
	}

	/**
	 * This function will clone the template content and build the dynamcis metadata - an array
	 * containing all the information to efficiently put values in the DOM, without checking if each
	 * node is equal to a virtual one. The DOM update is not done through this function, but thanks to
	 * the `__setValues` function.
	 * @returns An array containing 2 values: The DOM fragment cloned from the content of the
	 * template, and the dynamics metadata.
	 */
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
				} else if (type === TAG) {
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

/**
 * This function is used to store dynamic parts of one component that used the value returned by the
 * `html` function. It allows to create kinda the same process of caching used by every component,
 * so a [dynamics] array is build and used to perform updated on the html result.
 */
class HtmlProcessedValue {
	/**
	 * The stringified template is the result of the `html` function without the dynamic parts. This
	 * property is used to compare 2 different html results.
	 */
	public stringifiedTemplate: string;
	/** The last values that the html function returned. */
	public values: any[];
	/** The Cached template data returned by the `clone` function. */
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

/**
 * Contains the data about a Dynamic node.
 */
class DynamicNode {
	/**
	 * The start node marks the point on where dynamic nodes must be put after.
	 * It's a static HTML element. Values between the startNode and endNode are known to be dynamic.
	 */
	public startNode: ChildNode;
	/**
	 * The end node marks the point on where dynamic nodes must be put before.
	 * It's a static HTML element. Values between the startNode and endNode are known to be dynamic.
	 */
	public endNode: ChildNode | null;

	public isNode: true = true; // For faster access
	public isAttr: false = false; // For faster access
	public isTag: false = false; // For faster access

	/**
	 * Creates a new DynamicNode instance.
	 * @param startNode The start node.
	 * @param endNode The end node.
	 */
	constructor(startNode: ChildNode, endNode: ChildNode | null) {
		this.startNode = startNode;
		this.endNode = endNode;
	}

	/**
	 * Removes all the nodes between the start and the end nodes.
	 */
	public clearValue() {
		let currentNode = this.startNode.nextSibling;
		while (currentNode !== this.endNode) {
			currentNode.remove();
			currentNode = this.startNode.nextSibling;
		}
	}

	/**
	 * First removes all the nodes between the start and the end nodes, then it also removes the
	 * start node and the end node.
	 */
	public dispose() {
		this.clearValue();
		this.startNode.remove();
		this.endNode.remove();
	}
}

/**
 * Contains the data about a dynamic attribute.
 */
class DynamicAttribute {
	/** The node that owns the dynamic attribute */
	public node: HTMLElement;
	/** The name of the dynamic attribute. */
	public name: string;
	/**
	 * If an attribute has only some dynamic parts, this property will contain the whole attribute
	 * structure. E.g. class="button ${'hidden'}".
	 */
	public attrStructure: string;

	public isNode: false = false; // For faster access
	public isAttr: true = true; // For faster access
	public isTag: false = false; // For faster access

	/** The callback to execute when an event is fired. */
	private __callback: (event: Event) => void;
	/** True if an event has already been initialized. */
	private __eventInitialized = false;

	/**
	 * Creates a new DynamicAttribute instance.
	 * @param node The node that owns the attribute.
	 * @param dependency The dependency metadata.
	 */
	constructor(node: HTMLElement, dependency: Dependency) {
		this.node = node;
		this.name = dependency.name;
		this.attrStructure = dependency.attrDynamics;
	}

	/**
	 * Update an attribute value.
	 * @param newValue The new value of the attribute
	 */
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

	/**
	 * Set the callback function to be executed when an event is fired. If the event has not been
	 * initialized, the event listener will be added.
	 */
	set callback(callback: (event: Event) => void) {
		if (!this.__eventInitialized) {
			const eventName = this.name.substring(1);
			this.node.addEventListener(eventName, this.__listener.bind(this));
			this.__eventInitialized = true;
		}
		this.__callback = callback;
	}

	/**
	 * The listener that will execute the __callback function (if defined).
	 * @param event The event object
	 */
	private __listener(event: Event) {
		if (this.__callback) this.__callback(event);
	}
}

/**
 * Contains the data about a dynamic tag name.
 */
class DynamicTag {
	/** The node that has the dynamic tag. */
	public node: ChildNode;

	public isNode: false = false; // For faster access
	public isAttr: false = false; // For faster access
	public isTag: true = true; // For faster access

	/**
	 * Creates a new DynamicTag instance.
	 * @param node The node instance.
	 */
	constructor(node: ChildNode) {
		this.node = node;
	}
}

/**
 * Holds the children of a component. They are stored in an array of nodes instead of an NodeList or
 * HTMLCollection, so that they are not lost and reusable when removed from the DOM.
 */
class WompChildren {
	public nodes: Node[];

	public _$wompChildren: true = true;

	constructor(nodes: Node[]) {
		this.nodes = nodes;
	}
}

/**
 * Hold the informations to efficiently update a dynamic value that is an array.
 */
class WompArrayDependency {
	/** A list of dynamic nodes, used to know where each item of the array begins and ends. */
	public dynamics: DynamicNode[];

	public isArrayDependency: true = true; // For faster access

	/** The array containing the old values, for comparisons. */
	private __oldValues: any[];
	/** The parent dynamic node dependency. */
	private __parentDependency: DynamicNode;

	/**
	 * Creates a new WompArrayDependency instance.
	 * @param values The array of values to put in the DOM
	 * @param dependency The dynamic node dependency on which the array should be rendered.
	 */
	constructor(values: any[], dependency: DynamicNode) {
		this.dynamics = [];
		this.__parentDependency = dependency;
		this.addDependenciesFrom(dependency.startNode as HTMLElement, values.length);
		this.__oldValues = __setValues(this.dynamics, values, []);
	}

	/**
	 * This function will add markers (HTML comments) and generate dynamic nodes dependecies used to
	 * efficiently udpate the values inside of the array.
	 * @param startNode The start node on which insert the new "single-item" dependencies.
	 * @param toAdd The number of dependencies to generate.
	 */
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

	/**
	 * Check if there are dependencies to add/remove, and then set the new values to the old nodes.
	 * Setting the new values will start an eventual recursive check for eventual nested arrays.
	 * @param newValues The new values to check with the old ones fot updates.
	 * @returns This instance.
	 */
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
 * Generates the static styles of a component. If the `cssGeneration` option in the component is
 * false, the generation will be skipped and the css will be taken as it is.
 * @returns an array of 2 values: the first is the generated CSS string, the second is an object
 * having as keys the original class names, and as the value the replaced class names.
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
				`The component ${name} is not an isolated component (shadow=false) and has the ` +
					`cssGeneration option set to false.\nThis can lead to unexpected behaviors, because ` +
					`this component can alter other components' styles.`
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
					`The CSS selector "${selector} {...}" in the component "${componentName}" is not enough` +
						` specific: include at least one class.`
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

/**
 * This function will create the valid HTML string to put in a template, used then to create the DOM
 * of a component and obtain the dynamic metadata.
 * @param parts The static parts of the `html` function.
 * @returns An array having 2 values: the generated HTML string, and a list of attribute names that
 * are known to be dynamic.
 */
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

/**
 * Based on a template content, this function will extract the dynamic dependecies, and build the
 * metadata used to efficiently update the nodes during re-render.
 * @param template An HTML Template element
 * @param parts The parts returned by the `html` function
 * @param attributes The dynamic attribute names obtained by the `__createHtml` function.
 * @returns The list of elaborated dependencies
 */
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
					type: TAG,
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

/**
 * Create a new CachedTemplate, by first obtaining the html content string, and then creating the
 * dependencies. The newly created template will be then used by components of the same type.
 * @param parts The parts returned by the `html` function.
 * @returns a new instance of CachedTemplate
 */
const __createTemplate = (parts: TemplateStringsArray) => {
	const [dom, attributes] = __createHtml(parts);
	const template = document.createElement('template');
	template.innerHTML = dom;
	const dependencies = __createDependencies(template, parts, attributes);
	return new CachedTemplate(template, dependencies);
};

/**
 * This function will "stringify" the result of the `html` function, by simply joining all the parts
 * of the template. The stringified version is used to compare 2 html results. If the 2 strings are
 * equal, the 2 templates are also considered to be equal (dynamic values excluded).
 * @param render The whole result of the `html` function
 * @returns The string representation of the the template.
 */
const __getRenderHtmlString = (render: RenderHtml) => {
	let value = '';
	const { parts, values } = render;
	for (let i = 0; i < parts.length; i++) {
		value += parts[i];
		if (values[i]?.componentName) value += values[i].componentName;
	}
	return value;
};

/**
 * Compare the old value with the new value, and returns true if they differs.
 * @param currentValue The current value
 * @param oldValue The old value
 * @param dependency The dependency that includes the value
 * @returns True if the dependency should be updated
 */
const __shouldUpdate = (currentValue: any, oldValue: any, dependency: Dynamics) => {
	const valuesDiffers = currentValue !== oldValue;
	const isComposedAttribute = !!(dependency as DynamicAttribute).attrStructure;
	const isWompChildren = currentValue?._$wompChildren;
	const childrenNeedUpdate =
		isWompChildren && (dependency as DynamicNode).startNode.nextSibling !== currentValue.nodes[0];
	return valuesDiffers || isComposedAttribute || childrenNeedUpdate;
};

/**
 * This function will compare the values of the previous render with the current one, and update the
 * DOM accordingly.
 * This function alters the original [dynamics] array: **it's not pure**.
 * @param dynamics The array of dynamic dependencies
 * @param values The new values of the render
 * @param oldValues The old values used in the previous render
 * @returns A modified version of the new values
 */
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
								'Dynamic tags are currently not supported, unsless used to render for the first ' +
									'time a custom component.\nInstead, you can use conditional rendering.\n' +
									'(e.g. condition ? html`<${First} />` : html`<${Second} />`).'
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

/* 
================================================
WOMP COMPONENT DEFINITION
================================================
*/
/**
 * This function will convert the functional component into an extension class of the HTMLElement,
 * so that it can be used to create the custom web-component.
 * @param Component The Component function
 * @param options The options of the component.
 * @returns A new dynamic class that will be used to create the custom web-component
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
	/**
	 * The dynamic class created to make it possible to create a custom web-component
	 */
	const WompComponent = class extends HTMLElement implements WompElement {
		static _$womp = true; // For faster access

		/** The component name, used in the DOM */
		static componentName = options.name;
		/**
		 * The cached template created in the first item's render, and then reused across all
		 * components.
		 */
		static _$cachedTemplate: CachedTemplate;

		/**
		 * Get the already present cached template, or create a new one if the component is rendering
		 * for the first time.
		 * @param parts The template parts from the html function.
		 * @returns The cached template.
		 */
		static _$getOrCreateTemplate(parts: TemplateStringsArray) {
			if (!this._$cachedTemplate) this._$cachedTemplate = __createTemplate(parts);
			return this._$cachedTemplate;
		}

		public _$womp: true = true; // For faster access

		/**
		 * The props of the component. They are public so that they can be easily accessed from the
		 * console and make it easier to debug a component.
		 */
		public props: WompProps = {};
		/**
		 * The list of hooks in a component. They are public, so that hooks can be added, but should not
		 * be accessed easily.
		 */
		public _$hooks: Hook[] = [];
		/**
		 * This variable will be set to true if a component has the wc-perf attribute. It'll print in
		 * the console rendering times for the component (init and update). It's only available in
		 * development mode.
		 */
		public _$measurePerf: boolean = false;

		/**
		 * The initial props of a component. They are set when using a dynamic tag to render a custom
		 * Womp element.
		 */
		public _$initialProps: WompProps = {};

		/** The Root of the node. It'll be the node itself, or it's ShadowRoot if shadow is set to true */
		private __ROOT: this | ShadowRoot;
		/** The array containing metadata of the component, used to render the component */
		private __dynamics: Dynamics[];
		/** It'll be true if the component has already processing an update. */
		private __updating: boolean = false;
		/** The array containing the dynamic values of the last render. */
		private __oldValues: any[] = [];
		/** It'll be true if the component is currently initializing. */
		private __isInitializing: boolean = true;
		/** It's true if the component is connected to the DOM. */
		private __connected: boolean = false;
		/**
		 * Used to know if a component has been completely removed from the DOM or only temporarely to
		 * move it from a node to another.
		 */
		private __isInDOM: boolean = false;

		constructor() {
			super();
		}

		/** @override component has been connected to the DOM */
		connectedCallback() {
			this.__isInDOM = true;
			if (!this.__connected) this.initElement();
		}

		/** @override component has been disconnected from the DOM */
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

		/**
		 * This public callback will be used when a component is removed permanently from the DOM.
		 * It allows other code to hook into the component and unmount listeners or similar when the
		 * component is disconnected from the DOM.
		 */
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
			const template = (this.constructor as typeof WompComponent)._$getOrCreateTemplate(parts);
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

		/**
		 * Calls the functional component by first setting correct values to the
		 * [currentRenderingComponent] and [currentHookIndex] variables.
		 * @returns The result of the call.
		 */
		private callComponent() {
			currentRenderingComponent = this;
			currentHookIndex = 0;
			const result = Component.call(this, this.props);
			let renderHtml: RenderHtml = result as RenderHtml;
			if (typeof result === 'string' || result instanceof HTMLElement) renderHtml = html`${result}`;
			return renderHtml;
		}

		/**
		 * It requests a render to the component. If the component has already received a render
		 * request, the request will be rejected. This is to avoid multiple re-renders when it's not
		 * necessary. The following function will cause a single re-render:
		 * ```javascript
		 * const incBy2 = () => {
		 *   setState((oldState) => oldState + 1)
		 *   setState((oldState) => oldState + 1)
		 * }
		 * ```
		 */
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

		/**
		 * It'll set a new value to a specific prop of the component, and a re-render will be requested.
		 * @param prop The prop name.
		 * @param value The new value to set.
		 */
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

/**
 * This generic hook will allow the creation of custom hooks by exposing the current rendering
 * component and the current hook index. They will be returned in an array of 2 element:
 * [currentComponent, currentIndex].
 * The currentHookIndex will be then automatically incremented, so that the developer will not have
 * to worry about it, avoiding potential bugs.
 * @returns The current rendering component and current index.
 */
export const useHook = (): [WompElement, number] => {
	const currentComponent = currentRenderingComponent;
	const currentIndex = currentHookIndex;
	const res: [WompElement, number] = [currentComponent, currentIndex];
	currentHookIndex++;
	return res;
};

/**
 * This hook will allow a component to request a re-render when the property changes. It accepts one
 * parameter, which is the initial value, and it'll return an array containing 2 values: the current
 * value and a function to update it. The value will not be directly modifiable: it's necessary to
 * call the set function with the new value. The set function can be:
 *
 * 1. The new value
 * 2. A function that has the old state as a parameter, and returns the new value.
 *
 * The second case should be used in the following conditions:
 *
 * - Consecutive updates are performed consecutively
 * - The update is performed inside a callback function that is not re-created during render.
 *
 * If the state value is an object, to update it you must pass the whole object back: this hook will
 * not do a merge of the partial value and the old value. If you prefer this to happen, you should
 * apply the `useReducer` approach instead.
 *
 * @example
 * ```javascript
 * function Counter(){
 *   const [counter, setCounter] = useState(0);
 *   const inc = () => setCounter(counter+1);
 *   return html`<button \@click=${inc}>${counter}</button>`;
 * }
 * ```
 *
 * @param defaultValue The starter value.
 * @returns The current StateHook value.
 */
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

/**
 * The useEffect hook allows to execute a callback (passed in the first argument) on first render
 * and whenever one of the dependencies changes (second argument). This is useful to execute async
 * calls, set intervals, and other types of initialization in the component.
 * The list of dependencies can be an empty array: in this case, the callback function will only be
 * executed once, that is after the first render.
 * The callback gets executed asynchronously, meaning that it'll be executed once the component will
 * finish its rendering phase.
 *
 * @example
 * ```javascript
 * function Timer(){
 *   const [time, setTime] = useState(0);
 *   useEffect(() => {
 *     setInterval(() => {
 *       setTime((oldTime) => oldTime + 1);
 *     }, 10)
 *   }, [])
 *   return html`Time: ${(time/100).toFixed(2)}s`
 * }
 * ```
 * @param callback The callback to execute when a dependency changes.
 * @param dependencies The list of dependencies to listen to changes.
 */
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

/**
 * The useLayoutEffect hook is the same as the main useEffect hook. The only difference stands in
 * the execution order: the useEffect hook gets executed asynchronously, so the component will first
 * render, and then it'll call the callback. The useLayoutEffect hook gets executed synchronously,
 * so `before` the component renders.
 * @param callback The callback to execute
 * @param dependencies The list of dependencies to listen to changes.
 */
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

/**
 * The useRef hook is very similar to the `useState` hook. The only difference is that the useRef
 * hook will NOT re-render the component, and the value will be accessed through the `.current`
 * property. This is useful if you want to keep a stable value of a variable across all the renders,
 * (without re-initializing the variable and loose it's previous state), but without causing a
 * re-render when the value changes.
 * If the value is passed to a "ref" attribute in any node, the .current value will be set to the
 * node having that attribute.
 *
 * @example
 * ```javascript
 * function Component(){
 *   const divRef = useRef();
 *   console.log(divRef.current); // null
 *   useEffect(() => {
 *     console.log(divRef.current); // HTMLDivElement
 *   }, []);
 *   return html`<div ref=${divRef}>I have a reference!</div>`;
 * }
 * ```
 *
 * @param initialValue The initial value.
 * @returns The current value of the reference.
 */
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

/**
 * The useCallback hook is a useful hook that stores the given function and returns the same
 * function in the next renders.
 * Why is it useful? Because in javascript 2 function declarations are considered not equal:
 *
 * ```javascript
 * () => {} === () => {} // false
 *
 * const a = () => {}
 * a === a // true
 * ```
 *
 * So, for example, a useful case in which to use it, is when a callback function is passed through
 * the props of another component: if you don't use the `useCallback` hook, the child component will
 * re-render every time the parent component changes, because the two functions will be considered
 * different.
 * This consideration doesn't apply to events, because events are stored in a simple variable and
 * will not cause an add/removal of event listeners, so it's not computationally expensive: it's
 * more expensive to store the callback and get it every time.
 *
 * @example
 * ```javascript
 * function Component(){
 *   const callback = useCallback(() => console.log('Hey!'));
 *   return html`<${NestedComponent} hey=${callback} />`
 * }
 * ```
 *
 * @param callbackFn The callback function to save.
 * @returns The stored callback function.
 */
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
/**
 * The useId hook returns a unique id for the component. It's simply a counter that gets updated
 * every time a component instantiates this hook. The id structure will be the following: ":r0:".
 *
 * Since the purpose of component is their reusability, a component should not have an element with
 * a static Id. That's when this function comes into play. The id can be used also for accessibility
 * purposes.
 *
 * @example
 * ```javascript
 * function Input(){
 *   const id = useId();
 *   return html`
 *     <input id=${id} type="checkbox" />
 *     <label for=${id}>Input</label>
 *   `
 * }
 * ```
 *
 * @returns The useId hook.
 */
export const useId = useIdMemo();

/**
 * The useMemo hook is useful when you want to store a computed value which would be expensive to
 * re-compute for every single render. For example, filtering or sorting, an array. It accepts one
 * callback function and will return the result of it. The second parameter contains the
 * dependencies that will cause the re-execution of the callback function when one of them changes.
 *
 * @example
 * ```javascript
 *
 * const users = [...] // thousands of users.
 *
 * function Users(){
 *   const adults = useMemo(() => {
 *     return users.filter(user => user.age >= 18);
 *   }, [users])
 *   return html`<ul>
 *     ${adults.map(user => html`<li>${user.name}</li>`)}
 *   </ul>`
 * }
 * ```
 *
 * @param callbackFn The callback function to execute.
 * @param dependencies The depencies to listen to changes.
 * @returns The last computed result.
 */
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

/**
 * The useReducer hook is an alternative approach for `useState`, using the redux-like state
 * management.
 * With this hook, you give as a parameter the initial state and the reducer function. This function
 * must accept 2 parameters: the old state, and the action, which is an object having at least the
 * "type" key (which is a string corresponding to the action to execute). The reducer must return
 * the new (partial) state.
 * The useReducer function will then return the current state and the **dispatch** function. This
 * function, unlike the simple set function generated by the `useState` hook, will accept a single
 * parameter which is the action to pass to the reducer function.
 *
 * @example
 * ```javascript
 * const reducer = (oldState, action) => {
 *   switch (action.type) {
 *     case 'ADD_SHEEP':
 *       return { sheeps: oldState.sheeps + 1 };
 *     case 'ADD_COW':
 *       return { cows: oldState.cows + 1 };
 *     default:
 *       throw new Error('Action not supported');
 *   }
 * }
 *
 * const initialState = { sheeps: 10, cows: 5 };
 *
 * function SheepsAndCows(){
 *   const [state, dispatch] = useReducer(initialState, reducer);
 *   const addSheep = () => dispatch({ type: 'ADD_SHEEP' })
 *   const addCow = () => dispatch({ type: 'ADD_COW' })
 *   return html`
 *     <button \@click=${addSheep}>Sheeps: ${state.sheeps}</button>
 *     <button \@click=${addCow}>Cows: ${state.cows}</button>
 *   `
 * }
 * ```
 *
 * @param reducer The reducer function.
 * @param initialState The initial state.
 * @returns An array with [state, dispath].
 */
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

/**
 * The useExposed hook allows the component to expose variables and/or methods in the DOM. Sometimes
 * you want to be able to select an element in the DOM and then use one of it's methods to do some
 * kind of operations. Some components are better to have an "isolated" state, meaning that it's
 * rendering state should be internal, and not depending to its props. A nice example it's a modal:
 * you'd rather want to have an `open()` method that having an `open` property, that causes a
 * re-render of the parent and the modal component.
 *
 * This is a different approach compared to React, but using exposed methods in custom elements can
 * have great benefits speaking about performances in comparison of using props to manage the state.
 *
 * This hook accepts an object having as keys the name of the property to expose and the
 * corresponding values.
 * The `useExposed` hook is a great combination with the `useRef` hook.
 *
 * @example
 * ```javascript
 * function Modal(){
 *   const [open, setOpen] = useState(false);
 *   const openModal = () => setOpen(true);
 *   const closeModal = () => setOpen(false);
 *   useExposed({
 *     open: openModal,
 *     close: closeModal,
 *   });
 *   return html`...`;
 * }
 *
 * function ParentComponent(){
 *   const modalRef = useRef();
 *   /// Will only re-render the modal component, and not this component.
 *   const openModal = () => modalRef.current.open();
 *   return html`
 *     <button \@click=${openModal}>Open Modal</button>
 *     <${Modal} ref=${modalRef} />
 *   `
 * }
 * ```
 *
 * @param toExpose The keys to expose.
 */
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

/**
 * The useGlobalState hook works kinda like the `useState` hook, with the only difference that
 * allows to set a global state used across multiple components, that will cause the re-render of
 * each component using it when the value changes. The useGlobalState hook should not be used inside
 * a component, because it's an external hook that dosn't depend on the current rendering component.
 * This function, unlike the useState hook, will not return immediately the state and the setter,
 * but will return **another hook** that can then be used in all the components that requires it.
 * This allows to create distinct states with appropriate names.
 *
 * The returned hook accepts one parameter (which is NOT the default value, because it's alread set
 * when instantiating the hook). This parameter is a boolean value indicating rather or not the
 * component should listen to changes in the state. This is because sometimes a component may only
 * need the setter function, so it doesn't need a re-render when the state value changes.
 * The default value is `true` (the component will re-render when the state changes).
 *
 * The `useGlobalState` hook accepts a second parameter, which are the options. The current options
 * are the following:
 * - `storage` (default: `null`). When valorized, the Stringified version of the global state
 *   will be saved in the localStorage. It must be a string corresponding to the key of the value
 *   saved in the storage.
 * - `reducer`: (Default: `null`). When valorized, the global state will not return a simple "setState"
 *   function, but a dispatch function that will then execute the reducer. This option can be used
 *   if you'd like to implement a redux-like behavior.
 * - `async`: (Default: `null`). If the initial state depends on some data in the DB, you can set this
 *   initializer function that will return a promise with the fetched data. When this parameter is
 *   set, the state data will be like the following:
 *
 * ```typescript
 * {
 *   status: 'loading' | 'hasData' | 'hasError';
 *   data?: any;
 *   error?: any;
 * }
 * ```
 *
 * @example
 * ```javascript
 * const useCounter = useGlobalState(0)
 *
 * function Component(){
 *   const [counter, setCounter] = useCounter();
 *   return html``
 * }
 * ```
 *
 * @param defaultValue The default value of the store.
 * @param options The options of the global state.
 * @returns The generated hook to use in multiple components.
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
		shouldReRender = true
	): [S, (oldState: S, action?: { type: string; [key: string]: any }) => S] => {
		const [component, hookIndex] = useHook();
		if (!component._$hooks.hasOwnProperty(hookIndex)) {
			const oldDisconnectedCallback = component.onDisconnected;
			component.onDisconnected = () => {
				subscribers.delete(component);
				oldDisconnectedCallback();
			};
			if (shouldReRender) subscribers.add(component);
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
 * This template function is used to then generate the DOM structure for a component.
 * Should be used as a return value for every component, and for every string value that contains
 * an HTML structure. Simple strings will be taken as they are, and will not be converted into HTML
 * nodes.
 *
 * @example
 * ```javascript
 * const greeting = 'Hello, world!';
 * const template = html`<div>${greeting}</div>`
 * ```
 * @param template The list of static strings of the template
 * @param values The list of dynamic values of the template
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
/**
 * The default options used when creating a Web Component. If you customize these options, you
 * should do it at the TOP of your html file, before every other component renders.
 * The current options are:
 * - `shadow`: false (boolean)
 * - `cssGeneration`: true (boolean)
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
/**
 * The defineWomp function will be the trigger point to generate your custom web component.
 * It accepts 2 parameter: your functional component and the options to customize it.
 * The current available options are the followings:
 * - `name` (string)
 * - `shadow` (boolean).
 * - `cssGeneration` (boolean)
 *
 * The default values will depend on the [wompDefaultOptions] variable.
 *
 * The functional component can have the css property, wich is a string corresponding to its styles.
 *
 * The `name` of the component will be the one specified in the options, or, if not specified, will
 * be the hyphen-cased name of the functional component. If the generated name will not have at
 * least one hyphen, a "-womp" string will be appended in the end.
 * Example: function CounterComponent(){} -> counter-component
 * Example2: function Counter(){} -> counter-womp
 *
 * The `shadow` option, if true, will build the content of the component in a Shadow DOM.
 *
 * The `cssGeneration` option will transform the css of the component by replacing the classes with
 * unique names, that will then be passed in the `styles` props of the component.
 *
 * **The result of this function is what should be exported (not the functional component).**
 *
 * @example
 * ```javascript
 * function Greetings(){
 *   return html`<p>Hello World!</p>`
 * }
 * Greetings.css = `p { color: blue; }`
 *
 * export default defineWomp(Greetings, {
 *   name: 'greetings-component',
 *   shadow: true,
 * })
 * ```
 *
 * @param component The functional component.
 * @param options The options of the component.
 * @returns The generated class for the component.
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
