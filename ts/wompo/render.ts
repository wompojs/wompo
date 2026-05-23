/* Core render engine — applies values to the DOM and handles dynamic tags / portals. */
import { DEV_MODE, DYNAMIC_TAG_MARKER, WC_MARKER } from './constants.js';
import {
  Dynamics,
  DynamicAttribute,
  DynamicAttributes,
  DynamicNode,
  DynamicTag,
  WompoArrayDependency,
  WompoChildren,
} from './dynamics.js';
import { HtmlProcessedValue, __areSameTemplates, __createTemplate } from './template.js';
import { findSuspense } from './suspense-utils.js';
import type {
  AttrsBag,
  RenderHtml,
  SuspenseInstance,
  WompoComponent,
  WompoElement,
} from './types.js';

/** Returns true if the dependency value differs and needs to be reapplied to the DOM. */
export const __shouldUpdate = (currentValue: any, oldValue: any, dependency: Dynamics) => {
  const valuesDiffers = currentValue !== oldValue;
  const isComposedAttribute = !!(dependency as DynamicAttribute).attrStructure;
  const isWompoChildren = currentValue?._$wompoChildren;
  const childrenNeedUpdate =
    isWompoChildren && (dependency as DynamicNode).startNode.nextSibling !== currentValue.nodes[0];
  const isDynamicNodeToUpdate =
    currentValue === oldValue &&
    dependency.isTag &&
    dependency.node.nodeName === DYNAMIC_TAG_MARKER.toUpperCase();
  return valuesDiffers || isComposedAttribute || childrenNeedUpdate || isDynamicNodeToUpdate;
};

/** Swap the placeholder node with a real element (or custom component) and migrate the children. */
export const __handleDynamicTag = (
  currentValue: any,
  currentDependency: DynamicTag,
  valueIndex: number,
  dynamics: Dynamics[],
  values: any[],
) => {
  const node = currentDependency.node;
  let customElement: HTMLElement = null;
  const isCustomComponent = currentValue._$wompoF;
  const newNodeName: string = isCustomComponent ? currentValue.componentName : currentValue;
  if (node.nodeName !== newNodeName.toUpperCase()) {
    const oldAttributes = (node as HTMLElement).getAttributeNames();
    if (isCustomComponent) {
      const initialProps: any = {};
      for (const attrName of oldAttributes) {
        const attrValue = (node as HTMLElement).getAttribute(attrName);
        let propName = attrName;
        if (propName.includes('-')) propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
        initialProps[propName] = attrValue === '' ? true : attrValue;
      }
      customElement = new currentValue.class() as WompoElement;
      (customElement as WompoElement)._$initialProps = initialProps;
      (customElement as WompoElement).props = initialProps;
      const childNodes = node.childNodes;
      while (childNodes.length) {
        customElement.appendChild(childNodes[0]);
      }
    } else {
      customElement = document.createElement(newNodeName);
      for (const attrName of oldAttributes) {
        customElement.setAttribute(attrName, (node as HTMLElement).getAttribute(attrName));
      }
      // Migrate children (text/element + dynamic-node markers) so any nested DynamicNode
      // start/end references remain valid: they reference the moved nodes, only the parent
      // changes. Without this loop the whole subtree is dropped on replaceWith().
      const childNodes = node.childNodes;
      while (childNodes.length) {
        customElement.appendChild(childNodes[0]);
      }
    }
    let index = valueIndex;
    let currentDynamic = dynamics[index] as DynamicAttribute;
    while (currentDynamic?.node === node) {
      currentDynamic.node = customElement;
      if (index === valueIndex) {
        index++;
        currentDynamic = dynamics[index] as DynamicAttribute;
      } else {
        // Seed initial props only for custom components. Native elements have no `_$initialProps`
        // and their attribute dependencies are reapplied by the main __setValues loop.
        if (isCustomComponent && currentDynamic?.name && currentDynamic?.name !== 'ref') {
          ((customElement as WompoElement)._$initialProps as any)[currentDynamic.name] =
            values[index];
          ((customElement as WompoElement).props as any)[currentDynamic.name] = values[index];
        }
        if ((currentDynamic as any).isAttrs && isCustomComponent) {
          const bag = values[index] as AttrsBag;
          if (bag && bag._$wompoAttrs && bag.entries) {
            for (const key in bag.entries) {
              if (key === 'ref' || key.startsWith('@') || key.startsWith('.')) continue;
              const camelKey = key.replace(/-(.)/g, (_, l) => l.toUpperCase());
              ((customElement as WompoElement)._$initialProps as any)[camelKey] = bag.entries[key];
              ((customElement as WompoElement).props as any)[camelKey] = bag.entries[key];
            }
          }
        }
        index++;
        currentDynamic = dynamics[index] as DynamicAttribute;
      }
    }
    node.replaceWith(customElement);
    return customElement;
  }
  return node;
};

