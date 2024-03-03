export interface CmxsProps {
	children?: NodeList;
	[key: string]: any;
}

export interface RenderHtml {
	parts: TemplateStringsArray;
	values: any[];
	__cmxs: true;
}

/**
 * The CmxsComponent is the base class for creating a custom web-component with a lot of features
 * that makes it easy to handle them. Specifically, a CmxsComponent can be dynamic and it handles
 * automatically the re-rendering of itself and the other sub-components.
 *
 * To create a custom component, you just have to create a class that extends the CmxsComponent and
 * define a render method, like so:
 *
 * ```javascript
 * class CustomComponent extends CmxsComponent {
 *   static componentName = 'custom-component';
 *   static {
 *     defineCmxsComponent(this);
 *   }
 *   render(){
 *     return html`<div>Hello World!</div>`
 *   }
 * }
 * ```
 */
export default class CmxsComponent<Props extends CmxsProps = {}, State = {}> extends HTMLElement {
	/** The name of the component. It's required to make the component work */
	static componentName = '';

	/**
	 * The options of the component. For now it only accepts the following parameters:
	 * - **isolated**: `boolean`. Default: `false`
	 */
	static options: {
		isolated?: boolean;
	} = {};

	/** The initial state of the props of the component. */
	static initialProps: { [key: string]: any } = {};

	/** The CSS string of the component. Each class will be replaces with a more specific one */
	static css = '';

	/**
	 * It's a singleton property specific to each component that gets generated once a component is
	 * created for the first time. It holds all the subsitute classes generated to make the styles
	 * of a component unique, avoiding the override of other components styles.
	 */
	private static __specificComponentCssGenerated: { [className: string]: string } = null;

	constructor() {
		super();
	}

	/**
	 * =================================================================
	 * NATIVE CALLBACKS
	 * =================================================================
	 */

	/** @override component is connected to DOM */
	connectedCallback() {
		this.initElement();
	}

	/** @override component is disconnected from DOM */
	disconnectedCallback() {
		this.onDisconnected();
	}

