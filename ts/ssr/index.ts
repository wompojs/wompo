/* Public SSR API. Exposes a string renderer and (later) a streaming renderer + Server Actions. */
import type { WompoComponent, WompoProps } from '../wompo.js';
import { Serializer } from './serializer.js';
import {
  getActiveSsrContext,
  setActiveSsrContext,
} from './server-runtime.js';
import * as devalue from './devalue.js';
import { collectCss, renderInlineStyleBlock } from './css.js';
import type { IslandRef, SsrContext, SsrOptions, SsrResult } from './types.js';

export type { SsrOptions, SsrResult, IslandRef } from './types.js';

function createContext(options: SsrOptions): SsrContext {
  return {
    options: {
      hydration: options.hydration ?? 'islands',
      base: options.base ?? '/_/',
      ...options,
    },
    usedComponents: new Map(),
    islands: [],
    contextStack: new Map(),
    idCounter: 0,
    pendingAsync: [],
  };
}

/** Render a Wompo component to an HTML string. Awaits all useAsync/lazy inside. */
export async function renderToString(
  Component: WompoComponent,
  props: WompoProps = {},
  options: SsrOptions = {},
): Promise<SsrResult> {
  const ctx = createContext(options);
  const previous = getActiveSsrContext();
  setActiveSsrContext(ctx);
  try {
    const serializer = new Serializer(ctx);
    const html = await serializer.renderRoot(Component, props);
    const cssMode = options.css ?? 'inline';
    const css = cssMode === 'none' ? new Map<string, string>() : collectCss(ctx.usedComponents);
    const headTags = cssMode === 'inline' ? renderInlineStyleBlock(css, options.nonce) : '';
    return {
      html,
      headTags,
      islands: ctx.islands,
      css,
    };
  } finally {
    setActiveSsrContext(previous);
  }
}

/* ============================== Server Actions ============================== */

interface RegisteredAction {
  id: string;
  fn: (...args: any[]) => Promise<any>;
}

const actionRegistry = new Map<string, RegisteredAction>();
let actionCounter = 0;

/** Mark an async function as a Server Action. On the server it remains callable directly; when
 * serialized as a prop to a client island the runtime replaces it with a fetch-based proxy. */
export function defineAction<A extends any[], R>(
  fn: (...args: A) => Promise<R>,
  id?: string,
): (...args: A) => Promise<R> {
  const actionId = id ?? `a${++actionCounter}`;
  actionRegistry.set(actionId, { id: actionId, fn: fn as any });
  const wrapped = ((...args: A) => fn(...args)) as ((...args: A) => Promise<R>) & {
    [k: string]: unknown;
  };
  wrapped[devalue.ACTION_KEY] = actionId;
  wrapped['_$wompoAction'] = true;
  return wrapped;
}

export function getRegisteredAction(id: string): RegisteredAction | undefined {
  return actionRegistry.get(id);
}

export function listRegisteredActions(): string[] {
  return [...actionRegistry.keys()];
}

/* ============================== Re-exports ============================== */

export { devalue };
export { renderToStream, BOUNDARY_RUNTIME_SCRIPT } from './stream.js';
