/* Template caching + the HTML/dependency parser. */
import {
  ATTR,
  ATTRS,
  DYNAMIC_TAG_MARKER,
  NODE,
  TAG,
  WC_ATTRS_ATTR_PREFIX,
  WC_ATTRS_MARKER,
  WC_MARKER,
  isAttrRegex,
  isDynamicTagRegex,
  isInsideTextTag,
  onlyTextChildrenElementsRegex,
  selfClosingRegex,
  treeWalker,
} from './constants.js';
import {
  Dynamics,
  DynamicAttribute,
  DynamicAttributes,
  DynamicNode,
  DynamicTag,
} from './dynamics.js';
import type { Dependency, RenderHtml } from './types.js';

/**
 * The CachedTemplate class is used to efficiently render components. The template HTML element is
 * stored here and only cloned when a new component is instantiated.
 */
export class CachedTemplate {
  public template: HTMLTemplateElement;
  public dependencies: Dependency[];
  /** Indices where the template has an element with no walker-visible children (no element/comment
   * children — text-only or empty). During `adopt()` we use these to detect when a nested custom
   * element has populated itself between SSR and our walk (a non-island wompo component upgrades
   * synchronously when its `customElements.define` runs, and runs its own template render before
   * the enclosing island gets a chance to call `_$hydrate`). Without this, the adopt walker
   * descends into the unexpected children and throws a "hydration mismatch" — even though the
   * shape we *care about* matches. Recording leaf positions lets us treat such elements as the
   * leaves the template said they were and jump past their SSR'd subtree. */
  public leafElementIndices: Set<number>;
  /** Maps the node index of each dynamic-tag placeholder (`wc-wc`) to the node index immediately
   * after its template subtree. When a dynamic tag resolves to a component, that component re-homes
   * the tag's children into its own SSR output (behind a `<template data-wompo-props>` and wrapper
   * elements), so `adopt()` can't walk them in template order. This range lets adopt() splice into
   * the component's `<!--wc-->` children region for the in-range deps, then resume at the
   * component's next sibling — the node the template says comes after the dynamic tag. */
  public dynamicTagSubtrees: Map<number, number>;

  constructor(
    template: HTMLTemplateElement,
    dependencies: Dependency[],
    leafElementIndices: Set<number>,
    dynamicTagSubtrees: Map<number, number>,
  ) {
    this.template = template;
    this.dependencies = dependencies;
    this.leafElementIndices = leafElementIndices;
    this.dynamicTagSubtrees = dynamicTagSubtrees;
  }

