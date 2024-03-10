/* type CreateStoreCallback<StateType> = (
	set: CreateStoreSetter<StateType>,
	get: () => StateType
) => StateType;
type CreateStoreSetter<StateType> = (state: StateOrCallback<StateType>, replace: boolean) => void;
type StateOrCallback<StateType> = StateType | StateCallback<StateType>;
type StateCallback<StateType> = (oldState: StateType) => StateType;

export const createStore = <State>(storeCallback: CreateStoreCallback<State>) => {
	const set: CreateStoreSetter<State> = (newStateOrCallback, replace = false) => {
		let newState = newStateOrCallback as State;
		if (typeof newStateOrCallback === 'function')
			newState = (newStateOrCallback as StateCallback<State>)(store);
		if (DEV_MODE) {
			// Check for new keys.
			for (const key in newState) {
				if (store[key] === undefined) {
					console.warn(
						`New key: "${key}". New keys in the state should not be set. Set default values instead.`
					);
					continue;
				}
			}
		}
		// Checking changes for nested objects and other cases would be too expensive.
		// If the set function is called, it's taken for granted that there is an
		// update to perform.
		components.forEach((component) => component.requestRender());
	};
	const get = () => store;
	let store = storeCallback(set, get);
	const storeKeys = {};
	const components = new Set<WompElement>();
	return (selectorFn?: (state: State) => Partial<State>) => {
		const [component, hookIndex] = useHook();
		const selection = selectorFn ? selectorFn(store) : store;
		if (!component.hooks[hookIndex]) {
			component.hooks[hookIndex] = {
				components: components,
				store: store,
			} as any;
			const oldDisconnectedCallback = component.onDisconnected;
			component.onDisconnected = () => {
				components.delete(component);
				oldDisconnectedCallback();
			};
			components.add(component);
		}
		return selection;
	};
}; */
