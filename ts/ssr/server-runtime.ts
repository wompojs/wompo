/* Server-side rendering runtime: builds a fake "WompoElement" so the existing hooks in
 * `ts/wompo/hooks.ts` can run unchanged, and wires up the global context resolver consulted by
 * `useContext` on the server.
 *
 * Lifecycle of a server render:
 *   1. Build a ServerInstance for the component.
 *   2. Push provider values onto the global context stack.
 *   3. Set the instance as currentRenderingComponent, reset hookIndex.
 *   4. Run the component → RenderHtml.
 *   5. If any useAsync calls were registered, await them and re-run (until stable).
 *   6. Pop provider values, restore previous currentRenderingComponent.
 */
import {
  resetHookIndex,
  setCurrentRenderingComponent,
  setServerContextResolver,
} from '../wompo/render-context.js';
import type { AsyncHook, Context, RenderHtml, WompoComponent, WompoElement, WompoProps } from '../wompo.js';
import type { ServerInstance, SsrContext } from './types.js';

const noop = () => {};

export function createServerInstance(
  Component: WompoComponent,
  tag: string,
  props: WompoProps,
  shadow: boolean,
): ServerInstance {
  const instance: ServerInstance = {
    hooks: [],
    props,
    _$wompo: true,
    _$initialProps: props,
    _$measurePerf: false,
    _$usesContext: false,
    _$hasBeenMoved: false,
    _$updating: false,
    _$effects: [],
    _$layoutEffects: [],
    _$asyncCalls: [],
    _$suspendedAsyncCalls: [],
    _$portals: [],
    requestRender: noop,
    onDisconnected: noop,
    updateProp: (k, v) => {
      (instance.props as any)[k] = v;
    },
    __ssrComponent: Component,
    __ssrTag: tag,
    __ssrIsland: null,
    __ssrShadow: shadow,
  };
  return instance;
}

/** Holds the active SSR context so `useContext` can resolve providers. Single-render scoped: the
 * caller must restore the previous value when done. */
let currentContext: SsrContext | null = null;

export function setActiveSsrContext(ctx: SsrContext | null) {
  currentContext = ctx;
  if (ctx) {
    setServerContextResolver(<S>(c: Context<S>) => {
      const stack = ctx.contextStack.get(c.name);
      if (!stack || !stack.length) return undefined;
      return stack[stack.length - 1] as S;
    });
  } else {
    setServerContextResolver(null);
  }
}

export function getActiveSsrContext(): SsrContext | null {
  return currentContext;
}

/** Push a context value on the active stack. */
export function pushContextValue(name: string, value: unknown) {
  const ctx = currentContext;
  if (!ctx) return;
  let stack = ctx.contextStack.get(name);
  if (!stack) {
    stack = [];
    ctx.contextStack.set(name, stack);
  }
  stack.push(value);
}

export function popContextValue(name: string) {
  const ctx = currentContext;
  if (!ctx) return;
  const stack = ctx.contextStack.get(name);
  if (stack) stack.pop();
}

/** Run a component once, returning its template. The caller owns awaiting any registered async
 * work and re-running. Sets and restores currentRenderingComponent. */
export function runComponentOnce(
  instance: ServerInstance,
  Component: WompoComponent,
  props: WompoProps,
): RenderHtml | null {
  const previous = (globalThis as any).__wompoPrevServerInstance__ as WompoElement | null;
  setCurrentRenderingComponent(instance as unknown as WompoElement);
  resetHookIndex();
  let result: RenderHtml | null = null;
  try {
    instance.props = props;
    result = Component.call(instance, props) as RenderHtml;
  } finally {
    setCurrentRenderingComponent(previous as WompoElement | null);
  }
  return result;
}

/** True when the instance recorded async work this render. */
export function hasPendingAsync(instance: ServerInstance): boolean {
  return instance._$asyncCalls.length > 0;
}

/** Await every async call queued during the current render, mutating each hook's `value` so the
 * next render reads the resolved data. Returns when all are resolved. */
export async function drainAsyncCalls(instance: ServerInstance): Promise<void> {
  const calls = instance._$asyncCalls as AsyncHook<unknown>[];
  if (!calls.length) return;
  // Snapshot and clear; hooks may re-register on the next pass.
  instance._$asyncCalls = [];
  const promises = calls.map((hook) =>
    Promise.resolve()
      .then(() => hook.asyncCallback())
      .then((data) => {
        hook.value = data;
      })
      .catch((err) => {
        // Swallow per-hook errors so a single failure doesn't abort the whole render. The hook
        // value stays null, which mirrors the client behavior on a rejected async.
        if (typeof console !== 'undefined') console.error('[wompo ssr] useAsync failed:', err);
      }),
  );
  await Promise.all(promises);
}