  /**
   * Hydration variant of `clone()`. Walks an existing DOM subtree (an SSR-rendered host element)
   * and constructs the same `Dynamics[]` it would have produced from a freshly cloned fragment —
   * but with each Dynamic pointing at the existing DOM nodes.
   *
   * Relies on the SSR emitting `<!--w-->` / `<!--/w-->` marker comments around every node-position
   * interpolation. ATTR/TAG/ATTRS dependencies use the existing element directly.
   *
   * When a NODE region is found, the walker is advanced past its end marker so subsequent
   * dependencies resync with the template's walk order. Mismatches (missing markers or
   * structural drift) throw `HydrationMismatch`, which the component class catches and falls
   * back to destructive re-render.
   */
  public adopt(rootElement: Element): Dynamics[] {
    const dependencies = this.dependencies;
    const leafElementIndices = this.leafElementIndices;
    const dynamicTagSubtrees = this.dynamicTagSubtrees;
    treeWalker.currentNode = rootElement;
    let node = treeWalker.nextNode();
    let nodeIndex = 0;
    let dynamicIndex = 0;
    let templateDependency = dependencies[0];
    const dynamics: Dynamics[] = [];
    // Stack of dynamic-tag boundaries we are currently "inside" (their children were re-homed into
    // the resolved component). Each frame remembers where to resume once its in-range deps are
    // bound. Dynamic tags can nest, so this is a stack.
    const tagFrames: {
      compEl: Element;
      tagIndex: number;
      subtreeEnd: number;
      entered: boolean;
    }[] = [];
    while (templateDependency !== undefined && node !== null) {
      // Transition into / out of a re-homing dynamic-tag's children before matching this dep.
      const frame = tagFrames[tagFrames.length - 1];
      if (frame !== undefined) {
        if (templateDependency.index >= frame.subtreeEnd) {
          // All of this dynamic tag's in-range deps are bound. Resume at the component's next
          // sibling (the node the template says follows the dynamic tag) and realign nodeIndex.
          node = nextNodeSkippingSubtree(frame.compEl);
          nodeIndex = frame.subtreeEnd;
          tagFrames.pop();
          continue;
        }
        if (!frame.entered && templateDependency.index > frame.tagIndex) {
          // First dep that lives *inside* the tag's children (deps at the tag's own index are its
          // attributes and bind to the component element directly). Splice the walker into the
          // component's `<!--wc-->` children region so the re-homed children (which match the
          // template's tag-subtree node-for-node) line up.
          const regionStart = findChildrenRegionStart(frame.compEl);
          if (regionStart === null) {
            throw new HydrationMismatch(
              `no '<!--wc-->' children region in <${frame.compEl.tagName.toLowerCase()}>`,
            );
          }
          treeWalker.currentNode = regionStart;
          node = regionStart as unknown as Node;
          // The region marker sits at the dynamic tag's own index; the next walker step lands on
          // the first re-homed child (tag index + 1), matching the template's subtree numbering.
          nodeIndex = frame.tagIndex;
          frame.entered = true;
        }
      }
      if (nodeIndex === templateDependency.index) {
        const type = templateDependency.type;
        let dynamic: Dynamics;
        if (type === NODE) {
          // When the parent template has `<${Comp}>${children}</${Comp}>` and `Comp` is an
          // island, the parent's children NODE dep lands inside the SSR'd island — but the
          // island's first child is a `<template data-wompo-props>` metadata payload, and the
          // real children markers sit inside the island's own rendered template (e.g. inside
          // the `<a>` produced by `<seawomp-link>`'s render). The parent's adopt walker hits
          // that `<template>` first and would otherwise throw. Treat it as a signal that we're
          // straddling a nested-island boundary and skip forward to the first `<!--w-->`.
          if (
            node.nodeType === 1 &&
            (node as Element).tagName.toLowerCase() === 'template' &&
            (node as Element).hasAttribute('data-wompo-props')
          ) {
            let scan: Node | null = node;
            while (scan && !isNodeStartMarker(scan)) {
              scan = treeWalker.nextNode();
            }
            if (scan) node = scan;
          }
          if (!isNodeStartMarker(node)) {
            throw new HydrationMismatch(
              `expected '<!--w-->' at node index ${nodeIndex}, got ${describeNode(node)}`,
            );
          }
          const startNode = node as unknown as ChildNode;
          const endNode = findEndMarker(startNode);
          if (!endNode) {
            throw new HydrationMismatch(`no matching '<!--/w-->' for start at index ${nodeIndex}`);
          }
          dynamic = new DynamicNode(startNode, endNode);
          // Advance the walker past everything between start and end (inclusive of end), then
          // realign nodeIndex with the template's counting scheme. In the template, a NODE
          // dependency occupies two positions (the `?$wc$` placeholder + the inserted empty end
          // marker); the SSR'd region may contain any number of inner element/comment nodes
          // between `<!--w-->` and `<!--/w-->`, but they are not represented in the template's
          // index space, so we snap back to `index + 1` instead of letting the count drift.
          while (node && node !== endNode) {
            node = treeWalker.nextNode();
          }
          nodeIndex = templateDependency.index + 1;
        } else if (type === ATTR) {
          dynamic = new DynamicAttribute(node as HTMLElement, templateDependency);
        } else if (type === TAG) {
          const compEl = node as Element;
          dynamic = new DynamicTag(compEl as unknown as HTMLElement);
          // If the dynamic tag resolved to a wompo component (every component emits
          // `data-wompo-ssr`), it re-homed the tag's children into its own render output. Push a
          // frame so the loop splices into the component's `<!--wc-->` region for the children deps
          // and resumes at the component's next sibling afterward. Dynamic tags that resolved to a
          // native element keep their children in place, so no frame is needed there.
          // NB: the attribute check alone is NOT enough — a nested component whose class is
          // loaded client-side upgrades (and may hydrate) before this walk runs, so we also
          // accept the `_$ssrStatic`/`_$wompo` upgraded markers.
          const subtreeEnd = dynamicTagSubtrees.get(nodeIndex);
          if (
            subtreeEnd !== undefined &&
            compEl.nodeType === 1 &&
            (compEl.hasAttribute('data-wompo-ssr') ||
              (compEl as any)._$ssrStatic ||
              (compEl as any)._$wompo)
          ) {
            tagFrames.push({ compEl, tagIndex: nodeIndex, subtreeEnd, entered: false });
          }
        } else if (type === ATTRS) {
          dynamic = new DynamicAttributes(node as HTMLElement);
        }
        dynamics.push(dynamic!);
        templateDependency = dependencies[++dynamicIndex];
      }
      if (templateDependency !== undefined && nodeIndex !== templateDependency.index) {
        // If this position is a template-side leaf (no walker-visible children), advance past any
        // descendants the live DOM may have grown after SSR. The typical cause is a nested
        // non-island wompo component upgrading and rendering its own template before the
        // enclosing island gets a chance to call `_$hydrate`. From this template's perspective
        // the element IS a leaf, so we mustn't let unexpected descendants shift our nodeIndex.
        if (node.nodeType === 1 && leafElementIndices.has(nodeIndex)) {
          node = nextNodeSkippingSubtree(node);
        } else {
          node = treeWalker.nextNode();
        }
        nodeIndex++;
      }
    }
    treeWalker.currentNode = document;
    if (dynamicIndex < dependencies.length) {
      throw new HydrationMismatch(
        `expected ${dependencies.length} dependencies but only matched ${dynamicIndex}`,
      );
    }
    return dynamics;
  }

