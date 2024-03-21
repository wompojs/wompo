/**
 * The html`` template function result type.
 */
export interface RenderHtml {
    parts: TemplateStringsArray;
    values: any[];
    _$wompHtml: true;
}
/**
 * The props of any component.
 */
export interface WompProps {
    /** The children of the component instance */
    children?: WompChildren;
    /** The styles generated from the CSS provided */
    styles?: {
        [key: string]: string;
    };
    /** In DEV_MODE, will write on the console performance informations. */
    ['wc-perf']?: boolean;
    /** The style of a component to customize in through the style attribute in the DOM. */
    style?: string | Partial<CSSStyleDeclaration> | object;
    /** A potential reference to the element. */
    ref?: RefHook<any>;
    /** The ID of the element */
    id?: string;
    /** The classes of the element */
    class?: string;
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
     * hyphen-case. If the component doesn't have an hyphen, a "womp" string will be placed as a
     * suffix.
     * E.g. TabPanel = tab-panel, Counter = counter-womp
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
    cssGeneration?: boolean;
}
/**
 * The type of the function to create a Womp Component.
 * It can have a custom `css` property, corresponding to the specific styles of the component.
 */
export interface WompComponent<Props extends WompProps = WompProps> {
    /** The props of the component */
    (props: Props): RenderHtml;
    /**
     * The specific styles of the component.
     */
    css?: string;
    /** The component name, elaborated in the defineWomp function */
    componentName?: string;
    /** Identifies the component */
    _$wompF?: true;
    /** The generated class of the component */
    class?: WompElementClass<Props>;
    /** Options */
    options?: {
        generatedCSS: string;
        styles: {
            [key: string]: string;
        };
        shadow: boolean;
    };
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
export type WompElement<Props extends WompProps = WompProps, E = {}> = HTMLElement & E & {
    /**
     * The props of the component, that are then passed in the function.
     */
    props: Props;
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
     * True if the component uses a context.
     */
    _$usesContext: boolean;
    /**
     * True if the component has recently been moved. Used to know if a component should search
     * again for parent contexts.
     */
    _$hasBeenMoved: boolean;
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
};
/** The possible hooks that a component can have. */
type Hook = StateHook<any> | EffectHook | RefHook<any> | CallbackHook | IdHook | MemoHook | ReducerHook<any> | ContextHook<any>;
/** The hook generated by the useState function */
type StateHook<S> = [S, (newValue: S) => void];
/** The hook generated by the useEffect and useLayoutEffect functions */
interface EffectHook {
    dependencies: any;
    callback: VoidFunction | (() => VoidFunction);
    cleanupFunction: VoidFunction | void;
}
/** The hook generated by the useRef function */
interface RefHook<V> {
    current: V;
    __wcRef: true;
}
/** The hook generated by the useCallback function */
interface CallbackHook {
    (...args: any[]): any;
}
/** The hook generated by the useId function */
type IdHook = string;
/** The hook generated by the useMemo function */
interface MemoHook {
    dependencies: any[];
    value: any;
}
interface ReducerAction {
    type: string;
    [key: string]: any;
}
/** The hook generated by the useState function */
type ReducerHook<State> = [State, (state: any, action: ReducerAction) => void];
/** The props type of a ContextProvider */
interface ContextProviderProps extends WompProps {
    value: any;
}
/** The exposed values of a ContextProvider */
interface ContextProviderExposed {
    subscribers: RefHook<Set<WompElement>>;
}
/** The type of a ContextProvier instance */
type ContextInstance = WompElement<ContextProviderProps, ContextProviderExposed>;
/** The hook generated by the useContext hook */
interface ContextHook<V = any> {
    node: ContextInstance;
    value: V;
}
/**
 * The type of the class generated by the womp() function.
 */
interface WompElementClass<Props extends WompProps, E = {}> {
    /** The constructor */
    new (): WompElement<Props, E>;
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
/**
 * The CachedTemplate class is used to efficiently render components. The template HTML element is
 * stored here and only cloned when a new component is instantiated.
 */
declare class CachedTemplate {
    /**
     * The HTML Template element that has all the structure and comments built in to identify dynamic
     * elements.
     */
    template: HTMLTemplateElement;
    /**
     * The list of metadata dependencies used to know which node/attribute should listen to updates
     * when a variable changes.
     */
    dependencies: Dependency[];
    /**
     * Create a new CachedTemplate instance.
     * @param template The HTML Template already elaborated to handle the dynamic parts.
     * @param dependencies The metadata dependencies for the template.
     */
    constructor(template: HTMLTemplateElement, dependencies: Dependency[]);
    /**
     * This function will clone the template content and build the dynamcis metadata - an array
     * containing all the information to efficiently put values in the DOM, without checking if each
     * node is equal to a virtual one. The DOM update is not done through this function, but thanks to
     * the `__setValues` function.
     * @returns An array containing 2 values: The DOM fragment cloned from the content of the
     * template, and the dynamics metadata.
     */
    clone(): [DocumentFragment, Dynamics[]];
}
/**
 * Contains the data about a Dynamic node.
 */
declare class DynamicNode {
    /**
     * The start node marks the point on where dynamic nodes must be put after.
     * It's a static HTML element. Values between the startNode and endNode are known to be dynamic.
     */
    startNode: ChildNode;
    /**
     * The end node marks the point on where dynamic nodes must be put before.
     * It's a static HTML element. Values between the startNode and endNode are known to be dynamic.
     */
    endNode: ChildNode | null;
    isNode: true;
    isAttr: false;
    isTag: false;
    /**
     * Creates a new DynamicNode instance.
     * @param startNode The start node.
     * @param endNode The end node.
     */
    constructor(startNode: ChildNode, endNode: ChildNode | null);
    /**
     * Removes all the nodes between the start and the end nodes.
     */
    clearValue(): void;
    /**
     * First removes all the nodes between the start and the end nodes, then it also removes the
     * start node and the end node.
     */
    dispose(): void;
}
/**
 * Contains the data about a dynamic attribute.
 */
declare class DynamicAttribute {
    /** The node that owns the dynamic attribute */
    node: HTMLElement;
    /** The name of the dynamic attribute. */
    name: string;
    /**
     * If an attribute has only some dynamic parts, this property will contain the whole attribute
     * structure. E.g. class="button ${'hidden'}".
     */
    attrStructure: string;
    isNode: false;
    isAttr: true;
    isTag: false;
    /** The callback to execute when an event is fired. */
    private __callback;
    /** True if an event has already been initialized. */
    private __eventInitialized;
    /**
     * Creates a new DynamicAttribute instance.
     * @param node The node that owns the attribute.
     * @param dependency The dependency metadata.
     */
    constructor(node: HTMLElement, dependency: Dependency);
    /**
     * Update an attribute value.
     * @param newValue The new value of the attribute
     */
    updateValue(newValue: any): void;
    /**
     * Set the callback function to be executed when an event is fired. If the event has not been
     * initialized, the event listener will be added.
     */
    set callback(callback: (event: Event) => void);
    /**
     * The listener that will execute the __callback function (if defined).
     * @param event The event object
     */
    private __listener;
}
/**
 * Contains the data about a dynamic tag name.
 */
declare class DynamicTag {
    /** The node that has the dynamic tag. */
    node: ChildNode;
    isNode: false;
    isAttr: false;
    isTag: true;
    /**
     * Creates a new DynamicTag instance.
     * @param node The node instance.
     */
    constructor(node: ChildNode);
}
/**
 * Holds the children of a component. They are stored in an array of nodes instead of an NodeList or
 * HTMLCollection, so that they are not lost and reusable when removed from the DOM.
 */
declare class WompChildren {
    nodes: Node[];
    _$wompChildren: true;
    constructor(nodes: Node[]);
}
/**
 * This generic hook will allow the creation of custom hooks by exposing the current rendering
 * component and the current hook index. They will be returned in an array of 2 element:
 * [currentComponent, currentIndex].
 * The currentHookIndex will be then automatically incremented, so that the developer will not have
 * to worry about it, avoiding potential bugs.
 * @returns The current rendering component and current index.
 */
export declare const useHook: () => [WompElement, number];
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
export declare const useState: <S>(defaultValue: S) => (S | (() => void))[] | StateHook<S>;
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
export declare const useEffect: (callback: VoidFunction | (() => VoidFunction), dependencies: any[]) => void;
/**
 * The useLayoutEffect hook is the same as the main useEffect hook. The only difference stands in
 * the execution order: the useEffect hook gets executed asynchronously, so the component will first
 * render, and then it'll call the callback. The useLayoutEffect hook gets executed synchronously,
 * so `before` the component renders.
 * @param callback The callback to execute
 * @param dependencies The list of dependencies to listen to changes.
 */
export declare const useLayoutEffect: (callback: VoidFunction | (() => VoidFunction), dependencies: any[]) => void;
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
export declare const useRef: <T>(initialValue?: T) => RefHook<T>;
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
export declare const useCallback: (callbackFn: CallbackHook) => CallbackHook;
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
export declare const useId: () => string;
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
export declare const useMemo: (callbackFn: () => any, dependencies: any[]) => any;
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
export declare const useReducer: <State>(reducer: (state: State, action: ReducerAction) => Partial<State>, initialState: State) => Hook;
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
export declare const useExposed: <E = {}>(toExpose: E) => void;
/**
 * The Context interface
 */
interface Context<S = any> {
    Provider: WompComponent<ContextProviderProps>;
    default: S;
    name: string;
}
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
export declare const createContext: <S>(initialValue: S) => Context<S>;
/**
 * The useContext hook is used to obtain the current value provided bya a parent Context.Provider
 * element. The context must be created first with the `createContext` function.
 * @param Context The context to use.
 * @returns The value of the context above the element.
 */
export declare const useContext: (Context: Context<any>) => any;
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
export declare function html(templateParts: TemplateStringsArray, ...values: any[]): RenderHtml;
/**
 * The default options used when creating a Web Component. If you customize these options, you
 * should do it at the TOP of your html file, before every other component renders.
 * The current options are:
 * - `shadow`: false (boolean)
 * - `cssGeneration`: true (boolean)
 */
export declare const wompDefaultOptions: WompComponentOptions;
export declare const registeredComponents: {
    [key: string]: WompComponent;
};
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
export declare function defineWomp<Props, E = {}>(Component: WompComponent<Props & WompProps>, options?: WompComponentOptions): WompComponent<Props & WompProps>;
export {};