	/** @override An attribute of the component changes */
	attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		if (this.isConnected) this.onAttributeChanged(name, oldValue, newValue);
	}

	/**
	 * The root of the component. If it's not isolated, the ROOT correspons to the "this" keyword,
	 * otherwise it's the shadowRoot.
	 */
	private ROOT: this | ShadowRoot;

	/** A property to mark the element as a CmxsComponent, */
	public _cmxsComponent = true;

	/** An indicator of rater if the component is in a rendering phase or not. */
	private rendering = false;

	/** The attributes of the component. */
	public props: Props;

	/**
	 * The state of the component. You should **NOT** update the state manually. Instead, use the
	 * `this.setState` function. Updating the state manually will not cause a re-rendering of the
	 * component.
	 */
	public state: State;

	/**
	 * Holds the custom CSS classes for the component.
	 */
	public styles: { [className: string]: string };

	/**
	 * =================================================================
	 * Helper functions
	 * =================================================================
	 */

	/**
	 * Initializes the component with the state, props, and styles.
	 */
	private initElement() {
		this.rendering = true;
		this.ROOT = this;

		// Initialize styles
		this.styles = this.getGeneratedStyles();

		// Initialize state
		if (!this.state) this.state = {} as State;

		// Initialize props
		if (!this.props) {
			this.props = { ...(this.constructor as typeof CmxsComponent).initialProps } as Props;
			for (const attr of this.attributes) {
				const value = attr.value;
				const attrName = attr.name as keyof Props;
				if (value === 'true') (this.props as any)[attrName] = true;
				else if (value === 'false') (this.props as any)[attrName] = false;
				else (this.props as any)[attrName] = value;
			}
		}
		if (!this.props.children) this.props.children = this.deepCloneNodes(this.childNodes);

		// Initialize DOM
		const defaultOptions = {
			isolated: false,
		};
		const options = {
			...defaultOptions,
			...(this.constructor as typeof CmxsComponent).options,
		};
		if (options.isolated) {
			this.innerHTML = '';
			this.ROOT = this.attachShadow({ mode: 'open' });
		}

		this.onInit(); // Has been initialized. Call hook
		const nodesToRender = this.getNodesToRender();

		this.ROOT.replaceChildren(...nodesToRender);
		this.rendering = false; // Node rendered
		this.onFirstRender(); // Has been rendered for the first time
		this.onRendered();
	}

	/**
	 * Generates (or only gets) the static styles of a component.
	 * @returns The generated styles specific to the component
	 */
	private getGeneratedStyles() {
		const constructor = this.constructor as typeof CmxsComponent;
		let existingStyles = true;
		const componentName = constructor.componentName;
		// If already generated, skip it
		if (!constructor.__specificComponentCssGenerated) {
			existingStyles = false;
			constructor.__specificComponentCssGenerated = {};
			const componentCss = constructor.css.trim();
			const invalidSelectors: string[] = [];
			[...componentCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
				const cssSelector = selector[1].trim();
				if (!cssSelector.includes('.')) invalidSelectors.push(cssSelector);
			});
			invalidSelectors.forEach((selector) => {
				console.warn(
					`The CSS selector "${selector} {...}" in the component "${componentName}" is not enough specific: include at least one class.\n` +
						`This can lead to some issues and chances to override global or other components styles.`
				);
			});
			const classNames = new Set<string>();
			[...componentCss.matchAll(/\.(.*?)[\s|{]/gm)].forEach((match) => {
				const className = match[1];
				classNames.add(className);
			});
			let generatedCss = componentCss;
			classNames.forEach((className) => {
				const uniqueClassName = `${componentName}__${className}`;
				generatedCss = generatedCss.replaceAll(className, uniqueClassName);
				constructor.__specificComponentCssGenerated[className] = uniqueClassName;
			});
			constructor.__specificComponentCssGenerated.__generatedCSS = generatedCss;
		}
		// If the component is inside (or it is) a shadowRoot, appends the styles inside of it, for
		// every new component, and not only once in the body. See `getNodesToRender` function.
		const root = this.ROOT.getRootNode() as Document;
		if (!existingStyles && root.body && !constructor.options.isolated) {
			const generatedCss = constructor.__specificComponentCssGenerated.__generatedCSS;
			const componentStyle = document.createElement('style');
			componentStyle.classList.add(`${componentName}__styles`);
			componentStyle.innerHTML = `\t\t${componentName}{display: block;} ${generatedCss}`;
			document.body.appendChild(componentStyle);
		}
		return constructor.__specificComponentCssGenerated;
	}

	/**
	 * Executes the `render` function and elaborates the values. It generates the corresponding
	 * Node elements to render, with the attached events, attributes, and props.
	 * @returns The list of new nodes to render and compare with the existing ones.
	 */
	private getNodesToRender() {
		const renderResult = this.render();
		let renderHtml: RenderHtml = renderResult as RenderHtml;
		if (typeof renderResult === 'string' || renderResult instanceof HTMLElement)
			renderHtml = html`${renderResult}`;
		const renderString = this.handleHtml(renderHtml);
		const selfClosingRemoved = this.handleSelfClosingTagsAndMark(renderString);
		let withStylesIfIsolated = selfClosingRemoved;
		const constructor = this.constructor as typeof CmxsComponent;
		const isIsolatedComponent = constructor.options.isolated;
		if (isIsolatedComponent || !(this.getRootNode() as Document).body) {
			const componentName = constructor.componentName;
			const styles = constructor.__specificComponentCssGenerated.__generatedCSS;
			withStylesIfIsolated += `<style class="${componentName}__styles">${styles}</style>`;
		}
		const htmlToRender = document.createElement('div');
		htmlToRender.innerHTML = withStylesIfIsolated;

		const getValueFromRender = (path: string[]): any => {
			let value: any = renderHtml.values;
			for (const index of path) {
				if (value.__cmxs) value = value.values;
				value = value[parseInt(index)];
			}
			return value;
		};

		// Populate HTML elements
		htmlToRender
			.querySelectorAll('[cmxs-component-html-elements]')
			.forEach((htmlElement: CmxsComponent) => {
				const path = htmlElement.getAttribute('cmxs-component-html-elements').split('-');
				const value = getValueFromRender(path);
				if (value instanceof NodeList || value instanceof HTMLCollection)
					htmlElement.replaceWith(...this.deepCloneNodes(value));
				else htmlElement.replaceWith(value.cloneNode(true));
			});

		// Populate Props in custom components
		const cmxsComponents = htmlToRender.querySelectorAll('[cmxs-custom-component]');
		for (let i = cmxsComponents.length - 1; i >= 0; i--) {
			const customComponent = cmxsComponents[i] as CmxsComponent<any, any>;
			customComponent.removeAttribute('cmxs-custom-component');
			customComponent._cmxsComponent = true;
			const constructor = customComponent.constructor as typeof CmxsComponent;
			customComponent.props = structuredClone(constructor.initialProps || {});
			customComponent.props.children = this.deepCloneNodes(customComponent.childNodes);
			for (const attr of customComponent.attributes) {
				const attrValue = attr.value;
				const match = attrValue.match(/__{{(.*?)}}__/);
				if (match) {
					const path = match[1].split('-');
					const value = getValueFromRender(path);
					customComponent.props[attr.name] = value;
					const isString = typeof value === 'string';
					const isNumber = typeof value === 'number';
					const isBoolean = typeof value === 'boolean';
					if (isString || isNumber || isBoolean)
						customComponent.setAttribute(attr.name, value.toString());
					else customComponent.removeAttribute(attr.name);
				} else if (attrValue === '') {
					// If the attribute value is not something like __{{1}}__ and it's empty, it's a boolean
					customComponent.setAttribute(attr.name, 'true');
					customComponent.props[attr.name] = true;
				} else {
					customComponent.props[attr.name] = attrValue;
				}
			}
		}

		// Remove children to the custom components of the "first level".
		const firstLevelComponents: CmxsComponent[] = [];
		const populatedCustomComponents = (root: HTMLElement) => {
			for (const child of root.childNodes) {
				if (child.nodeName.includes('-')) {
					firstLevelComponents.push(child as CmxsComponent);
				} else {
					populatedCustomComponents(child as HTMLElement);
				}
			}
		};
		populatedCustomComponents(htmlToRender);
		for (const component of firstLevelComponents) {
			component.innerHTML = '';
		}

		// Attach Events
		htmlToRender
			.querySelectorAll('[cmxs-component-with-event]')
			.forEach((htmlElement: CmxsComponent) => {
				htmlElement.removeAttribute('cmxs-component-with-event');
				(htmlElement as any).events = {};
				for (const attr of htmlElement.attributes) {
					if (attr.name.startsWith('@')) {
						const path = attr.value.match(/__{{(.*?)}}__/)[1].split('-');
						const callback = getValueFromRender(path);
						const eventName = attr.name.substring(1);
						htmlElement.addEventListener(eventName, callback);
						htmlElement.attributes.removeNamedItem(attr.name);
						(htmlElement as any).events[eventName] = callback;
					}
				}
			});

		return htmlToRender.childNodes;
	}

	/**
	 * =================================================================
	 * HTML Handling
	 * =================================================================
	 */

	/**
	 * Based on an `RenderHtml` object, builds a string representation of the DOM structure.
	 * @param renderHtml The Object containing parts and values of the HTML string.
	 * @param index The index to identify a specific value. It can be considered as an ID.
	 * @returns The HTML String corresponding to the new HTML structure.
	 */
	private handleHtml(renderHtml: RenderHtml, index = '') {
		const { parts, values } = renderHtml;
		let renderString = '';
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const value = values[i];
			renderString += part;
			if (value !== undefined) {
				if (!part.endsWith('=')) {
					//? Handles values that are NOT attributes of a custom component.
					renderString += this.handleHtmlValue(value, index, i.toString());
				} else {
					//? Handles values that ARE attributes of a custom component.
					const identifier = index === '' ? i.toString() : `${index}-${i}`;
					const attrs = part.split(' ');
					const attrName = attrs[attrs.length - 1];
					//? Handle inline dynamic styles
					if (attrName === 'style=' && typeof value === 'object') {
						let styleString = '';
						const styles = Object.keys(value);
						for (const key of styles) {
							let styleValue = value[key];
							let styleKey = key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
							if (typeof styleValue === 'number') styleValue = `${styleValue}px`;
							styleString += `${styleKey}:${styleValue};`;
						}
						renderString += `"${styleString}"`;
					} else {
						//? Handle every attribute and events
						const isEvent = attrName.trim().startsWith('@');
						renderString += `"__{{${identifier}}}__"`;
						if (isEvent) renderString += ` cmxs-component-with-event`;
					}
				}
			}
		}
		return renderString;
	}

	/**
	 * Handles a value picked from a `RenderHtml` object and elaborates it, returning a string to add
	 * in the DOM String representation of the `RenderHtml` object. This method is NOT used to handle
	 * custom component attributes.
	 * @param value The value to analyze.
	 * @param prevIdentifier The previous identifier (index, ID).
	 * @param index The current identifier (index, ID).
	 * @returns A string representation of the the value.
	 */
	private handleHtmlValue(value: any, prevIdentifier: string, index: string) {
		let res = '';
		const identifier = prevIdentifier === '' ? index.toString() : `${prevIdentifier}-${index}`;
		if (value === false || value === null) return res;
		if (value.__cmxs) {
			//? Is html result function
			res += this.handleHtml(value, identifier);
		} else if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) {
				const val = value[i];
				res += this.handleHtmlValue(val, identifier, i.toString()) + '\n';
			}
		} else if (
			value instanceof HTMLElement ||
			value instanceof NodeList ||
			value instanceof HTMLCollection
		) {
			res += `<div cmxs-component-html-elements="${identifier}"></div>`;
		} else if (value.prototype instanceof CmxsComponent) {
			res += value.componentName;
		} else {
			res += value;
		}
		return res;
	}

	/**
	 * Self-Closing tags are not allowed in standard HTML. This function will take care of them.
	 * It also marks custom components adding an attribute to them, so that they can be selected
	 * by query selectors. This attributes are then removes.
	 * @param compiledResult The completed and formatted template.
	 * @returns The fixed template
	 */
	private handleSelfClosingTagsAndMark(compiledResult: string) {
		let fixedTemplate = compiledResult;
		const customComponents = [...fixedTemplate.matchAll(/<([a-z]*-[a-z|-]*)(.*?)>/gs)];
		let addedChars = 0;
		const customComponentIdentifier = 'cmxs-custom-component';
		customComponents.forEach((selfClosingComponent) => {
			const [fullMatch, componentName, attributes] = selfClosingComponent;
			const firstPart = fixedTemplate.slice(0, selfClosingComponent.index + addedChars);
			const secondPart = fixedTemplate.slice(
				selfClosingComponent.index + fullMatch.length + addedChars
			);
			if (fullMatch.endsWith('/>')) {
				const newString = `<${componentName}${attributes} ${customComponentIdentifier}></${componentName}>`;
				fixedTemplate = `${firstPart}${newString}${secondPart}`;
				addedChars += componentName.length + 2 + customComponentIdentifier.length + 1;
			} else {
				const newString = `<${componentName}${attributes} ${customComponentIdentifier}>`;
				fixedTemplate = `${firstPart}${newString}${secondPart}`;
				addedChars += customComponentIdentifier.length + 1;
			}
		});
		return fixedTemplate;
	}

	/**
	 * Clone a list of nodes and returs them.
	 * @param nodes A list of nodes to clone.
	 * @returns The cloned nodes, keeping props and state.
	 */
	private deepCloneNodes(nodes: HTMLCollection | NodeList) {
		const support = document.createElement('div');
		[...nodes].forEach((node) => {
			const clone = node.cloneNode(false) as CmxsComponent;
			if ((node as any)._cmxsComponent) {
				(clone as CmxsComponent).props = (node as CmxsComponent).props;
				(clone as CmxsComponent).state = (node as CmxsComponent).state;
				(clone as CmxsComponent)._cmxsComponent = true;
			}
			support.appendChild(clone);
			if (clone.replaceChildren) {
				const clonedChildren = this.deepCloneNodes(node.childNodes);
				clone.replaceChildren(...clonedChildren);
			}
		});
		return support.childNodes;
	}

	/**
	 * =================================================================
	 * State management
	 * =================================================================
	 */

	/**
	 * Set a new state of the component and re-renders it if something changes. The first parameter is
	 * the new state of the component, and it's not necessary to re-write the whole state: only set
	 * the keys that changes. The function will then merge the old state with the new one.
	 *
	 * If the new state relies on the old state or on the props, then the parameter should be a
	 * callback function that has 2 parameters: respectively the old state and the old props.
	 *
	 * @example ```javascript
	 * 	this.setState({ loading: true }); // Direct updates
	 *
	 * 	this.setState((oldState, oldProps) => ({ // Updates through callback
	 * 	  counter: oldState.counter +1
	 *  }));
	 * ```
	 *
	 * @param callbackOrNewState The callback or the new state.
	 */
	public setState(
		callbackOrNewState: Partial<State> | ((oldState: State, oldProps: Props) => Partial<State>)
	) {
		let newState = callbackOrNewState as Partial<State>;
		if (typeof callbackOrNewState === 'function')
			newState = callbackOrNewState(this.state, this.props);
		let needsUpdate = false;
		for (const key in newState) {
			const oldValue = this.state[key];
			const newValue = newState[key];
			if (oldValue === undefined)
				console.warn(
					`The property "${key}" is a new state property. Avoid setting new state properties.\n` +
						'Instead, initialize the state by setting that property to "null".'
				);
			if (oldValue !== newValue) {
				if (typeof oldValue === 'object' && typeof newValue === 'object')
					needsUpdate = !this.deepCompareObjects(oldValue, newValue);
				else needsUpdate = true;
				if (needsUpdate) this.state[key] = newValue;
			}
		}
		if (needsUpdate && !this.rendering) {
			this.rendering = true;
			//? Avoid reloading components multiple times if you set the
			//? state multiple times in the same time.
			Promise.resolve().then(() => {
				const nodesToRender = this.getNodesToRender();
				this.updateComponent(nodesToRender);
				this.rendering = false;
				this.onRendered();
			});
		}
	}

	/**
	 * Update a component by comparing a new DOM structure with the existing one.
	 * @param newDomStructure The new DOM structure
	 * @param deep True if the comparisons of the nodes should also check the children of components.
	 */
	private updateComponent(newDomStructure: NodeList, deep = true) {
		const oldsDomStructure = this.ROOT.childNodes;
		this.recursivelyCompare(this, oldsDomStructure, newDomStructure, deep);
	}

	/**
	 * The function will recursively compare nodes between the existing structure and the new DOM
	 * structure. It will then replace the nodes that changed and requestig reloads to custom
	 * components with new props.
	 * @param oldParent The existing parent element.
	 * @param oldStructure The existing DOM structure.
	 * @param newStructure The new DOM structure.
	 * @param deep True if the comparisons of the nodes should also check the children of components.
	 */
	private recursivelyCompare(
		oldParent: HTMLElement,
		oldStructure: NodeList,
		newStructure: NodeList,
		deep: boolean
	) {
		const itemsToRemove = oldStructure.length - newStructure.length;
		for (let i = 0; i < newStructure.length; i++) {
			const oldNode = oldStructure[i];
			const newNode = newStructure[i];
			if (!oldNode) {
				oldParent.appendChild(newNode);
				continue;
			}

			// Handle node events
			if ((oldNode as any).events || (newNode as any).events) {
				const oldNodeAny = oldNode as any;
				const newNodeAny = newNode as any;
				if (!oldNodeAny.events) oldNodeAny.events = {};
				const oldEvents = Object.keys(oldNodeAny.events);
				const newEvents = Object.keys(newNodeAny.events);
				// Remove not used events
				for (const event of oldEvents) {
					const oldEvent = oldNodeAny.events[event];
					const newEvent = newNodeAny.events[event];
					if (!newEvent) {
						delete oldNodeAny.events[event];
						oldNode.removeEventListener(event, oldEvent);
					}
				}
				// Add/Replace new events
				for (const event of newEvents) {
					const oldEvent = oldNodeAny.events[event];
					const newEvent = newNodeAny.events[event];
					if (!oldEvent) {
						oldNodeAny.events[event] = newEvent;
						oldNode.addEventListener(event, newEvent);
					} else if (oldEvent !== newEvent) {
						oldNodeAny.events[event] = newEvent;
						oldNode.removeEventListener(event, oldEvent);
						oldNode.addEventListener(event, newEvent);
					}
				}
			}

			// Nodes differ
			const comparingSameCmxsComponent =
				(newNode as CmxsComponent)._cmxsComponent && newNode.nodeName === oldNode.nodeName;
			if (comparingSameCmxsComponent) {
				// Handling the updates of custom components
				const oldNodeComponent = oldNode as CmxsComponent<any>;
				const newNodeComponent = newNode as CmxsComponent<any>;

				// Cover the cases in which a custom element is diclared directly in the HTML.
				// Initializes props
				if (!newNodeComponent.props) {
					const constructor = newNodeComponent.constructor as typeof CmxsComponent;
					newNodeComponent.props = structuredClone(constructor.initialProps || {});
					newNodeComponent.props.children = newNodeComponent.childNodes;
					for (const attr of newNodeComponent.attributes) {
						const attrValue = attr.value;
						if (attrValue === '') {
							newNodeComponent.setAttribute(attr.name, 'true');
							newNodeComponent.props[attr.name] = true;
						} else {
							newNodeComponent.props[attr.name] = attrValue;
						}
					}
				}
				// Compare props. If attributes changed, props changes too. No need to compare nodes.
				const propsChanged = !this.deepCompareObjects(
					oldNodeComponent.props,
					newNodeComponent.props
				);
				if (propsChanged) {
					for (const oldAttr of oldNodeComponent.attributes) {
						if (!newNodeComponent.hasAttribute(oldAttr.name))
							oldNodeComponent.removeAttribute(oldAttr.name);
					}
					for (const newAttr of newNodeComponent.attributes) {
						if (oldNodeComponent.getAttribute(newAttr.name) !== newAttr.value)
							oldNodeComponent.setAttribute(newAttr.name, newAttr.value);
					}
					oldNodeComponent.requestReload(newNodeComponent);
					continue;
				}
				if (!deep) continue; //? Don't check children if it's not a deep reload
				let childrenDiffers = false;
				const newNodeChildren = newNodeComponent.props?.children ?? [];
				const oldNodeChildren = oldNodeComponent.props?.children;
				if (newNodeChildren.length !== oldNodeChildren.length) {
					oldNodeComponent.requestReload(newNodeComponent);
					continue;
				}
				for (let i = 0; i < oldNodeChildren.length; i++) {
					if (!newNodeChildren[i].isEqualNode(oldNodeChildren[i])) {
						childrenDiffers = true;
						break;
					}
				}
				if (childrenDiffers) oldNodeComponent.requestReload(newNodeComponent);
				continue;
			}
			const oldNodeNoChildren = oldNode.cloneNode(false);
			const newNodeNoChildren = newNode.cloneNode(false);
			const isEqualNoChildren = oldNodeNoChildren.isEqualNode(newNodeNoChildren);
			if (!isEqualNoChildren) {
				// The node completely differs, must be replaced
				const clone = newNode.cloneNode(true);
				const nodeEvents = (newNode as any).events;
				// Attach old events to the clone
				const events = Object.keys(nodeEvents || {});
				for (const event of events) {
					clone.addEventListener(event, nodeEvents[event]);
				}
				(oldNode as HTMLElement).replaceWith(clone);
			} else {
				// Only children differs. Check recusively each node.
				this.recursivelyCompare(
					oldNode as HTMLElement,
					oldNode.childNodes,
					newNode.childNodes,
					deep
				);
			}
		}

		// Remove items that are not in the new structure
		if (itemsToRemove > 0) {
			let removedItems = 0;
			while (removedItems < itemsToRemove) {
				oldParent.childNodes[newStructure.length].remove();
				removedItems++;
			}
		}
	}

	private deepCompareObjects(oldProps: { [k: string]: any }, newProps: { [k: string]: any }) {
		if (oldProps === newProps) return true;
		// if both x and y are null or undefined and exactly the same
		if (!(oldProps instanceof Object) || !(newProps instanceof Object)) return false;
		// if they are not strictly equal, they both need to be Objects
		if (oldProps.constructor !== newProps.constructor) return false;
		// they must have the exact same prototype chain, the closest we can do is
		// test there constructor.
		for (const p in oldProps) {
			if (p === 'children') continue; // Exclude children
			if (!oldProps.hasOwnProperty(p)) continue;
			// other properties were tested using x.constructor === y.constructor
			if (!newProps.hasOwnProperty(p)) return false;
			// allows to compare x[ p ] and y[ p ] when set to undefined
			if (oldProps[p] === newProps[p]) continue;
			// if they have the same strict value or identity then they are equal
			if (typeof oldProps[p] !== 'object') return false;
			// Numbers, Strings, Functions, Booleans must be strictly equal
			if (!this.deepCompareObjects(oldProps[p], newProps[p])) return false;
			// Objects and Arrays must be tested recursively
		}
		for (const p in newProps) {
			if (p === 'children') continue; // Exclude children
			if (newProps.hasOwnProperty(p) && !oldProps.hasOwnProperty(p)) return false;
		}
		// allows x[ p ] to be set to undefined
		return true;
	}

	/**
	 * Request a reload to the component.
	 * @param newNode The (optional) new node in which to get props. If it's not provided, the
	 * component will not be reloaded in a "deep" way (children will not be checked for changes).
	 */
	public requestReload(newNode: CmxsComponent = null) {
		if (newNode) {
			const newProps = newNode.props;
			this.props = {
				...this.props,
				...newProps,
			};
		}
		const nodesToRender = this.getNodesToRender();
		const deepReload = !!newNode;
		this.updateComponent(nodesToRender, deepReload);
		this.onRendered();
	}

	/**
	 * Get the props of elements that are instances of the specified component class, and returns an
	 * array with the props of each found component.
	 * @param component The component Class
	 * @returns The list of props for each found component
	 */
	public getDepenciesProps(component: typeof CmxsComponent) {
		const dependencies: any[] = [];
		const componentName = component.componentName;
		this.querySelectorAll(componentName).forEach((found: CmxsComponent) =>
			dependencies.push(found.props)
		);
		return dependencies;
	}

	/**
	 * =================================================================
	 * Hooks
	 * =================================================================
	 */

	/**
	 * This Hook is executed whenever a component is connected to the DOM and has initialized.
	 * Props and state are already accessible in this function.
	 *
	 * In this hook you should initialize the state of the component, the stores, and class variables.
	 */
	public onInit() {}

	/**
	 * This hook gets executed whenever the component gets disconnected from the DOM.
	 * Use this function to dispose event listeners, methodsm and other similar functionalities.
	 */
	public onDisconnected() {}

	/**
	 * This hook gets executed whenever the component is rendered for the first time.
	 */
	public onFirstRender() {}

	/**
	 * This hook gets executed whenever the component is rendered.
	 */
	public onRendered() {}

	/**
	 * This hook gets executed whenever an attribute listed in the static `observedAttributes`
	 * array changes.
	 * @param name The name of the attribute which changes.
	 * @param oldValue The old value.
	 * @param newValue The new value.
	 */
	public onAttributeChanged(name: string, oldValue: string, newValue: string) {}

	/**
	 * Returns the DOM structure of the component. The result can be something returned by the `html`
	 * function, but also a simple string or directly an HTML element.
	 * @returns The HTML to render in a format that can be: RenderHtml | string | HTMLElement.
	 */
	render(): RenderHtml | string | HTMLElement {
		throw new Error(
			`CmxsComponent: Unimplemented render method in "${
				(this.constructor as typeof CmxsComponent).name
			}"`
		);
	}
}