  /**
   * Clone the cached template and build the Dynamics metadata used by __setValues to apply values
   * to the DOM. NODE-dependency empty boundary comments are swapped with invisible text nodes
   * after the walker is done — replacing them mid-iteration would make the walker skip nodes.
   */
  public clone(): [DocumentFragment, Dynamics[]] {
    const content = this.template.content;
    const dependencies = this.dependencies;
    const fragment = document.importNode(content, true);
    treeWalker.currentNode = fragment;
    let node = treeWalker.nextNode();
    let nodeIndex = 0;
    let dynamicIndex = 0;
    let templateDependency = dependencies[0];
    const dynamics = [];
    const pendingEndSwap: DynamicNode[] = [];
    while (templateDependency !== undefined) {
      if (nodeIndex === templateDependency.index) {
        let dynamic: Dynamics;
        const type = templateDependency.type;
        if (type === NODE) {
          const endNode = node.nextSibling;
          const dn = new DynamicNode(node as HTMLElement, endNode);
          if (endNode && endNode.nodeType === 8 && (endNode as Comment).data === '') {
            pendingEndSwap.push(dn);
          }
          dynamic = dn;
        } else if (type === ATTR) {
          dynamic = new DynamicAttribute(node as HTMLElement, templateDependency);
        } else if (type === TAG) {
          dynamic = new DynamicTag(node as HTMLElement);
        } else if (type === ATTRS) {
          dynamic = new DynamicAttributes(node as HTMLElement);
        }
        dynamics.push(dynamic);
        templateDependency = dependencies[++dynamicIndex];
      }
      if (nodeIndex !== templateDependency?.index) {
        node = treeWalker.nextNode()!;
        nodeIndex++;
      }
    }
    treeWalker.currentNode = document;
    for (const dn of pendingEndSwap) {
      const oldEnd = dn.endNode!;
      const replacement = document.createTextNode('');
      oldEnd.parentNode!.replaceChild(replacement, oldEnd);
      dn.endNode = replacement;
    }
    return [fragment, dynamics];
  }
}

/** Thrown by `CachedTemplate.adopt()` when the existing DOM doesn't match the expected template
 * structure. The caller (component class hydration entry) traps this and falls back to a
 * destructive re-render. */
