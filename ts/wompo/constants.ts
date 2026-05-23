/* Shared constants, regex, treeWalker and module-level caches. */

/** False to get smallest build file possible. */
export const DEV_MODE = false;

export const WC_MARKER = '$wc$';
export const DYNAMIC_TAG_MARKER = 'wc-wc';
export const WC_ATTRS_MARKER = '__$wompoAttrs$__';
export const WC_ATTRS_ATTR_PREFIX = 'data-wc-attrs-';

export const isDynamicTagRegex = /<\/?$/g;
export const isAttrRegex = /\s+([^\s]*?)=(["'][^"']*?)?$/g;
export const selfClosingRegex = /(<([a-z]*-[a-z]*).*?)\/?>/gs;
export const isInsideTextTag = /<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi;
export const onlyTextChildrenElementsRegex = /^(?:script|style|textarea|title)$/i;

/** Dependency type discriminants. */
export const NODE = 0;
export const ATTR = 1;
export const TAG = 2;
export const ATTRS = 3;

export const IS_SERVER = typeof document === 'undefined';

export const doc: Document = IS_SERVER ? ({ createTreeWalker() {} } as unknown as Document) : document;

export const treeWalker = doc.createTreeWalker(
  doc,
  129, // NodeFilter.SHOW_{ELEMENT|COMMENT}
);

export const mutationAttributesExclusions = [
  'class',
  'style',
  'id',
  'title',
  // SSR/hydration markers — removed by the hydrate runtime after a successful adopt; the removal
  // is not a prop change and must not trigger a re-render.
  'data-wompo-island',
  'data-wompo-mode',
  'data-wompo-ssr',
];

/** Per-component cache of roots that have already adopted its stylesheet. */
export const adoptedStyles: { [componentName: string]: Node[] } = {};

/** The wompo-suspense built-in tag name (used by render-engine to find a parent). */
export const SUSPENSE_NAME = 'wompo-suspense';
