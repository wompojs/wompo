import type { WompoComponent, WompoProps } from '../wompo.js';
import * as devalue from './devalue.js';
import type { SsrOptions, SsrResult } from './types.js';
export type { SsrOptions, SsrResult, IslandRef } from './types.js';
/** Render a Wompo component to an HTML string. Awaits all useAsync/lazy inside. */
export declare function renderToString(Component: WompoComponent, props?: WompoProps, options?: SsrOptions): Promise<SsrResult>;
interface RegisteredAction {
    id: string;
    fn: (...args: any[]) => Promise<any>;
}
/** Mark an async function as a Server Action. On the server it remains callable directly; when
 * serialized as a prop to a client island the runtime replaces it with a fetch-based proxy. */
export declare function defineAction<A extends any[], R>(fn: (...args: A) => Promise<R>, id?: string): (...args: A) => Promise<R>;
export declare function getRegisteredAction(id: string): RegisteredAction | undefined;
export declare function listRegisteredActions(): string[];
export { devalue };
export { renderToStream, BOUNDARY_RUNTIME_SCRIPT } from './stream.js';