export class HydrationMismatch extends Error {
  public _$wompoHydrationMismatch = true;
  constructor(message: string) {
    super(message);
    this.name = 'HydrationMismatch';
  }
}

/** True if a comment's data marks the start of a NODE region (`w` for an interp, `wc` /
 * `wc:<ssr-id>` for a component's re-homed `${children}`). */
function isRegionStartData(data: string): boolean {
  return data === 'w' || data === 'wc' || data.startsWith('wc:');
}

/** True if a node is a NODE-region start marker (`<!--w-->` for an interp, `<!--wc-->` or
 * `<!--wc:<ssr-id>-->` for a component's re-homed `${children}`). */
function isNodeStartMarker(node: Node): boolean {
  return node.nodeType === 8 && isRegionStartData((node as Comment).data);
}

/** Scan forward from a NODE start marker for its matching end. Both `<!--w-->`/`<!--/w-->` and
 * `<!--wc[:id]-->`/`<!--/wc-->` pairs are tracked with a single depth counter — they are
 * well-nested by the SSR emitter, so the first marker that brings the depth back to 0 is the
 * matching close. */
function findEndMarker(start: ChildNode): ChildNode | null {
  let n: Node | null = start.nextSibling;
  let depth = 1;
  while (n) {
    if (n.nodeType === 8) {
      const data = (n as Comment).data;
      if (isRegionStartData(data)) depth++;
      else if (data === '/w' || data === '/wc') {
        depth--;
        if (depth === 0) return n as ChildNode;
      }
    }
    n = n.nextSibling;
  }
  return null;
}

/** Locate the start of a re-homed children region inside an SSR'd component element. When a parent
 * renders `<${Comp}>…children…</${Comp}>`, `Comp` re-homes those children into its own render
 * output, wrapping the insertion point in `<!--wc:<ssr-id>-->`…`<!--/wc-->` where the id matches
 * `Comp`'s `data-wompo-ssr` value. The id matters: when `Comp`'s template forwards `${children}`
 * into ANOTHER component (`Comp` renders `<${Inner}>${children}</${Inner}>`), the subtree contains
 * `Inner`'s region too — and `Inner`'s start marker comes first in document order, so "first
 * `<!--wc-->` wins" would misalign every dep bound through the frame. Falls back to the first
 * bare `<!--wc-->` when no id is available (legacy SSR output). */
function findChildrenRegionStart(compEl: Element): ChildNode | null {
  const ssrId = compEl.getAttribute && compEl.getAttribute('data-wompo-ssr');
  return findChildrenMarker(compEl, ssrId ? 'wc:' + ssrId : null);
}

/** Scan `root`'s light-DOM subtree for a children-region start marker (a `<template>`'s inert
 * content is in `.content`, not `.childNodes`, so it is naturally skipped). With `exact` set,
 * only that marker matches; otherwise any `wc`-family marker does. */
function findChildrenMarker(root: Element | ShadowRoot, exact: string | null): ChildNode | null {
  const stack: ChildNode[] = [];
  for (let c = root.firstChild; c; c = c.nextSibling) stack.push(c);
  let i = 0;
  while (i < stack.length) {
    const n = stack[i++];
    if (n.nodeType === 8) {
      const data = (n as unknown as Comment).data;
      if (exact !== null ? data === exact : data === 'wc' || data.startsWith('wc:')) return n;
    }
    if (n.nodeType === 1) {
      for (let c = (n as Element).firstChild; c; c = c.nextSibling) stack.push(c);
    }
  }
  return null;
}

/** Collect the live nodes of a hydrating component's own re-homed `${children}` region — the
 * nodes strictly between its `<!--wc:<ssrId>-->` … `<!--/wc-->` markers. They become the
 * component's `props.children`, so client re-renders keep the real SSR'd content: positions
 * adopted in place see the nodes already where they belong (a no-op re-insert), and nested
 * templates that fall back to cloning fresh DOM re-insert the very same nodes — instead of
 * rendering an empty children slot and silently dropping the SSR'd subtree. Returns [] when the
 * component has no children region (it never interpolated `${children}`). */
