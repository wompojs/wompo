/**
 * False to get smallest build file possible.
 */
const DEV_MODE = false;

/* 
================================================
TYPES
================================================
*/
/**
 * The html`` template function result type.
 */
export interface RenderHtml {
	parts: TemplateStringsArray;
	values: any[];
	_$wompoHtml: true;
}

/**
 * The props of any component.
 */
export interface WompoProps {
	/** The children of the component instance */
	children?: WompoChildren;
	/** The styles generated from the CSS provided */
	styles?: { [key: string]: string };
	/** In DEV_MODE, will write on the console performance informations. */
	['wc-perf']?: boolean;
	wcPerf?: boolean;
	/** The style of a component to customize it through the style attribute in the DOM. */
	style?: string | Partial<CSSStyleDeclaration> | object;
	/** A potential reference to the element. */
	ref?: RefHook<any>;
	/** The ID of the element */
	id?: string;
	/** The classes of the element */
	class?: string;
	/** JSX events */
	[event: `on${string}`]: (ev: Event) => void;
}

/**
 * The options that a component can have when instantiating.
 * The current available options are:
 * - `name` (string)
 * - `shadow` (boolean)
 * - `cssModule` (boolean)
 */
export interface WompoComponentOptions {
	/**
	 * Default value: `null`.
	 * The component name. If not defined, the component name will be the name of the function in
	 * hyphen-case. If the component doesn't have an hyphen, a "wompo" string will be placed as a
	 * suffix.
	 * E.g. TabPanel = tab-panel, Counter = counter-wompo
	 */
	name?: string;
	/**
	 * Default value: `false`. If true, the component will be rendered in a shadow DOM.
	 */
	shadow?: boolean;
	/**
	 * Default value: `true`. If true, the CSS of the component will be replaced with a more unique
	 * CSS. This is done by simply putting the component name as a prefix in every class.
	 * The generated class names will be put in the [styles] prop of the component.
	 * This is done to avoid styles collisions.
	 * E.g. CounterComponent.css = `.button` => .counter-component__button
	 */
	cssModule?: boolean;
}

/**
 * The type of the function to create a Wompo Component.
 * It can have a custom `css` property, corresponding to the specific styles of the component.
 */
export interface WompoComponent<Props extends WompoProps = WompoProps> {
	/** The props of the component */
	(props: Props): RenderHtml;
	/**
	 * The specific styles of the component.
	 */
	css?: string;
	/** The component name, elaborated in the defineWompo function */
	componentName?: string;
	/** Identifies the component */
	_$wompoF?: true;
	/** The generated class of the component */
	class?: WompoElementClass<Props>;
	/** Options */
	options?: {
		generatedCSS: string;
		styles: { [key: string]: string };
		shadow: boolean;
	};
}

/**
 * The type of a Wompo component Instance.
 * The public accessible properties are:
 * - `hooks`: Hook[]
 * - `props`: WompoProps
 *
 * The public accessible methods are:
 * - `requestRender()`
 * - `onDisconnected()`
 * - `updateProp(prop, newValue)`
 */
export type WompoElement<Props extends WompoProps = WompoProps, E = {}> = HTMLElement &
	E & {
		/**
		 * The props of the component, that are then passed in the function.
		 */
		props: Props;

		/**
		 * The hooks of the component. They are accessed by the position in the array.
		 */
		hooks: Hook[];

		/**
		 * The initial props of a component. This property is only used internally when
		 * using a dyanmic tag.
		 */
		_$initialProps: WompoProps;

		/**
		 * True if the component wants to log the rendering time in the console. Only
		 * available in DEV_MODE.
		 * This property is set to true only when a component has the attribute or
		 * initial prop [wc-perf].
		 */
		_$measurePerf: boolean;

		/**
		 * True if the component uses a context.
		 */
		_$usesContext: boolean;

		/**
		 * True if the component has recently been moved. Used to know if a component should search
		 * again for parent contexts.
		 */
		_$hasBeenMoved: boolean;

		/**
		 * A list of effects to execute after the component has been rendered (asynchronously).
		 */
		_$effects: EffectHook[];

		/**
		 * A list of asynchronous calls to execute when the component renders.
		 */
		_$asyncCalls: AsyncHook<any>[];

		/**
		 * A list of asynchronous calls that have been suspended.
		 */
		_$suspendedAsyncCalls: AsyncHook<any>[];

		/**
		 * A list of layout effects to execute immediately after the component has been rendered (not
		 * asynchronously).
		 */
		_$layoutEffects: EffectHook[];

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
		updateProp: (prop: string, newValue: any) => void;

		/**
		 * An identifier to rapidly know if a node is a wompo component.
		 */
		_$wompo: true;
	};

/** The possible hooks that a component can have. */
export type Hook =
	| StateHook<any>
	| EffectHook
	| RefHook<any>
	| CallbackHook<any>
	| IdHook
	| MemoHook<any>
	| ReducerHook<any>
	| AsyncHook<any>
	| ContextHook;

/** The hook generated by the useState function */
export type StateHook<S> = [S, (newValue: S | ((oldValue: S) => S)) => void];

/** The hook generated by the useEffect and useLayoutEffect functions */
export interface EffectHook {
	dependencies: any;
	callback: VoidFunction | (() => VoidFunction);
	cleanupFunction: VoidFunction | void;
}

/** The hook generated by the useRef function */
export interface RefHook<V> {
	current: V;
	__wcRef: true;
}

/** The hook generated by the useCallback function */
export interface CallbackHook<C> {
	dependencies?: any[];
	value: C;
}

/** The hook generated by the useId function */
export type IdHook = string;

/** The hook generated by the useMemo function */
export interface MemoHook<T = any> {
	dependencies: any[];
	value: T;
}

interface ReducerAction {
	[key: string]: any;
}
/** The hook generated by the useState function */
export type ReducerHook<State> = [State, (action: ReducerAction) => void];

/** The hook generated by the useAsync function */
export interface AsyncHook<S> {
	asyncCallback: () => Promise<S>;
	dependencies: any[];
	value: S;
	activateSuspense: boolean;
}

/** The props type of a ContextProvider */
interface ContextProviderProps extends WompoProps {
	value: any;
}
/** The exposed values of a ContextProvider */
interface ContextProviderExposed {
	subscribers: RefHook<Set<WompoElement>>;
}
/** The type of a ContextProvier instance */
export type ContextProviderElement = WompoElement<ContextProviderProps, ContextProviderExposed>;

/** The hook generated by the useContext hook */
export interface ContextHook {
	node: ContextProviderElement;
}

/**
 * The type of the class generated by the wompo() function.
 */