/**
 * =================================================================
 * Html function
 * =================================================================
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
		__cmxs: true,
	};
}

/**
 * =================================================================
 * defineCmxsComponentMemo function
 * =================================================================
 */

/**
 * Memoize a function to keep track of all custom cmxs components
 * @returns The defineCmxsComponent memoized function
 */
function defineCmxsComponentMemo(): (Component: typeof CmxsComponent<{}>) => void {
	const cmxsComponents: {
		[key: string]: typeof CmxsComponent;
	} = {};
	return (Component: typeof CmxsComponent) => {
		customElements.define(Component.componentName, Component);
		/* if (!(Component.prototype instanceof CmxsComponent))
			throw new Error(
				'The argument [Component] is not an instance of a CmxsComponent.\n' +
					'If you want to define a custom component without using a CmxsComponent, ' +
					'please use the built-in customElements.define function.'
			);
		const tagName = Component.componentName;
		if (!tagName)
			throw new Error(
				'Every component must have a static property called "componentName", ' +
					'which is a string representing the name of the component.'
			);
		if (cmxsComponents[tagName] === undefined && !customElements.get(tagName)) {
			cmxsComponents[tagName] = Component;
			if (document.readyState === 'complete') {
				customElements.define(tagName, Component);
			} else {
				window.onload = () => {
					for (const componentName in cmxsComponents) {
						customElements.define(componentName, cmxsComponents[componentName]);
					}
				};
			}
		} */
	};
}

/**
 * Defines a new Cmxs Component by giving the class of it in the first parameter.
 */
export const defineCmxsComponent = defineCmxsComponentMemo();
