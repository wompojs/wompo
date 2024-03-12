const DEV_MODE = true;

/* 
================================================
GLOBAL STORE MANAGEMENT
================================================
*/

import { useHook, type WompElement } from './womp';

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

/** The hook generate by the useGlobalState function */
interface GlobalStateHook<S> {
	value: S;
	subscribers: Set<WompElement>;
}

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
