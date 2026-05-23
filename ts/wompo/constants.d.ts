/** False to get smallest build file possible. */
export declare const DEV_MODE = false;
export declare const WC_MARKER = "$wc$";
export declare const DYNAMIC_TAG_MARKER = "wc-wc";
export declare const WC_ATTRS_MARKER = "__$wompoAttrs$__";
export declare const WC_ATTRS_ATTR_PREFIX = "data-wc-attrs-";
export declare const isDynamicTagRegex: RegExp;
export declare const isAttrRegex: RegExp;
export declare const selfClosingRegex: RegExp;
export declare const isInsideTextTag: RegExp;
export declare const onlyTextChildrenElementsRegex: RegExp;
/** Dependency type discriminants. */
export declare const NODE = 0;
export declare const ATTR = 1;
export declare const TAG = 2;
export declare const ATTRS = 3;
export declare const IS_SERVER: boolean;
export declare const doc: Document;
export declare const treeWalker: TreeWalker;
export declare const mutationAttributesExclusions: string[];
/** Per-component cache of roots that have already adopted its stylesheet. */
export declare const adoptedStyles: {
    [componentName: string]: Node[];
};
/** The wompo-suspense built-in tag name (used by render-engine to find a parent). */
export declare const SUSPENSE_NAME = "wompo-suspense";
