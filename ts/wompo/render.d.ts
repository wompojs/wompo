import { Dynamics, DynamicNode, DynamicTag } from './dynamics.js';
import type { WompoElement } from './types.js';
/** Returns true if the dependency value differs and needs to be reapplied to the DOM. */
export declare const __shouldUpdate: (currentValue: any, oldValue: any, dependency: Dynamics) => any;
/** Swap the placeholder node with a real element (or custom component) and migrate the children. */
export declare const __handleDynamicTag: (currentValue: any, currentDependency: DynamicTag, valueIndex: number, dynamics: Dynamics[], values: any[]) => ChildNode;
export declare const __setPortal: (portal: HTMLElement, renderingComponent: WompoElement) => DynamicNode;
/**
 * The DOM-update core. Walks every Dynamic dependency and applies the new value. Recurses on
 * nested `html` templates. Not pure: mutates `dynamics` to keep track of swaps (e.g. dynamic tags
 * or portals).
 */
export declare const __setValues: (dynamics: Dynamics[], values: any[], oldValues: any[], renderingComponent: WompoElement) => any[];
