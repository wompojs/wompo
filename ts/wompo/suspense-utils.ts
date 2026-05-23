/* Helper to locate a parent `wompo-suspense` instance — independent of public-api to avoid cycles. */
import { SUSPENSE_NAME } from './constants.js';
import type { SuspenseInstance } from './types.js';

export const findSuspense = (startNode: Node): SuspenseInstance | null => {
  let suspense = startNode;
  const target = SUSPENSE_NAME.toUpperCase();
  while (suspense && suspense.nodeName !== target) {
    if (suspense.parentNode === null && (suspense as ShadowRoot).host)
      suspense = (suspense as ShadowRoot).host;
    else suspense = suspense?.parentNode;
  }
  return suspense as SuspenseInstance | null;
};