export function collectSsrChildrenNodes(root: Element | ShadowRoot, ssrId: string | null): Node[] {
  const start = findChildrenMarker(root, ssrId ? 'wc:' + ssrId : null);
  if (!start) return [];
  const end = findEndMarker(start);
  if (!end) return [];
  const nodes: Node[] = [];
  for (let n: ChildNode | null = start.nextSibling; n && n !== end; n = n.nextSibling) {
    nodes.push(n);
  }
  return nodes;
}

/** Return the next walker-visible node (element or comment) in document order that is *not* a
 * descendant of `start`. Walks up the parent chain until a `nextSibling` exists, then descends to
 * the first walker-visible node from there (matching how the treeWalker would land next). When
 * the start node has no element/comment children, this matches `treeWalker.nextNode()`. */
function nextNodeSkippingSubtree(start: Node): Node | null {
  let cur: Node | null = start;
  while (cur) {
    const sib = cur.nextSibling;
    if (sib) {
      // Position the walker at sib (which may be a text node) and ask for the next visible node.
      treeWalker.currentNode = sib;
      if (sib.nodeType === 1 || sib.nodeType === 8) return sib;
      return treeWalker.nextNode();
    }
    cur = cur.parentNode;
    if (!cur || cur === document) return null;
  }
  return null;
}

function describeNode(node: Node): string {
  if (node.nodeType === 1) return `<${(node as Element).tagName.toLowerCase()}>`;
  if (node.nodeType === 8) return `<!--${(node as Comment).data}-->`;
  if (node.nodeType === 3) return `"${(node as Text).data}"`;
  return `[${node.nodeType}]`;
}

/**
 * Stores the processed value of a nested `html` / `svg` interpolation. Lets the renderer keep
 * track of the same kind of caching used by every component.
 */
export class HtmlProcessedValue {
  public values: any[];
  public parts: TemplateStringsArray;
  public template: [DocumentFragment, Dynamics[]];
  public index: number;
  public renderHtml: RenderHtml;
  public key?: string;

  constructor(render: RenderHtml, template: [DocumentFragment, Dynamics[]], index: number) {
    this.values = render.values;
    this.renderHtml = render;
    this.parts = render.parts;
    this.template = template;
    this.index = index;
    this.key = render.key;
  }
}

/**
 * Builds the static HTML string used to populate a `<template>`, replacing dynamic interpolations
 * with markers that __createDependencies will then read back.
 */
export const __createHtml = (parts: TemplateStringsArray): [string, string[]] => {
  let html = '';
  const attributes = [];
  const length = parts.length - 1;
  let attrDelimiter = '';
  let textTagName = '';
  let insideOpenTag = false;
  let attrsCount = 0;
  for (let i = 0; i < length; i++) {
    let part = parts[i];
    for (let k = 0; k < part.length; k++) {
      const c = part.charCodeAt(k);
      if (c === 60 /* < */) insideOpenTag = true;
      else if (c === 62 /* > */) insideOpenTag = false;
    }
    if (attrDelimiter && part.includes(attrDelimiter)) attrDelimiter = '';
    if (textTagName && part.includes(`</${textTagName}>`)) textTagName = '';
    if (attrDelimiter || textTagName) {
      html += part + WC_MARKER;
    } else {
      isAttrRegex.lastIndex = 0;
      const isAttr = isAttrRegex.exec(part);
      // Reject false positives: if the captured "attr name" contains a `>`, we're past a tag
      // close and what looked like an attribute is actually text content.
      if (isAttr && !isAttr[1].includes('>')) {
        const [match, attrName] = isAttr;
        const beforeLastChar = match[match.length - 1];
        const delimiter = match.lastIndexOf('"') > match.lastIndexOf("'") ? '"' : "'";
        if (!attrDelimiter) {
          attrDelimiter = beforeLastChar === '=' ? '' : delimiter;
          part = part.replace(/=([^=]*)$/g, (el) => `${WC_MARKER}=${el.substring(1)}`);
          let toAdd = part;
          if (attrDelimiter) toAdd += WC_MARKER;
          else toAdd += '"0"';
          html += toAdd;
        }
        attributes.push(attrName);
      } else {
        if (part.match(isDynamicTagRegex)) {
          html += part + DYNAMIC_TAG_MARKER;
          continue;
        }
        isInsideTextTag.lastIndex = 0;
        const insideTextTag = isInsideTextTag.exec(part);
        if (insideTextTag) {
          textTagName = insideTextTag[1];
          html += part + WC_MARKER;
        } else if (insideOpenTag) {
          const pad = part.length === 0 || part[part.length - 1] !== ' ' ? ' ' : '';
          html += `${part}${pad}${WC_ATTRS_ATTR_PREFIX}${attrsCount}="${WC_MARKER}"`;
          attributes.push(WC_ATTRS_MARKER);
          attrsCount++;
        } else {
          html += part + `<?${WC_MARKER}>`;
        }
      }
    }
  }
  html += parts[parts.length - 1];
  html = html.replace(selfClosingRegex, (match, firstPart, componentName) => {
    if (match.endsWith('/>')) return `${firstPart}></${componentName}>`;
    return match;
  });
  html = html.replace(/<[a-z]*-[a-z]*\s?.*?>/gms, (match) => {
    return match.replace(/(?<=\s)([a-z]+([A-Z][a-z]*)+)[=\s]/gms, (attr) =>
      attr.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
    );
  });
  return [html, attributes];
};

