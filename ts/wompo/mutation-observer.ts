/* Shared MutationObserver singleton — one per root, instead of one per component instance. */
import { IS_SERVER, mutationAttributesExclusions } from './constants.js';
import type { WompoElement, WompoProps } from './types.js';

const observedRoots: WeakSet<Node> = IS_SERVER ? (null as any) : new WeakSet<Node>();

const sharedMutationCallback = (records: MutationRecord[]) => {
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const target = record.target as WompoElement;
    if (!target._$wompo || target._$updating) continue;
    const attrName = record.attributeName!;
    if (mutationAttributesExclusions.includes(attrName)) continue;
    let propName = attrName;
    if (propName.includes('-')) propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
    const newAttrVal = target.getAttribute(attrName);
    if ((target.props as any)[propName as keyof WompoProps] != newAttrVal)
      target.updateProp(propName, newAttrVal);
  }
};

/** Attach the singleton observer to a root (no-op on repeated calls). */
export const observeRoot = (root: Document | ShadowRoot) => {
  if (IS_SERVER || observedRoots.has(root)) return;
  observedRoots.add(root);
  new MutationObserver(sharedMutationCallback).observe(root, {
    attributes: true,
    subtree: true,
  });
};