interface WompoElementClass<Props extends WompoProps, E = {}> {
	/** The constructor */
	new (): WompoElement<Props, E>;
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
let currentRenderingComponent: WompoElement = null;
/**
 * The current hook index in a component. This is used when creating hooks.
 * This variable is exposed only in the `useHook` hook.
 */
let currentHookIndex: number = 0;

const WC_MARKER = '$wc$';
const DYNAMIC_TAG_MARKER = 'wc-wc';
const isDynamicTagRegex = /<\/?$/g;
const isAttrRegex = /\s+([^\s]*?)=(["'][^"']*?)?$/g;
const selfClosingRegex = /(<([a-z]*-[a-z]*).*?)\/?>/gs;
const isInsideTextTag = /<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi;
const onlyTextChildrenElementsRegex = /^(?:script|style|textarea|title)$/i;

const NODE = 0; // Is a NODE Dependency.
const ATTR = 1; // Is an ATTRIBUTE Dependency.
const TAG = 2; // Is a TAG Dependency.

const IS_SERVER = typeof global !== 'undefined';

const doc = IS_SERVER ? ({ createTreeWalker() {} } as unknown as Document) : document;

const treeWalker = doc.createTreeWalker(
	doc,
	129 // NodeFilter.SHOW_{ELEMENT|COMMENT}
);

const mutationAttributesExclusions = ['class', 'style', 'id'];

const adoptedStyles: { [componentName: string]: Node[] } = {};

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
	/** The last values that the html function returned. */
	public values: any[];
	/** The parts of the render value. */
	public parts: TemplateStringsArray;
	/** The Cached template data returned by the `clone` function. */
	public template: [DocumentFragment, Dynamics[]];

	constructor(render: RenderHtml, template: [DocumentFragment, Dynamics[]]) {
		this.values = render.values;
		this.parts = render.parts;
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
		while (currentNode && currentNode !== this.endNode) {
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
		if (this.endNode) this.endNode.remove();
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
			return;
		}
		if (DEV_MODE && (this.name === 'wc-perf' || this.name == 'wcPerf'))
			(this.node as WompoElement)._$measurePerf = true;
		const isWompoElement = (this.node as WompoElement)._$wompo;
		if (isWompoElement) (this.node as WompoElement).updateProp(this.name, newValue);
		const isPrimitive = newValue !== Object(newValue);
		if (newValue === false || newValue === null || newValue === undefined) {
			this.node.removeAttribute(this.name);
		} else if (
			isPrimitive &&
			(!this.name.match(/[A-Z]/) || this.node.nodeName === 'svg') &&
			this.name !== 'title'
		) {
			this.node.setAttribute(this.name, newValue);
		} else if (this.name === 'style') {
			let styleString = '';
			const styles = Object.keys(newValue);
			for (const key of styles) {
				let styleValue = newValue[key];
				let styleKey = key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
				if (typeof styleValue === 'number') styleValue = `${styleValue}px`;
				if (styleValue !== undefined && styleValue !== null && styleValue !== false)
					styleString += `${styleKey}:${styleValue};`;
			}
			this.node.setAttribute(this.name, styleString);
		}
		if (this.name === 'title' && isWompoElement) this.node.removeAttribute(this.name);
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
class WompoChildren {
	public nodes: Node[];

	public _$wompoChildren: true = true;

	constructor(nodes: Node[]) {
		this.nodes = nodes;
	}
}

/**
 * Hold the informations to efficiently update a dynamic value that is an array.
 */
class WompoArrayDependency {
	/** A list of dynamic nodes, used to know where each item of the array begins and ends. */
	public dynamics: DynamicNode[];

	public isArrayDependency: true = true; // For faster access

	/** The array containing the old values, for comparisons. */
	private __oldValues: any[];
	/** The array containing the old values, not modified by the __setValues function. */
	private __oldPureValues: any[];
	/** The parent dynamic node dependency. */
	private __parentDependency: DynamicNode;

	/**
	 * Creates a new WompoArrayDependency instance.
	 * @param values The array of values to put in the DOM
	 * @param dependency The dynamic node dependency on which the array should be rendered.
	 */
	constructor(values: any[], dependency: DynamicNode) {
		this.dynamics = [];
		this.__oldValues = [];
		this.__parentDependency = dependency;
		dependency.startNode.after(document.createComment('?wc-end'));
		this.addDependenciesFrom(dependency.startNode as HTMLElement, values);
		this.__oldPureValues = values;
	}

	/**
	 * This function will add markers (HTML comments) and generate dynamic nodes dependecies used to
	 * efficiently udpate the values inside of the array.
	 * @param startNode The start node on which insert the new "single-item" dependencies.
	 * @param toAdd The values to add
	 */
	private addDependenciesFrom(startNode: HTMLElement, toAdd: any[]) {
		let currentNode = startNode;
		for (let i = 0; i < toAdd.length; i++) {
			const value = toAdd[i];
			currentNode.after(document.createTextNode(''));
			currentNode.after(document.createTextNode(''));
			const dependency = new DynamicNode(
				currentNode.nextSibling,
				currentNode.nextSibling.nextSibling
			);
			currentNode = currentNode.nextSibling.nextSibling as HTMLElement;
			this.dynamics.push(dependency);
			this.__oldValues.push(__setValues([dependency], [value], [])[0]);
		}
	}

	/**
	 * Check if there are dependencies to add/remove, and then set the new values to the old nodes.
	 * Setting the new values will start an eventual recursive check for eventual nested arrays.
	 * @param newValues The new values to check with the old ones fot updates.
	 * @returns This instance.
	 */
	public checkUpdates(newValues: any[]) {
		if (newValues === this.__oldPureValues) return this;
		const oldValuesLength = this.__oldValues.length;
		let diff = newValues.length - oldValuesLength;
		if (diff < 0) {
			while (diff) {
				const toClean = this.dynamics.pop();
				this.__oldValues.pop();
				toClean.dispose();
				diff++;
			}
		}
		for (let i = 0; i < this.dynamics.length; i++) {
			const newValue = newValues[i];
			const dependency = this.dynamics[i];
			const oldValue = this.__oldValues[i];
			this.__oldValues[i] = __setValues([dependency], [newValue], [oldValue])[0];
		}
		if (diff > 0) {
			let currentNode = this.dynamics[this.dynamics.length - 1]?.endNode;
			if (!currentNode) currentNode = this.__parentDependency.startNode;

			for (let i = 0; i < diff; i++) {
				const value = newValues[oldValuesLength + i];
				currentNode.after(document.createTextNode(''));
				currentNode.after(document.createTextNode(''));
				const dependency = new DynamicNode(
					currentNode.nextSibling,
					currentNode.nextSibling.nextSibling
				);
				currentNode = currentNode.nextSibling.nextSibling as HTMLElement;
				this.dynamics.push(dependency);
				this.__oldValues.push(__setValues([dependency], [value], []));
			}
		}
		this.__oldPureValues = newValues;
		return this;
	}
}

/* 
================================================
SUPPORT FUNCTIONS
================================================
*/

/**
 * Generates the static styles of a component. If the `cssModule` option in the component is
 * false, the generation will be skipped and the css will be taken as it is.
 * If the css contains an ":host" selector, it'll be replaced or kept based on if the shadow option
 * is true, otherwise, a default "display: block;" style will be added in the component.
 * @returns an array of 2 values: the first is the generated CSS string, the second is an object
 * having as keys the original class names, and as the value the replaced class names.
 */
const __generateSpecifcStyles = (
	component: WompoComponent,
	options: WompoComponentOptions
): [string, { [className: string]: string }] => {
	const { css } = component;
	const { shadow, name, cssModule } = options;
	const componentName = name;
	const classes: { [key: string]: string } = {};
	let generatedCss = css;
	if (cssModule) {
		if (!css.includes(':host'))
			generatedCss = `${shadow ? ':host' : componentName} {display:block;} ${css}`;
		if (DEV_MODE) {
			const invalidSelectors: string[] = [];
			// It's appropriate that at least one class is present in each selector
			[...generatedCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
				const cssSelector = selector[1].trim();
				if (!cssSelector.match(/\.|:host|@/)) invalidSelectors.push(cssSelector);
			});
			invalidSelectors.forEach((selector) => {
				console.warn(
					`The CSS selector "${selector} {...}" in the component "${componentName}" is not enough` +
						` specific: include at least one class or deactive the "cssModule" option on the component.`
				);
			});
		}
		if (!shadow) generatedCss = generatedCss.replace(/:host/g, componentName);
		generatedCss = generatedCss.replace(/\.(?!\d)([_a-zA-Z0-9-]+)/gm, (_, className) => {
			const uniqueClassName = `${componentName}__${className}`;
			classes[className] = uniqueClassName;
			return `.${uniqueClassName}`;
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
				const delimiter = match.lastIndexOf('"') > match.lastIndexOf("'") ? '"' : "'";
				if (!attrDelimiter) {
					attrDelimiter = beforeLastChar === '=' ? '' : delimiter;
					part = part.replace(/=([^=]*)$/g, (el) => `${WC_MARKER}=${el.substring(1)}`);
					let toAdd = part;
					if (attrDelimiter) toAdd += WC_MARKER;
					else toAdd += '"0"';
					html += toAdd;
				}
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
	html = html.replace(selfClosingRegex, (match, firstPart, componentName) => {
		if (match.endsWith('/>')) return `${firstPart}></${componentName}>`;
		return match;
	});
	html = html.replace(/<[a-z]*-[a-z]*\s?.*?>/gms, (match) => {
		return match.replace(/(?<=\s)([a-z]+([A-Z][a-z]*)+)[=\s]/gms, (attr) =>
			attr.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
		);
	});
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
const __createTemplate = (html: RenderHtml) => {
	const [dom, attributes] = __createHtml(html.parts);
	const template = document.createElement('template');
	template.innerHTML = dom;
	const dependencies = __createDependencies(template, html.parts, attributes);
	return new CachedTemplate(template, dependencies);
};

/**
 * This function will compare the parts of the new and old template. If one of the parts differs,
 * means the 2 templates are not equal.
 * @param render The whole result of the `html` function
 * @returns The string representation of the the template.
 */
const __areSameTemplates = (newTemplate: RenderHtml, oldTemplate: RenderHtml) => {
	if (!newTemplate || !oldTemplate) return false;
	const newParts = newTemplate.parts;
	const oldParts = oldTemplate.parts;
	if (newParts.length !== oldParts?.length) return false;
	const newValues = newTemplate.values;
	const oldValues = oldTemplate.values;
	for (let i = 0; i < newParts.length; i++) {
		if (newParts[i] !== oldParts[i]) return false;
		if (newValues[i]?._$wompoF) {
			if (!oldValues[i]?._$wompoF) return false;
			if (newValues[i].componentName !== oldValues[i].componentName) return false;
		}
	}
	return true;
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
	const isWompoChildren = currentValue?._$wompoChildren;
	const childrenNeedUpdate =
		isWompoChildren && (dependency as DynamicNode).startNode.nextSibling !== currentValue.nodes[0];
	const isDynamicNodeToUpdate =
		currentValue === oldValue &&
		dependency.isTag &&
		dependency.node.nodeName === DYNAMIC_TAG_MARKER.toUpperCase();
	return valuesDiffers || isComposedAttribute || childrenNeedUpdate || isDynamicNodeToUpdate;
};

const __handleDynamicTag = (
	currentValue: any,
	currentDependency: DynamicTag,
	valueIndex: number,
	dynamics: Dynamics[],
	values: any[]
) => {
	const node = currentDependency.node;
	let customElement: HTMLElement = null;
	const isCustomComponent = currentValue._$wompoF;
	const newNodeName: string = isCustomComponent ? currentValue.componentName : currentValue;
	if (node.nodeName !== newNodeName.toUpperCase()) {
		const oldAttributes = (node as HTMLElement).getAttributeNames();
		if (isCustomComponent) {
			const initialProps: any = {};
			for (const attrName of oldAttributes) {
				// attributes on the dom will be set when creating the element
				const attrValue = (node as HTMLElement).getAttribute(attrName);
				let propName = attrName;
				if (propName.includes('-')) propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
				initialProps[propName] = attrValue === '' ? true : attrValue;
			}
			customElement = new currentValue.class() as WompoElement;
			(customElement as WompoElement)._$initialProps = initialProps;
			(customElement as WompoElement).props = initialProps;
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
		let index = valueIndex;
		let currentDynamic = dynamics[index] as DynamicAttribute;
		while (currentDynamic?.node === node) {
			// Update node pointer of dynamics pointing to the old one.
			currentDynamic.node = customElement;
			if (index === valueIndex) {
				// Skip first value, which is the dynamic node itself.
				index++;
				currentDynamic = dynamics[index] as DynamicAttribute;
			} else {
				// Set initial props of the correct type, so a number doesn't become a string
				if (currentDynamic?.name && currentDynamic?.name !== 'ref') {
					((customElement as WompoElement)._$initialProps as any)[currentDynamic.name] =
						values[index];
					((customElement as WompoElement).props as any)[currentDynamic.name] = values[index];
				}
				index++;
				currentDynamic = dynamics[index] as DynamicAttribute;
			}
		}
		node.replaceWith(customElement);
		return customElement;
	}
	return node;
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
		// Update References
		if (currentValue?.__wcRef && currentDependency.isAttr && currentDependency.name === 'ref')
			currentValue.current = currentDependency.node;
		if (!__shouldUpdate(currentValue, oldValue, currentDependency))
			// Skip update: values are the same
			continue;
		if (currentDependency.isNode) {
			// Falsy values are cleared from the DOM
			if (currentValue === false || currentValue === undefined || currentValue === null) {
				currentDependency.clearValue();
				continue;
			}
			if (currentValue?._$wompoHtml) {
				// handle template elements
				const areTheSame = __areSameTemplates(currentValue, oldValue);
				if (oldValue === undefined || !areTheSame) {
					const cachedTemplate = __createTemplate(currentValue);
					const template = cachedTemplate.clone();
					const [fragment, dynamics] = template;
					newValues[i] = new HtmlProcessedValue(currentValue, template);
					newValues[i].values = __setValues(
						dynamics,
						currentValue.values,
						oldValue?.values ?? oldValue ?? []
					);
					const startNode = (currentDependency as DynamicNode).startNode;
					currentDependency.clearValue();
					let currentNode = startNode;
					while (fragment.childNodes.length) {
						currentNode.after(fragment.childNodes[0]);
						currentNode = currentNode.nextSibling;
					}
				} else {
					let oldTemplateValue = oldValue as HtmlProcessedValue;
					if (!oldValue.template) {
						const cachedTemplate = __createTemplate(currentValue);
						const template = cachedTemplate.clone();
						newValues[i] = new HtmlProcessedValue(currentValue, template);
						oldTemplateValue = newValues[i];
					}
					const [_, dynamics] = oldTemplateValue.template;
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
				if (currentValue._$wompoChildren) {
					if (oldValue && !oldValue?._$wompoChildren) currentDependency.clearValue();
					const childrenNodes = (currentValue as WompoChildren).nodes;
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
						if (!(oldValue as WompoArrayDependency)?.isArrayDependency) {
							currentDependency.clearValue();
							newValues[i] = new WompoArrayDependency(currentValue, currentDependency);
						} else newValues[i] = (oldValue as WompoArrayDependency).checkUpdates(currentValue);
					} else if (DEV_MODE) {
						throw new Error(
							'Rendering objects is not supported. Please stringify or remove the object.'
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
						const value =
							dynamicValue !== undefined && dynamicValue !== null && dynamicValue !== false
								? dynamicValue
								: '';
						parts[j] = `${parts[j]}${value}`;
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
			const isLazy = currentValue._$wompoLazy;
			if (isLazy) {
				const node = currentDependency.node;
				const suspenseNode = findSuspense(node) as SuspenseInstance | null;
				if (suspenseNode) {
					if (suspenseNode.addSuspense) {
						suspenseNode.addSuspense(node);
					} else {
						suspenseNode.loadingComponents = new Set();
						suspenseNode.loadingComponents.add(node);
					}
					(node as any).suspense = suspenseNode;
				}
				// Catch is handled inside the lazy() function.
				currentValue().then((Component: WompoComponent) => {
					const customElement = __handleDynamicTag(
						Component,
						currentDependency,
						i,
						dynamics,
						values
					);
					if (suspenseNode) suspenseNode.removeSuspense(node, customElement);
				});
				continue;
			} else {
				__handleDynamicTag(currentValue, currentDependency, i, dynamics, values);
			}
		}
	}
	return newValues;
};

/* 
================================================
WOMPO COMPONENT DEFINITION
================================================
*/
/**
 * This function will convert the functional component into an extension class of the HTMLElement,
 * so that it can be used to create the custom web-component.
 * @param Component The Component function
 * @param options The options of the component.
 * @returns A new dynamic class that will be used to create the custom web-component
 */
const _$wompo = <Props extends WompoProps, E>(
	Component: WompoComponent,
	options: WompoComponentOptions
): WompoElementClass<Props, E> => {
	const { generatedCSS, styles } = Component.options;
	const sheet = new CSSStyleSheet();
	sheet.replaceSync(generatedCSS);
	/**
	 * The dynamic class created to make it possible to create a custom web-component
	 */
	const WompoComponent = class extends HTMLElement implements WompoElement {
		static _$wompo = true; // For faster access

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
		static _$getOrCreateTemplate(html: RenderHtml) {
			if (!this._$cachedTemplate) this._$cachedTemplate = __createTemplate(html);
			return this._$cachedTemplate;
		}

		public _$wompo: true = true; // For faster access

		public props: WompoProps = {};
		public hooks: Hook[] = [];
		public _$measurePerf: boolean = false;
		public _$initialProps: WompoProps = {} as any;
		public _$usesContext: boolean = false;
		public _$hasBeenMoved: boolean = false;
		public _$layoutEffects: EffectHook[] = [];
		public _$effects: EffectHook[] = [];
		public _$asyncCalls: AsyncHook<any>[] = [];
		public _$suspendedAsyncCalls: AsyncHook<any>[] = [];

		/** The Root. It'll be the node itself, or it's ShadowRoot if shadow is set to true */
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
		/** It's true if the component has been disconnected from the DOM. */
		private __disconnected: boolean = false;
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
			// If the element is disconnected and connected again, then execute again all effects.
			if (this.__disconnected && this.isConnected) {
				this.__disconnected = false;
				for (const hook of this.hooks) {
					if ((hook as EffectHook)?.callback) {
						// Effect hooks are executed again since the component has been connected again.
						Promise.resolve().then(() => {
							(hook as EffectHook).callback();
						});
					}
				}

				if (this._$suspendedAsyncCalls.length) {
					const suspense = findSuspense(this);
					const promises: Promise<any>[] = [];
					for (const asyncHook of this._$suspendedAsyncCalls) {
						if (asyncHook.activateSuspense) suspense?.addSuspense(this);
						promises.push(
							asyncHook.asyncCallback().then((data) => {
								asyncHook.value = data;
							})
						);
					}
					this._$suspendedAsyncCalls = [];
					Promise.all(promises).then(() => {
						this.requestRender();
						suspense?.removeSuspense(this);
					});
				}

				this._$hasBeenMoved = true;
				if (this._$usesContext) this.requestRender();
			}
			this.__isInDOM = true;
			if (!this.__connected && this.isConnected) this.__initElement();
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
						this.__disconnected = true;
						for (const hook of this.hooks) {
							if ((hook as EffectHook)?.cleanupFunction) (hook as any).cleanupFunction();
						}
					} else {
						this._$hasBeenMoved = true;
						if (this._$usesContext) this.requestRender();
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
		private __initElement() {
			this.__ROOT = this; // Shadow DOM is eventually attached later
			this.props = {
				...this.props,
				...this._$initialProps,
				styles: styles,
			} as any;

			const componentAttributes = this.getAttributeNames();
			for (const attrName of componentAttributes) {
				let propName = attrName;
				if (propName.includes('-')) propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
				if (!this.props.hasOwnProperty(propName)) {
					const attrValue = this.getAttribute(attrName);
					(this.props as any)[propName] = attrValue === '' ? true : attrValue;
				}
			}

			// Set initialProps as attributes
			const initialPropsKeys = Object.keys(this._$initialProps);
			for (const key of initialPropsKeys) {
				const prop = this._$initialProps[key as keyof typeof this._$initialProps];
				if (prop !== Object(prop) && (prop || (prop as any) === 0) && key !== 'title') {
					this.setAttribute(
						key.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`),
						prop.toString()
					);
				}
			}

			if (DEV_MODE && this.props.wcPerf) this._$measurePerf = true;

			if (DEV_MODE && this._$measurePerf) console.time('First render ' + options.name);
			// The children are saved in a WompoChildren instance, so that
			// they are not lost even when disconnected from the DOM.
			const childNodes = this.__ROOT.childNodes;
			const childrenArray: Node[] = [];
			// Removing items from the DOM doesn't delete them.
			while (childNodes.length) {
				childrenArray.push(childNodes[0]);
				childNodes[0].remove();
			}
			const children = new WompoChildren(childrenArray);
			this.props.children = children;

			// Create shadow DOM
			if (options.shadow && !this.shadowRoot) this.__ROOT = this.attachShadow({ mode: 'open' });

			const componentName = this.nodeName.toLowerCase();
			if (!adoptedStyles[componentName]) adoptedStyles[componentName] = [];

			if (options.shadow) {
				if (!adoptedStyles[componentName].includes(this.__ROOT)) {
					adoptedStyles[componentName].push(this.__ROOT);
					(this.__ROOT as ShadowRoot).adoptedStyleSheets = [sheet];
				}
			} else {
				const root = this.getRootNode();
				if (!adoptedStyles[componentName].includes(root)) {
					adoptedStyles[componentName].push(root);
					(root as Document | ShadowRoot).adoptedStyleSheets.push(sheet);
				}
			}

			// Render
			this.__render();

			this.__isInitializing = false;
			this.__connected = true;

			// Observe attributes mutations
			new MutationObserver((mutationRecords) => {
				if (!this.__updating) {
					mutationRecords.forEach((record) => {
						if (!mutationAttributesExclusions.includes(record.attributeName)) {
							let propName = record.attributeName;
							if (propName.includes('-'))
								propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
							const newAttrVal = this.getAttribute(record.attributeName);
							// So that 2 will not cause a re-render because of "2"
							if (this.props[propName as keyof WompoProps] != newAttrVal)
								this.updateProp(propName, this.getAttribute(record.attributeName));
						}
					});
				}
			}).observe(this, { attributes: true });

			if (DEV_MODE && this._$measurePerf) console.timeEnd('First render ' + options.name);
		}

		/**
		 * Calls the functional component by first setting correct values to the
		 * [currentRenderingComponent] and [currentHookIndex] variables.
		 * @returns The result of the call.
		 */
		private __callComponent() {
			currentRenderingComponent = this;
			currentHookIndex = 0;
			const result = Component.call(this, this.props);
			let renderHtml: RenderHtml = result as RenderHtml;
			if (typeof result === 'string' || result instanceof HTMLElement) renderHtml = html`${result}`;
			return renderHtml;
		}

		/**
		 * Calls the component and executes the operations to update the DOM.
		 */
		private __render() {
			try {
				const renderHtml = this.__callComponent();
				if (renderHtml === null || renderHtml === undefined) {
					this.__dynamics = [];
					this.__oldValues = [];
					this.remove();
					return;
				}
				const constructor = this.constructor as typeof WompoComponent;
				if (this.__isInitializing) {
					const template = constructor._$getOrCreateTemplate(renderHtml);
					const [fragment, dynamics] = template.clone();
					this.__dynamics = dynamics;
					const elaboratedValues = __setValues(
						this.__dynamics,
						renderHtml.values,
						this.__oldValues
					);
					this.__oldValues = elaboratedValues;
					if (!this.__isInitializing) this.__ROOT.innerHTML = '';
					while (fragment.childNodes.length) {
						this.__ROOT.appendChild(fragment.childNodes[0]);
					}
				} else {
					const oldValues = __setValues(this.__dynamics, renderHtml.values, this.__oldValues);
					this.__oldValues = oldValues;
				}
				for (const layoutEffectHook of this._$layoutEffects) {
					layoutEffectHook.cleanupFunction = layoutEffectHook.callback();
				}
				this._$layoutEffects = [];
				Promise.resolve().then(() => {
					// Only if the component is still in the DOM, execute effects and async calls
					if (this.isConnected) {
						// Handle effect hooks
						for (const effectHook of this._$effects) {
							effectHook.cleanupFunction = effectHook.callback();
						}
						this._$effects = [];

						// Handle async calls
						if (this._$asyncCalls.length) {
							const promises: Promise<any>[] = [];
							const suspense = findSuspense(this);
							for (const asyncHook of this._$asyncCalls) {
								if (asyncHook.activateSuspense) suspense?.addSuspense(this);
								const promise = asyncHook
									.asyncCallback()
									.then((data) => {
										asyncHook.value = data;
									})
									.catch((err) => console.error(err));
								promises.push(promise);
							}
							Promise.all(promises).then(() => {
								suspense?.removeSuspense(this);
								this.requestRender();
							});
						}
						this._$asyncCalls = [];
					} else {
						this._$suspendedAsyncCalls = this._$asyncCalls;
					}
				});
			} catch (err) {
				console.error(err);
				if (DEV_MODE) {
					const error = new WompoError.class();
					(error.props as WompoErrorProps).error = err;
					(error.props as WompoErrorProps).element = this;
					this.__ROOT.innerHTML = '';
					this.__ROOT.appendChild(error);
				}
			}
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
					this.__render();
					this.__updating = false;
					this._$hasBeenMoved = false;
					if (DEV_MODE && this._$measurePerf) console.timeEnd('Re-render ' + options.name);
				});
			}
		}

		/**
		 * It'll set a new value to a specific prop of the component, and a re-render will be requested.
		 * @param prop The prop name.
		 * @param value The new value to set.
		 */
		public updateProp(prop: string, value: any) {
			if ((this.props as any)[prop] !== value) {
				(this.props as any)[prop] = value;
				if (!this.__isInitializing) {
					this.requestRender();
				}
			}
		}
	};
	return WompoComponent as unknown as WompoElementClass<Props, E>;
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
export const useHook = (): [WompoElement, number] => {
	const currentComponent = currentRenderingComponent;
	const currentIndex = currentHookIndex;
	const res: [WompoElement, number] = [currentComponent, currentIndex];
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
export const useState = <S>(initialState: S | (() => S)) => {
	const [component, hookIndex] = useHook();
	if (!component) {
		// Server context
		if (typeof initialState === 'function')
			return [(initialState as () => S)(), () => {}] as StateHook<S>;
		return [initialState, () => {}] as StateHook<S>;
	}
	if (!component.hooks.hasOwnProperty(hookIndex)) {
		const index = hookIndex;
		component.hooks[index] = [
			typeof initialState === 'function' ? (initialState as () => S)() : initialState,
			(newValue: S) => {
				let computedValue = newValue;
				const stateHook = component.hooks[index] as StateHook<S>;
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
	const state = component.hooks[hookIndex] as StateHook<S>;
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
export const useEffect = (
	callback: VoidFunction | (() => VoidFunction),
	dependencies: any[] = null
) => {
	const [component, hookIndex] = useHook();
	if (!component.hooks.hasOwnProperty(hookIndex)) {
		const effectHook = {
			dependencies: dependencies,
			callback: callback,
			cleanupFunction: null,
		} as EffectHook;
		component.hooks[hookIndex] = effectHook;
		component._$effects.push(effectHook);
	} else {
		const effectHook = component.hooks[hookIndex] as EffectHook;
		if (dependencies !== null) {
			for (let i = 0; i < dependencies.length; i++) {
				const oldDep = effectHook.dependencies[i];
				if (oldDep !== dependencies[i]) {
					if (typeof effectHook.cleanupFunction === 'function') effectHook.cleanupFunction();
					effectHook.dependencies = dependencies;
					effectHook.callback = callback;
					component._$effects.push(effectHook);
					break;
				}
			}
		} else {
			effectHook.callback = callback;
			component._$effects.push(effectHook);
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
	dependencies: any[] = null
) => {
	const [component, hookIndex] = useHook();
	if (!component.hooks.hasOwnProperty(hookIndex)) {
		const layoutEffectHook = {
			dependencies: dependencies,
			callback: callback,
			cleanupFunction: null,
		} as EffectHook;
		component.hooks[hookIndex] = layoutEffectHook;
		component._$layoutEffects.push(layoutEffectHook);
	} else {
		const layoutEffectHook = component.hooks[hookIndex] as EffectHook;
		if (dependencies !== null) {
			for (let i = 0; i < dependencies.length; i++) {
				const oldDep = layoutEffectHook.dependencies[i];
				if (oldDep !== dependencies[i]) {
					if (typeof layoutEffectHook.cleanupFunction === 'function')
						layoutEffectHook.cleanupFunction();
					layoutEffectHook.dependencies = dependencies;
					layoutEffectHook.callback = callback;
					component._$layoutEffects.push(layoutEffectHook);
					break;
				}
			}
		} else {
			layoutEffectHook.callback = callback;
			component._$layoutEffects.push(layoutEffectHook);
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
export const useRef = <T>(initialValue: T = null) => {
	const [component, hookIndex] = useHook();
	if (!component.hooks.hasOwnProperty(hookIndex)) {
		component.hooks[hookIndex] = {
			current: initialValue,
			__wcRef: true,
		} as RefHook<T>;
	}
	const ref = component.hooks[hookIndex] as RefHook<T>;
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
 * more expensive to store the callback and get it back every time.
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
export const useCallback = <C = (...args: any[]) => any>(
	callbackFn: C,
	dependencies: any[] = []
) => {
	const [component, hookIndex] = useHook();
	if (!component.hooks.hasOwnProperty(hookIndex)) {
		component.hooks[hookIndex] = {
			dependencies: dependencies,
			value: callbackFn,
		} as CallbackHook<C>;
	} else {
		const callbackHook = component.hooks[hookIndex] as CallbackHook<C>;
		for (let i = 0; i < dependencies.length; i++) {
			const oldDep = callbackHook.dependencies[i];
			if (oldDep !== dependencies[i]) {
				callbackHook.dependencies = dependencies;
				callbackHook.value = callbackFn;
				break;
			}
		}
	}
	const callback = component.hooks[hookIndex] as CallbackHook<C>;
	return callback.value;
};

const useIdMemo = () => {
	let counter = 0;
	return () => {
		const [component, hookIndex] = useHook();
		if (!component.hooks.hasOwnProperty(hookIndex)) {
			component.hooks[hookIndex] = `:w${counter}:` as IdHook;
			counter++;
		}
		const callback = component.hooks[hookIndex];
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
export const useMemo = <T>(callbackFn: () => T, dependencies: any[]) => {
	const [component, hookIndex] = useHook();
	if (!component.hooks.hasOwnProperty(hookIndex)) {
		component.hooks[hookIndex] = {
			value: callbackFn(),
			dependencies: dependencies,
		} as MemoHook<T>;
	} else {
		const oldMemo = component.hooks[hookIndex] as MemoHook<T>;
		for (let i = 0; i < dependencies.length; i++) {
			const oldDep = oldMemo.dependencies[i];
			if (oldDep !== dependencies[i]) {
				oldMemo.dependencies = dependencies;
				oldMemo.value = callbackFn();
				break;
			}
		}
	}
	const memoizedResult = component.hooks[hookIndex] as MemoHook<T>;
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
	if (!component.hooks.hasOwnProperty(index)) {
		const dispatch = (action: ReducerAction) => {
			const currentState = (component.hooks[index] as ReducerHook<State>)[0];
			const partialState = reducer(currentState, action);
			let newState: State = partialState as State;
			if (
				typeof currentState === 'object' &&
				!Array.isArray(currentState) &&
				currentState !== null
			) {
				// Merge the partial state with the old one if it's an object
				newState = {
					...currentState,
					...partialState,
				} as State;
			}
			(component.hooks[hookIndex] as ReducerHook<State>)[0] = newState;
			if (newState !== currentState) component.requestRender();
		};
		const reducerHook: ReducerHook<State> = [initialState, dispatch];
		component.hooks[hookIndex] = reducerHook;
	}
	const stateAndReducer = component.hooks[hookIndex] as ReducerHook<State>;
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
export const useExposed = <E = {}>(toExpose: E) => {
	// No need to use useHook and increase the hook index
	const component = currentRenderingComponent;
	const keys = Object.keys(toExpose) as (keyof E)[];
	for (const key of keys) {
		(component as any)[key] = toExpose[key];
	}
};

/**
 * Executes the callback function in the useAsync hook.
 * @param hook The hook data.
 * @param callback The async callback.
 * @param newDependencies The new array of dependencies.
 * @param activateSuspense Whether to activate or not a parent Suspense element.
 */
const executeUseAsyncCallback = <S>(
	hook: [WompoElement, number],
	callback: () => Promise<S>,
	newDependencies: any[],
	activateSuspense: boolean
) => {
	const [component, hookIndex] = hook;
	const asyncHook = component.hooks[hookIndex] as AsyncHook<S>;
	asyncHook.activateSuspense = activateSuspense;
	asyncHook.value = null;
	asyncHook.asyncCallback = callback;
	asyncHook.dependencies = newDependencies;
	component._$asyncCalls.push(asyncHook);
};

/**
 * The `useAsync` hook allows to resolve a promise. It accepts a callback and a list of dependencies
 * as parameters. The callback must return a promise and will be executed on first render and
 * whenever one of the dependencies changes.
 * The hook will return `null` if the promise is being resolved, otherwise the result of the
 * promise. The component will be automatically re-rendered once the promise is resolved.
 *
 * It can be used with a parent `Suspanse` instance to show a loading indicator while the promise
 * is being resolved.
 *
 * The useAsync hook accepts a third parameter: **activateSuspense**. It is a boolean value that by
 * default is `true`. If it's set to `false`, the useAsync hook will NOT trigger a parent `Suspense`
 * element.
 *
 * @example
 * ```javascript
 * const callback = async () => {
 *   return new Promise((resolve) => { setTimeout(() => { resolve('Solved!'); }, 5000); });
 * }
 *
 * function Results() {
 *   const data = useAsync(callback, []);
 *   return html`${data}`;
 * }
 *
 * function App(){
 *   return html`<${Suspanse} fallback=${html`Loading...`}>
 *     <${Results} />
 *   </${Suspanse}>`
 * }
 * ```
 * @param promise The promise to resolve.
 * @returns The result of the promise or null if it's pending or rejected.
 */
export const useAsync = <S>(
	callback: () => Promise<S>,
	dependencies: any[],
	activateSuspense = true
): null | S => {
	const [component, hookIndex] = useHook();
	if (!component.hooks.hasOwnProperty(hookIndex)) {
		component.hooks[hookIndex] = {
			asyncCallback: callback,
			dependencies: dependencies,
			value: null,
			activateSuspense: activateSuspense,
		} as AsyncHook<S>;
		executeUseAsyncCallback([component, hookIndex], callback, dependencies, activateSuspense);
	} else {
		const oldAsync = component.hooks[hookIndex] as AsyncHook<S>;
		let newCall = false;
		for (let i = 0; i < dependencies.length; i++) {
			const oldDep = oldAsync.dependencies[i];
			if (oldDep !== dependencies[i]) {
				newCall = true;
				break;
			}
		}
		if (newCall) {
			executeUseAsyncCallback([component, hookIndex], callback, dependencies, activateSuspense);
		}
	}
	return (component.hooks[hookIndex] as AsyncHook<S>).value;
};

/* 
================================================
CONTEXT
================================================
*/

/**
 * The Context interface
 */
export interface Context<S = any> {
	Provider: WompoComponent<ContextProviderProps>;
	default: S;
	name: string;
}

const createContextMemo = () => {
	let contextIdentifier = 0;
	return <S>(initialValue: S, providerName?: string): Context<S> => {
		const name = providerName ?? `wompo-context-provider-${contextIdentifier}`;
		contextIdentifier++;
		const ProviderFunction = defineWompo<ContextProviderProps, ContextProviderExposed>(
			({ children, value }: ContextProviderProps) => {
				const initialSubscribers = new Set<WompoElement>();
				const subscribers = useRef(initialSubscribers);
				useEffect(() => {
					subscribers.current.forEach((el) => {
						if (el.isConnected) el.requestRender();
					});
				}, [value]);
				useExposed({ subscribers: subscribers });
				return html`${children}`;
			},
			{
				name: name,
				cssModule: false,
			}
		);
		const Context = {
			name: name,
			Provider: ProviderFunction,
			default: initialValue,
			subscribers: new Set<WompoElement>(),
		};
		return Context;
	};
};

/**
 * The createContext function returns a Context instance that can be used to pass down a property
 * to all its children. This can be quite useful to avoid passing down props infinitely.
 * The function accepts a single parameter, that is the default value that will be used if a
 * component requires a context that does't have a parent providing the requested value.
 *
 * To initialize the component you'll have to put in the DOM the Context.Provider instance, which
 * accepts a single prop: value. This value will then be passed down to the components that use the
 * `useContext` hook.
 *
 * @example
 * ```javascript
 * const ThemeContext = createContext('light');
 *
 * function App(){
 *   const [theme, setTheme] = useState('light');
 *   const toggle = () => {
 *     if(theme === 'light') setTheme('dark');
 *     if(theme === 'dark') setTheme('light');
 *   }
 *   return html`
 *     <button \@click=${toggle}>Toggle Theme</button>
 *     <${ThemeContext.Provider} value=${theme}>
 *       <${CompWithTheme} />
 *     </${ThemeContext.Provider}>
 *   `;
 * }
 *
 * function CompWithTheme(){
 *   const theme = useContext(ThemeContext);
 *   return html`<p>Current Theme: ${theme}.</p>`;
 * }
 * ```
 */
export const createContext = createContextMemo();

/**
 * The useContext hook is used to obtain the current value provided bya a parent Context.Provider
 * element. The context must be created first with the `createContext` function.
 * @param Context The context to use.
 * @returns The value of the context above the element.
 */
export const useContext = <S>(Context: Context<S>): S => {
	const [component, hookIndex] = useHook();
	if (!component.hooks.hasOwnProperty(hookIndex) || component._$hasBeenMoved) {
		let parent = component as Node;
		const toFind = Context.name.toUpperCase();
		while (parent && parent.nodeName !== toFind && parent !== document.body) {
			if (parent instanceof ShadowRoot) parent = parent.host;
			else parent = parent.parentNode;
		}
		const oldParent = (component.hooks[hookIndex] as ContextHook)?.node;
		if (parent && parent !== document.body) {
			(parent as ContextProviderElement).subscribers.current.add(component);
			if (!component._$usesContext) {
				const oldDisconnect = component.onDisconnected;
				component.onDisconnected = () => {
					(parent as ContextProviderElement).subscribers.current.delete(component);
					oldDisconnect();
				};
			}
			component._$usesContext = true;
		} else if (oldParent) {
			if (DEV_MODE) {
				console.warn(
					`The element ${component.tagName} doens't have access to the Context ${Context.name} ` +
						'because is no longer a child of it.'
				);
			}
			parent = null;
			oldParent.subscribers.current.delete(component);
		} else if (component.isConnected) {
			console.warn(
				`The element ${component.tagName} doens't have access to the Context ${Context.name}. ` +
					'The default value will be returned instead.'
			);
			parent = null;
		}
		component.hooks[hookIndex] = {
			node: parent,
		} as ContextHook;
	}
	const contextNode = (component.hooks[hookIndex] as ContextHook).node;
	return contextNode ? contextNode.props.value : Context.default;
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
	if (!IS_SERVER) {
		for (let i = 0; i < length; i++) {
			// Don't include dynamic closing tags
			if (!templateParts[i].endsWith('</')) cleanValues.push(values[i]);
		}
	} else {
		cleanValues.push(...values);
	}
	return {
		parts: templateParts,
		values: cleanValues,
		_$wompoHtml: true,
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
 * - `cssModule`: true (boolean)
 */
export const wompoDefaultOptions: WompoComponentOptions = {
	shadow: false,
	name: '',
	cssModule: true,
};

/* 
================================================
DEFINE WOMPO COMPONENT
================================================
*/
export const registeredComponents: { [key: string]: WompoComponent } = {};
/**
 * The defineWompo function will be the trigger point to generate your custom web component.
 * It accepts 2 parameter: your functional component and the options to customize it.
 * The current available options are the followings:
 * - `name` (string)
 * - `shadow` (boolean).
 * - `cssModule` (boolean)
 *
 * The default values will depend on the [wompoDefaultOptions] variable.
 *
 * The functional component can have the css property, wich is a string corresponding to its styles.
 *
 * The `name` of the component will be the one specified in the options, or, if not specified, will
 * be the hyphen-cased name of the functional component. If the generated name will not have at
 * least one hyphen, a "-wompo" string will be appended in the end.
 * Example: function CounterComponent(){} -> counter-component
 * Example2: function Counter(){} -> counter-wompo
 *
 * The `shadow` option, if true, will build the content of the component in a Shadow DOM.
 *
 * The `cssModule` option will transform the css of the component by replacing the classes with
 * unique names, that will then be passed in the `styles` props of the component.
 *
 * @example
 * ```javascript
 * function Greetings(){
 *   return html`<p>Hello World!</p>`
 * }
 * Greetings.css = `p { color: blue; }`
 *
 * export default defineWompo(Greetings, {
 *   name: 'greetings-component',
 *   shadow: true,
 * })
 * ```
 *
 * @param component The functional component.
 * @param options The options of the component.
 * @returns The generated class for the component.
 */
export function defineWompo<Props extends WompoProps, E = {}>(
	Component: WompoComponent<Props & WompoProps>,
	options?: WompoComponentOptions
) {
	if (!Component.css) Component.css = '';
	const componentOptions = {
		...wompoDefaultOptions,
		...(options || {}),
	};
	if (!componentOptions.name) {
		let newName = Component.name
			.replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`)
			.toLowerCase();
		if (!newName.includes('-')) newName += '-wompo';
		componentOptions.name = newName;
	}
	Component.componentName = componentOptions.name;
	Component._$wompoF = true;
	const [generatedCSS, styles] = __generateSpecifcStyles(Component, componentOptions);
	Component.css = generatedCSS;
	Component.options = {
		generatedCSS: generatedCSS,
		styles: styles,
		shadow: componentOptions.shadow,
	};
	if (!IS_SERVER) {
		const ComponentClass = _$wompo<Props, E>(Component, componentOptions);
		Component.class = ComponentClass;
		customElements.define(componentOptions.name, ComponentClass);
	}
	registeredComponents[componentOptions.name] = Component;
	return Component as WompoComponent<Props & WompoProps>;
}

/* 
================================================
METHODS
================================================
*/

export type LazyCallbackResult = Promise<{ default: WompoComponent }>;
export type LazyResult = {
	(): Promise<WompoComponent<WompoProps>>;
	_$wompoLazy: boolean;
};

/**
 * The lazy function allows to asynchronously import a component. The load function will be executed
 * only when the component is used, and the result will be cached so that for the next times it'll
 * always return the loaded component. The lazy component can then be combined with the `Suspense`
 * component to render a loading interface while the lazy component is loading.
 *
 * @example
 * ```javascript
 * const DynamicallyLoadedComponent = lazy(() => import('./super-big-component.js'));
 *
 * function App(){
 *   return html`
 *     <${Suspense} fallback=${html`<i>Loading...</i>`}>
 *       <${DynamicallyLoadedComponent} />
 *     </${Suspense}>
 *   `
 * }
 * ```
 * @param load The callback that loads the component
 * @returns A LazyComponent or the loaded compnent
 */
export const lazy = (load: () => LazyCallbackResult): LazyResult => {
	let loaded: WompoComponent = null;
	async function LazyComponent() {
		if (!loaded) {
			try {
				const importedModule = await load();
				loaded = importedModule.default;
				return loaded;
			} catch (err) {
				console.error(err);
				return WompoError;
			}
		}
		return loaded;
	}
	LazyComponent._$wompoLazy = true;
	return LazyComponent;
};

interface SuspenseProps extends WompoProps {
	fallback: RenderHtml;
}
interface SuspenseInstance extends WompoElement {
	loadingComponents: Set<Node>;
	/**
	 * Adds a node to the Suspense instance, and re-render.
	 * @param node The node that is suspended.
	 */
	addSuspense: (node: Node) => void;
	/**
	 * Remove a node from the Suspense instance. If the node is a new Node (e.g. a dynamic Tag),
	 * you should also add the second parameter (the new node).
	 * @param node The node that is suspended.
	 * @param newNode The new node to replace the old one with.
	 */
	removeSuspense: (node: Node, newNode?: Node) => void;
}

/**
 * Finds the closest Suspanse parent node and returns it. If the [startNode] has not parent Suspanse
 * instances, it'll return null.
 * @param startNode The node (possibly a chil of a Suspanse instance).
 * @returns The Found Suspanse instance or null.
 */
const findSuspense = (startNode: Node): SuspenseInstance | null => {
	let suspense = startNode;
	while (
		suspense &&
		suspense.nodeName !== (Suspense as WompoComponent).componentName.toUpperCase()
	) {
		if (suspense.parentNode === null && (suspense as ShadowRoot).host)
			suspense = (suspense as ShadowRoot).host;
		else suspense = suspense?.parentNode;
	}
	return suspense as SuspenseInstance | null;
};

/* 
================================================
COMPONENTS
================================================
*/
interface WompoErrorProps extends WompoProps {
	error: any;
	element: WompoElement;
}

let WompoError: WompoComponent;
if (DEV_MODE) {
	WompoError = function ({ styles: s, error, element }: WompoErrorProps) {
		let content;
		if (element && error) {
			content = html`<div>
				<p>An error rised while rendering the element "${element.nodeName.toLowerCase()}".</p>
				<p>${error.stack.split('\n').map((row: string) => html`${row}<br />`)}</p>
			</div>`;
		} else {
			content = html`<div>
				<p>An error rised while rendering. Check the developer console for more details.</p>
			</div>`;
		}
		return html`${content}`;
	} as any;
	WompoError.css = `
		:host {
			display: block;
			padding: 20px;
			background-color: #ffd0cf;
			color: #a44040;
			margin: 20px;
			border-left: 3px solid #a44040;
		}
	`;
	defineWompo(WompoError, { name: 'wompo-error', shadow: true });
}

/**
 * The Suspense component is used to render a Loading UI while its children are still being rendered
 * because they are lazy or because one of its children has a deferred value that is being updated.
 *
 * @example
 * ```javascript
 * const DynamicallyLoadedComponent = lazy(() => import('./super-big-component.js'));
 *
 * function App(){
 *   return html`
 *     <${Suspense} fallback=${html`<i>Loading...</i>`}>
 *       <${DynamicallyLoadedComponent} />
 *     </${Suspense}>
 *   `
 * }
 * ```
 * @param props Accepts children and a Fallback component.
 * @returns The Fallback if loading, otherwise the loaded content.
 */
export function Suspense({ children, fallback }: SuspenseProps) {
	if (!this.loadingComponents) {
		this.loadingComponents = useRef(new Set<Node>()).current;
	}
	this.addSuspense = (node: Node) => {
		if (!this.loadingComponents.size) this.requestRender();
		this.loadingComponents.add(node);
	};
	this.removeSuspense = (node: Node, newNode: Node = null) => {
		this.loadingComponents.delete(node);
		if (newNode) {
			for (let i = 0; i < children.nodes.length; i++) {
				if (children.nodes[i] === node) {
					children.nodes[i] = newNode;
					break;
				}
			}
		}
		if (!this.loadingComponents.size) this.requestRender();
	};
	if (this.loadingComponents.size && fallback) return html`${fallback}`;
	return html`${children}`;
}
defineWompo(Suspense, {
	name: 'wompo-suspense',
});

// TODO Add ErrorBoundary component
// TODO Handle DEV_MODE based on Production or Development environment
