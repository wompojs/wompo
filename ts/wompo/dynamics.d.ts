import type { Dependency, WompoElement } from './types.js';
/** Contains the data about a dynamic node (text/element interpolation). */
export declare class DynamicNode {
    startNode: ChildNode;
    endNode: ChildNode | null;
    isNode: true;
    isAttr: false;
    isTag: false;
    isAttrs: false;
    constructor(startNode: ChildNode, endNode: ChildNode | null);
    /** Removes every sibling between startNode and endNode (exclusive). */
    clearValue(): void;
    /** Clears and then also removes the start/end boundary markers. */
    dispose(): void;
}
/** Contains the data about a dynamic attribute (plain, event, or property). */
export declare class DynamicAttribute {
    node: HTMLElement;
    name: string;
    attrStructure: string;
    isNode: false;
    isAttr: true;
    isTag: false;
    isAttrs: false;
    private __callback;
    private __eventInitialized;
    constructor(node: HTMLElement, dependency: Dependency);
    updateValue(newValue: any): void;
    set callback(callback: ((event: Event) => void) | {
        fn: (event: Event) => void;
        options?: AddEventListenerOptions;
    });
    private __listener;
}
/** Contains the data about a dynamic tag name. */
export declare class DynamicTag {
    node: ChildNode;
    isNode: false;
    isAttr: false;
    isTag: true;
    isAttrs: false;
    constructor(node: ChildNode);
}
/**
 * Contains the data about a "spread" of attributes/events/properties on a single node, produced
 * by interpolating the result of `attrs({...})` directly inside an open tag.
 */
export declare class DynamicAttributes {
    node: HTMLElement;
    isNode: false;
    isAttr: false;
    isTag: false;
    isAttrs: true;
    private __subs;
    constructor(node: HTMLElement);
    private __isCustomElement;
    private __resolveName;
    private __getSub;
    private __applyOne;
    apply(newEntries: {
        [key: string]: any;
    } | null | undefined, oldEntries: {
        [key: string]: any;
    } | null | undefined): void;
}
/**
 * Holds the children of a component as a plain array so they survive removal from the DOM and can
 * be re-mounted.
 */
export declare class WompoChildren {
    nodes: Node[];
    _$wompoChildren: true;
    constructor(nodes: Node[]);
}
/** A dynamic dependency whose value is an array — handles keyed/non-keyed lists. */
export declare class WompoArrayDependency {
    dynamics: DynamicNode[];
    isArrayDependency: true;
    private __oldValues;
    private __oldPureValues;
    private __parentDependency;
    private __owner;
    private __isKeyed;
    constructor(values: any[], dependency: DynamicNode, owner: WompoElement);
    private __canUseKeys;
    private __createMarkers;
    private addDependenciesFrom;
    private updateNormalArray;
    private updateKeyedArray;
    private handleArray;
    checkUpdates(newValues: any[]): this;
}
/** The possible dynamic values: DynamicNode | DynamicAttribute | DynamicTag | DynamicAttributes. */
export type Dynamics = DynamicNode | DynamicAttribute | DynamicTag | DynamicAttributes;