export const __setPortal = (portal: HTMLElement, renderingComponent: WompoElement) => {
  const startNode = document.createTextNode('');
  const endNode = document.createTextNode('');
  portal.appendChild(startNode);
  startNode.after(endNode);
  const dependency = new DynamicNode(startNode, endNode);
  renderingComponent._$portals.push(dependency);
  return dependency;
};

/**
 * The DOM-update core. Walks every Dynamic dependency and applies the new value. Recurses on
 * nested `html` templates. Not pure: mutates `dynamics` to keep track of swaps (e.g. dynamic tags
 * or portals).
 */
export const __setValues = (
  dynamics: Dynamics[],
  values: any[],
  oldValues: any[],
  renderingComponent: WompoElement,
) => {
  const newValues = [...values];
  for (let i = 0; i < dynamics.length; i++) {
    const currentDependency = dynamics[i];
    const currentValue = newValues[i];
    const oldValue = oldValues[i];
    if (currentValue?.__wcRef && currentDependency.isAttr && currentDependency.name === 'ref')
      currentValue.current = currentDependency.node;
    if (!__shouldUpdate(currentValue, oldValue, currentDependency)) continue;
    if (currentDependency.isNode) {
      if (currentValue === false || currentValue === undefined || currentValue === null) {
        currentDependency.clearValue();
        continue;
      }
      if (currentValue?._$wompoHtml) {
        const renderHtml = currentValue as RenderHtml;
        const oldProcessedValue = oldValue as HtmlProcessedValue;
        if (
          oldProcessedValue === undefined ||
          !__areSameTemplates(renderHtml, oldProcessedValue?.renderHtml)
        ) {
          const cachedTemplate = __createTemplate(renderHtml);
          const template = cachedTemplate.clone();
          const [fragment, templateDynamics] = template;
          newValues[i] = new HtmlProcessedValue(renderHtml, template, i);
          newValues[i].values = __setValues(
            templateDynamics,
            renderHtml.values,
            [],
            renderingComponent,
          );
          let dependency = currentDependency as DynamicNode;
          if (oldProcessedValue?.renderHtml?._$portal) dependency.dispose();
          else dependency.clearValue();
          if (renderHtml._$portal) {
            const newDependency = __setPortal(renderHtml._$portal, renderingComponent);
            dependency = newDependency;
            dynamics[i] = dependency;
          }
          const startNode = dependency.startNode;
          let currentNode = startNode;
          while (fragment.childNodes.length) {
            if (!currentNode) break;
            currentNode.after(fragment.childNodes[0]);
            currentNode = currentNode.nextSibling;
          }
        } else {
          if (!oldProcessedValue.template) {
            const cachedTemplate = __createTemplate(renderHtml);
            const template = cachedTemplate.clone();
            newValues[i] = new HtmlProcessedValue(renderHtml, template, i);
            const newValue = newValues[i];
            const processedValues = __setValues(
              newValue.template[1],
              renderHtml.values,
              [],
              renderingComponent,
            );
            newValue.values = processedValues;
            if (renderHtml._$portal) {
              const newDependency = __setPortal(renderHtml._$portal, renderingComponent);
              dynamics[i] = newDependency;
            }
          } else {
            const [_, templateDynamics] = oldValue.template;
            const processedValues = __setValues(
              templateDynamics,
              renderHtml.values,
              oldProcessedValue.values,
              renderingComponent,
            );
            if (renderHtml._$portal) renderingComponent._$portals.push(currentDependency);
            oldProcessedValue.values = processedValues;
            newValues[i] = oldValue;
          }
        }
        continue;
      }
      const isPrimitive = currentValue !== Object(currentValue);
      const oldIsPrimitive = oldValue !== Object(oldValue) && oldValue !== undefined;
      const startNode = currentDependency.startNode;
      if (isPrimitive) {
        if (oldIsPrimitive) {
          if (startNode.nextSibling) startNode.nextSibling.textContent = currentValue;
          else startNode.after(currentValue);
        } else {
          currentDependency.clearValue();
          startNode.after(currentValue);
        }
      } else {
        let currentNode = startNode.nextSibling;
        let newNodeIndex = 0;
        let index = 0;
        if (currentValue._$wompoChildren) {
          if (oldValue && !oldValue?._$wompoChildren) currentDependency.clearValue();
          const childrenNodes = (currentValue as WompoChildren).nodes;
          while (index < childrenNodes.length) {
            if (!currentNode || index === 0) currentNode = startNode;
            const newNode = childrenNodes[newNodeIndex];
            newNodeIndex++;
            currentNode.after(newNode);
            currentNode = currentNode.nextSibling;
            index++;
          }
        } else {
          if (Array.isArray(currentValue)) {
            if (!(oldValue as WompoArrayDependency)?.isArrayDependency) {
              currentDependency.clearValue();
              newValues[i] = new WompoArrayDependency(
                currentValue,
                currentDependency,
                renderingComponent,
              );
            } else newValues[i] = (oldValue as WompoArrayDependency).checkUpdates(currentValue);
          } else if (DEV_MODE) {
            throw new Error(
              'Rendering objects is not supported. Please stringify or remove the object.',
            );
          }
        }
      }
    } else if (currentDependency.isAttr) {
      const attrName = currentDependency.name;
      if (attrName.startsWith('@')) {
        currentDependency.callback = currentValue;
      } else if (attrName.startsWith('.')) {
        const valueName = attrName.substring(1);
        if (valueName === 'innerHTML') {
          const node = currentDependency.node;
          const docRef = node.ownerDocument;
          if (node.isContentEditable) {
            const active = docRef.activeElement;
            const sel = docRef.getSelection && docRef.getSelection();
            const focusInsideNode = active === node || (active && node.contains(active));
            let selectionInsideNode = false;
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const container = range.commonAncestorContainer;
              selectionInsideNode = node.contains(container);
            }
            if (focusInsideNode || selectionInsideNode) continue;
          }
        }
        (currentDependency.node as any)[valueName] = currentValue as string;
      } else {
        const attrStructure = currentDependency.attrStructure;
        if (attrStructure) {
          const parts = attrStructure.split(WC_MARKER);
          let dynamicValue = currentValue;
          for (let j = 0; j < parts.length - 1; j++) {
            const value =
              dynamicValue !== undefined && dynamicValue !== null && dynamicValue !== false
                ? dynamicValue
                : '';
            parts[j] = `${parts[j]}${value}`;
            i++;
            dynamicValue = newValues[i];
          }
          i--;
          currentDependency.updateValue(parts.join('').trim());
        } else {
          currentDependency.updateValue(currentValue);
        }
      }
    } else if (currentDependency.isAttrs) {
      if (currentValue && !currentValue._$wompoAttrs) {
        if (DEV_MODE)
          throw new Error(
            'Bare ${...} interpolations inside an open tag must be the result of `attrs({...})`. ' +
              'Received: ' +
              Object.prototype.toString.call(currentValue),
          );
        continue;
      }
      const newEntries = currentValue ? (currentValue as AttrsBag).entries : null;
      const oldEntries = oldValue && oldValue._$wompoAttrs ? (oldValue as AttrsBag).entries : null;
      (currentDependency as DynamicAttributes).apply(newEntries, oldEntries);
    } else if (currentDependency.isTag) {
      const isLazy = currentValue._$wompoLazy;
      if (isLazy) {
        const node = currentDependency.node;
        const suspenseNode = findSuspense(node) as SuspenseInstance | null;
        if (suspenseNode) {
          if (suspenseNode.addSuspense) {
            suspenseNode.addSuspense(node);
          } else {
            suspenseNode.loadingComponents = new Set();
            suspenseNode.loadingComponents.add(node);
          }
          (node as any).suspense = suspenseNode;
        }
        currentValue().then((Component: WompoComponent) => {
          const customElement = __handleDynamicTag(
            Component,
            currentDependency,
            i,
            dynamics,
            values,
          );
          if (suspenseNode) suspenseNode.removeSuspense(node, customElement);
        });
        continue;
      } else {
        __handleDynamicTag(currentValue, currentDependency, i, dynamics, values);
      }
    }
  }
  return newValues;
};
