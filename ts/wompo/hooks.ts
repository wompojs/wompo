/* All public hooks: useState, useEffect, useLayoutEffect, useRef, useCallback, useId, useMemo,
 * useReducer, useAsync, useExposed, useSelf, useContext, useHook. */
import { DEV_MODE, IS_SERVER } from './constants.js';
import {
  currentHookIndex,
  currentRenderingComponent,
  incrementHookIndex,
  serverContextResolver,
} from './render-context.js';
import type {
  AsyncHook,
  CallbackHook,
  Context,
  ContextHook,
  ContextProviderElement,
  EffectHook,
  IdHook,
  MemoHook,
  RefHook,
  ReducerAction,
  ReducerHook,
  StateHook,
  WompoElement,
} from './types.js';

export const useHook = (): [WompoElement, number] => {
  const currentComponent = currentRenderingComponent;
  const currentIndex = currentHookIndex;
  incrementHookIndex();
  return [currentComponent, currentIndex];
};

export const useState = <S>(initialState: S | (() => S)) => {
  const [component, hookIndex] = useHook();
  if (!component) {
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
          computedValue = (newValue as any)(stateHook[0]);
        }
        if (computedValue !== stateHook[0]) {
          stateHook[0] = computedValue;
          component.requestRender();
        }
      },
    ];
  }
  return component.hooks[hookIndex] as StateHook<S>;
};

export const useEffect = (
  callback: VoidFunction | (() => VoidFunction),
  dependencies: any[] = null,
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

export const useLayoutEffect = (
  callback: VoidFunction | (() => VoidFunction),
  dependencies: any[] = null,
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

export const useRef = <T>(initialValue: T = null) => {
  const [component, hookIndex] = useHook();
  if (!component.hooks.hasOwnProperty(hookIndex)) {
    component.hooks[hookIndex] = {
      current: initialValue,
      __wcRef: true,
    } as RefHook<T>;
  }
  return component.hooks[hookIndex] as RefHook<T>;
};

export const useCallback = <C = (...args: any[]) => any>(
  callbackFn: C,
  dependencies: any[] = [],
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
  return (component.hooks[hookIndex] as CallbackHook<C>).value;
};

const useIdMemo = () => {
  let counter = 0;
  return () => {
    const [component, hookIndex] = useHook();
    if (!component.hooks.hasOwnProperty(hookIndex)) {
      component.hooks[hookIndex] = `:w${counter}:` as IdHook;
      counter++;
    }
    return component.hooks[hookIndex] as IdHook;
  };
};
export const useId = useIdMemo();

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
  return (component.hooks[hookIndex] as MemoHook<T>).value;
};

export const useReducer = <State>(
  reducer: (state: State, action: ReducerAction) => Partial<State>,
  initialState: State,
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
  return component.hooks[hookIndex] as ReducerHook<State>;
};

export const useExposed = <E = {}>(toExpose: E) => {
  const component = currentRenderingComponent;
  const keys = Object.keys(toExpose) as (keyof E)[];
  for (const key of keys) {
    (component as any)[key] = toExpose[key];
  }
};

const executeUseAsyncCallback = <S>(
  hook: [WompoElement, number],
  callback: () => Promise<S>,
  newDependencies: any[],
  activateSuspense: boolean,
) => {
  const [component, hookIndex] = hook;
  const asyncHook = component.hooks[hookIndex] as AsyncHook<S>;
  asyncHook.activateSuspense = activateSuspense;
  asyncHook.value = null;
  asyncHook.asyncCallback = callback;
  asyncHook.dependencies = newDependencies;
  component._$asyncCalls.push(asyncHook);
};

export const useAsync = <S>(
  callback: () => Promise<S>,
  dependencies: any[],
  activateSuspense = true,
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

export const useSelf = <H = WompoElement>() => {
  return currentRenderingComponent as H;
};

export const useContext = <S>(Context: Context<S>): S => {
  const [component, hookIndex] = useHook();
  if (IS_SERVER) {
    if (serverContextResolver) {
      const v = serverContextResolver<S>(Context);
      return v === undefined ? Context.default : (v as S);
    }
    return Context.default;
  }
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
            'because is no longer a child of it.',
        );
      }
      parent = null;
      oldParent.subscribers.current.delete(component);
    } else if (component.isConnected) {
      console.warn(
        `The element ${component.tagName} doens't have access to the Context ${Context.name}. ` +
          'The default value will be returned instead.',
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