/**
 * Walks the just-built template content and extracts the dependency metadata that __setValues uses
 * to efficiently update the DOM on each render.
 */
export const __createDependencies = (
  template: HTMLTemplateElement,
  parts: TemplateStringsArray,
  attributes: string[],
) => {
  const dependencies: Dependency[] = [];
  treeWalker.currentNode = template.content;
  let node: Element;
  let dependencyIndex = 0;
  let nodeIndex = 0;
  const partsLength = parts.length;
  while (((node as Node) = treeWalker.nextNode()) !== null && dependencies.length < partsLength) {
    if (node.nodeType === 1) {
      if (node.nodeName === DYNAMIC_TAG_MARKER.toUpperCase()) {
        dependencies.push({ type: TAG, index: nodeIndex });
      }
      if (node.hasAttributes()) {
        const attributeNames = node.getAttributeNames();
        for (const attrName of attributeNames) {
          if (attrName.startsWith(WC_ATTRS_ATTR_PREFIX)) {
            dependencyIndex++;
            dependencies.push({ type: ATTRS, index: nodeIndex });
            node.removeAttribute(attrName);
          } else if (attrName.endsWith(WC_MARKER)) {
            const realName = attributes[dependencyIndex++];
            const attrValue = node.getAttribute(attrName);
            if (attrValue !== '0') {
              const dynamicParts = attrValue.split(WC_MARKER);
              for (let i = 0; i < dynamicParts.length - 1; i++) {
                dependencies.push({
                  type: ATTR,
                  index: nodeIndex,
                  attrDynamics: attrValue,
                  name: realName,
                });
              }
            } else {
              dependencies.push({ type: ATTR, index: nodeIndex, name: realName });
            }
            node.removeAttribute(attrName);
          }
        }
      }
      if (onlyTextChildrenElementsRegex.test(node.tagName)) {
        const strings = node.textContent!.split(WC_MARKER);
        const lastIndex = strings.length - 1;
        if (lastIndex > 0) {
          node.textContent = '';
          for (let i = 0; i < lastIndex; i++) {
            node.append(strings[i], document.createComment(''));
            treeWalker.nextNode();
            dependencies.push({ type: NODE, index: ++nodeIndex });
          }
          node.append(strings[lastIndex], document.createComment(''));
        }
      }
    } else if (node.nodeType === 8) {
      const data = (node as unknown as Comment).data;
      if (data === `?${WC_MARKER}`) {
        dependencies.push({ type: NODE, index: nodeIndex });
        // Every NODE dependency needs an explicit end marker as its next sibling. Without it,
        // when the placeholder is the last child of its parent, the DynamicNode's endNode would
        // be null and clearValue() would walk past the intended boundary.
        node.parentNode!.insertBefore(document.createComment(''), node.nextSibling);
      }
    }
    nodeIndex++;
  }
  return dependencies;
};

/** Walk the (post-`__createDependencies`) template and record indices for elements that have no
 * walker-visible children — i.e. elements that occupy a single position in the dependency index
 * space. `adopt()` uses this to recognise positions where the live DOM may legitimately have
 * extra descendants the template doesn't know about (typically because a nested non-island
 * custom element rendered itself before the enclosing island called `_$hydrate`). */
const __computeLeafElementIndices = (templateContent: DocumentFragment): Set<number> => {
  const leaves = new Set<number>();
  treeWalker.currentNode = templateContent;
  let node: Node | null;
  let idx = 0;
  while ((node = treeWalker.nextNode())) {
    if (node.nodeType === 1) {
      let hasWalkerChild = false;
      for (let c = (node as Element).firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 1 || c.nodeType === 8) {
          hasWalkerChild = true;
          break;
        }
      }
      if (!hasWalkerChild) leaves.add(idx);
    }
    idx++;
  }
  treeWalker.currentNode = document;
  return leaves;
};

/** Count an element's walker-visible (element/comment) descendants. A `<template>`'s content lives
 * in `.content`, not `.childNodes`, so it is naturally excluded — matching the live treeWalker. */
const __countWalkerDescendants = (el: Element): number => {
  let count = 0;
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1) {
      count += 1 + __countWalkerDescendants(c as Element);
    } else if (c.nodeType === 8) {
      count += 1;
    }
  }
  return count;
};

/** Walk the (post-`__createDependencies`) template and map each dynamic-tag placeholder's node
 * index to the node index immediately after its subtree. See `CachedTemplate.dynamicTagSubtrees`. */
const __computeDynamicTagSubtrees = (templateContent: DocumentFragment): Map<number, number> => {
  const subtrees = new Map<number, number>();
  treeWalker.currentNode = templateContent;
  let node: Node | null;
  let idx = 0;
  while ((node = treeWalker.nextNode())) {
    if (node.nodeType === 1 && (node as Element).tagName === DYNAMIC_TAG_MARKER.toUpperCase()) {
      subtrees.set(idx, idx + __countWalkerDescendants(node as Element) + 1);
    }
    idx++;
  }
  treeWalker.currentNode = document;
  return subtrees;
};

/** Create a new CachedTemplate for a given RenderHtml. */
export const __createTemplate = (html: RenderHtml) => {
  const [dom, attributes] = __createHtml(html.parts);
  const template = document.createElement('template');
  if (html._$wompoSvg) {
    template.innerHTML = `<svg>${dom}</svg>`;
    const svgWrapper = template.content.firstChild;
    if (svgWrapper) {
      while (svgWrapper.firstChild) {
        template.content.insertBefore(svgWrapper.firstChild, svgWrapper);
      }
      template.content.removeChild(svgWrapper);
    }
  } else {
    template.innerHTML = dom;
  }
  const dependencies = __createDependencies(template, html.parts, attributes);
  const leafElementIndices = __computeLeafElementIndices(template.content);
  const dynamicTagSubtrees = __computeDynamicTagSubtrees(template.content);
  return new CachedTemplate(template, dependencies, leafElementIndices, dynamicTagSubtrees);
};

/** True if two RenderHtml objects describe the same template. */
export const __areSameTemplates = (newTemplate: RenderHtml, oldTemplate: RenderHtml) => {
  if (!newTemplate || !oldTemplate) return false;
  const newParts = newTemplate.parts;
  const oldParts = oldTemplate.parts;
  if (newTemplate.key && oldTemplate.key && newTemplate.key === oldTemplate.key) return true;
  if (newParts.length !== oldParts?.length) return false;
  const newValues = newTemplate.values;
  const oldValues = oldTemplate.values;
  for (let i = 0; i < newParts.length; i++) {
    if (newParts[i] !== oldParts[i]) return false;
    if (newValues[i]?._$wompoF) {
      if (!oldValues[i]?._$wompoF) return false;
      if (newValues[i].componentName !== oldValues[i].componentName) return false;
    }
  }
  return true;
};
