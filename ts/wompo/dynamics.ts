/* Classes that hold metadata about every dynamic part inside a rendered template. */
import { ATTR, DEV_MODE } from './constants.js';
import type { Dependency, WompoElement } from './types.js';
import { __setValues } from './render.js';

/** Contains the data about a dynamic node (text/element interpolation). */
export class DynamicNode {
  public startNode: ChildNode;
  public endNode: ChildNode | null;

  public isNode: true = true;
  public isAttr: false = false;
  public isTag: false = false;
  public isAttrs: false = false;

  constructor(startNode: ChildNode, endNode: ChildNode | null) {
    this.startNode = startNode;
    this.endNode = endNode;
  }

  /** Removes every sibling between startNode and endNode (exclusive). */
  public clearValue() {
    let currentNode = this.startNode.nextSibling;
    while (currentNode && currentNode !== this.endNode) {
      currentNode.remove();
      currentNode = this.startNode.nextSibling;
    }
  }

  /** Clears and then also removes the start/end boundary markers. */
  public dispose() {
    this.clearValue();
    this.startNode.remove();
    if (this.endNode) this.endNode.remove();
  }
}

/** Contains the data about a dynamic attribute (plain, event, or property). */
export class DynamicAttribute {
  public node: HTMLElement;
  public name: string;
  public attrStructure: string;

  public isNode: false = false;
  public isAttr: true = true;
  public isTag: false = false;
  public isAttrs: false = false;

  private __callback: (event: Event) => void;
  private __eventInitialized = false;

  constructor(node: HTMLElement, dependency: Dependency) {
    this.node = node;
    this.name = dependency.name;
    this.attrStructure = dependency.attrDynamics;
  }

  public updateValue(newValue: any) {
    if (this.name === 'ref') {
      // Refs are hook handles, never attributes. Also guards nullish values (the old
      // `newValue.__wcRef` check threw on null) and prevents a stringified ref from being
      // written as a junk `ref="[object Object]"` attribute.
      if (newValue && newValue.__wcRef) newValue.current = this.node;
      return;
    }
    if (DEV_MODE && (this.name === 'wc-perf' || this.name == 'wcPerf'))
      (this.node as WompoElement)._$measurePerf = true;
    const isWompoElement = (this.node as WompoElement)._$wompo;
    if (isWompoElement) (this.node as WompoElement).updateProp(this.name, newValue);
    const isPrimitive = newValue !== Object(newValue);
    if (newValue === false || newValue === null || newValue === undefined) {
      this.node.removeAttribute(this.name);
    } else if (
      isPrimitive &&
      (!this.name.match(/[A-Z]/) || this.node.nodeName === 'svg') &&
      this.name !== 'title' &&
      this.name.trim()
    ) {
      this.node.setAttribute(this.name, newValue);
    } else if (this.name === 'style') {
      let styleString = '';
      const styles = Object.keys(newValue);
      for (const key of styles) {
        let styleValue = newValue[key];
        let styleKey = key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
        if (typeof styleValue === 'number') styleValue = `${styleValue}px`;
        if (
          styleValue !== undefined &&
          styleValue !== null &&
          styleValue !== false &&
          styleValue !== ''
        )
          styleString += `${styleKey}:${styleValue};`;
      }
      this.node.setAttribute(this.name, styleString);
    }
    if (this.name === 'title' && isWompoElement) this.node.removeAttribute(this.name);
  }

  set callback(
    callback:
      | ((event: Event) => void)
      | { fn: (event: Event) => void; options?: AddEventListenerOptions },
  ) {
    if (!this.__eventInitialized) {
      const eventName = this.name.substring(1);
      this.node.addEventListener(eventName, this.__listener.bind(this), (callback as any)?.options);
      this.__eventInitialized = true;
    }
    this.__callback = typeof callback === 'function' ? callback : callback?.fn;
  }

  private __listener(event: Event) {
    if (this.__callback) this.__callback(event);
  }
}

/** Contains the data about a dynamic tag name. */
export class DynamicTag {
  public node: ChildNode;

  public isNode: false = false;
  public isAttr: false = false;
  public isTag: true = true;
  public isAttrs: false = false;

  constructor(node: ChildNode) {
    this.node = node;
  }
}

/**
 * Contains the data about a "spread" of attributes/events/properties on a single node, produced
 * by interpolating the result of `attrs({...})` directly inside an open tag.
 */
export class DynamicAttributes {
  public node: HTMLElement;

  public isNode: false = false;
  public isAttr: false = false;
  public isTag: false = false;
  public isAttrs: true = true;

  private __subs: { [key: string]: DynamicAttribute } = {};

  constructor(node: HTMLElement) {
    this.node = node;
  }

  private __isCustomElement() {
    return this.node.nodeName.includes('-');
  }

  private __resolveName(name: string) {
    // The static template parser converts camelCase -> kebab-case on custom-element attributes.
    if (!this.__isCustomElement()) return name;
    if (name.startsWith('@') || name.startsWith('.')) return name;
    if (!/[A-Z]/.test(name)) return name;
    return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }

  private __getSub(name: string): DynamicAttribute {
    let sub = this.__subs[name];
    if (!sub) {
      sub = new DynamicAttribute(this.node, { type: ATTR, index: 0, name });
      this.__subs[name] = sub;
    }
    return sub;
  }

  private __applyOne(rawName: string, value: any) {
    const name = this.__resolveName(rawName);
    if (name.startsWith('@')) {
      this.__getSub(name).callback = value;
      return;
    }
    if (name.startsWith('.')) {
      const valueName = name.substring(1);
      (this.node as any)[valueName] = value;
      return;
    }
    this.__getSub(name).updateValue(value);
  }

  public apply(
    newEntries: { [key: string]: any } | null | undefined,
    oldEntries: { [key: string]: any } | null | undefined,
  ) {
    if (oldEntries) {
      for (const key in oldEntries) {
        if (newEntries && key in newEntries) continue;
        this.__applyOne(key, undefined);
      }
    }
    if (!newEntries) return;
    for (const key in newEntries) {
      this.__applyOne(key, newEntries[key]);
    }
  }
}

/**
 * Holds the children of a component as a plain array so they survive removal from the DOM and can
 * be re-mounted.
 */
export class WompoChildren {
  public nodes: Node[];
  public _$wompoChildren: true = true;

  constructor(nodes: Node[]) {
    this.nodes = nodes;
  }
}

/** A dynamic dependency whose value is an array — handles keyed/non-keyed lists. */
export class WompoArrayDependency {
  public dynamics: DynamicNode[];
  public isArrayDependency: true = true;

  private __oldValues: any[];
  private __oldPureValues: any[];
  private __parentDependency: DynamicNode;
  private __owner: WompoElement;
  private __isKeyed: boolean;

  constructor(values: any[], dependency: DynamicNode, owner: WompoElement) {
    this.dynamics = [];
    this.__oldValues = [];
    this.__parentDependency = dependency;
    this.__owner = owner;
    this.__isKeyed = this.__canUseKeys(values);
    dependency.startNode.after(document.createComment('?wc-end'));
    this.addDependenciesFrom(dependency.startNode, values);
    this.__oldPureValues = values;
  }

  private __canUseKeys(values: any[]) {
    if (!Array.isArray(values)) return false;
    for (let i = 0; i < values.length; i++) {
      if (values[i]?.key === undefined) return false;
    }
    return true;
  }

  private __createMarkers(refNode: ChildNode): [Text, Text] {
    const start = document.createTextNode('');
    const end = document.createTextNode('');
    refNode.after(start, end);
    return [start, end];
  }

  private addDependenciesFrom(startNode: ChildNode, toAdd: any[]) {
    let currentNode: ChildNode = startNode;
    for (let i = 0; i < toAdd.length; i++) {
      const [start, end] = this.__createMarkers(currentNode);
      const dependency = new DynamicNode(start, end);
      currentNode = end;
      this.dynamics.push(dependency);
      this.__oldValues.push(__setValues([dependency], [toAdd[i]], [], this.__owner)[0]);
    }
  }

  private updateNormalArray(newValues: any[]) {
    const oldValuesLength = this.__oldValues.length;
    const diff = newValues.length - oldValuesLength;
    if (diff < 0) {
      for (let i = 0; i < -diff; i++) {
        this.dynamics.pop().dispose();
        this.__oldValues.pop();
      }
    }
    for (let i = 0; i < this.dynamics.length; i++) {
      const dependency = this.dynamics[i];
      const oldValue = this.__oldValues[i];
      this.__oldValues[i] = __setValues([dependency], [newValues[i]], [oldValue], this.__owner)[0];
    }
    if (diff > 0) {
      let currentNode: ChildNode =
        this.dynamics[this.dynamics.length - 1]?.endNode ?? this.__parentDependency.startNode;
      for (let i = 0; i < diff; i++) {
        const [start, end] = this.__createMarkers(currentNode);
        const dependency = new DynamicNode(start, end);
        currentNode = end;
        this.dynamics.push(dependency);
        this.__oldValues.push(
          __setValues([dependency], [newValues[oldValuesLength + i]], [], this.__owner)[0],
        );
      }
    }
    this.__oldPureValues = newValues;
    return this;
  }

  private updateKeyedArray(newValues: any[]) {
    const oldValues = this.__oldValues;
    const oldDynamics = this.dynamics;
    const oldKeyToIndex = new Map<any, number>();
    for (let i = 0; i < oldValues.length; i++) {
      const k = oldValues[i]?.key;
      if (k !== undefined && !oldKeyToIndex.has(k)) {
        oldKeyToIndex.set(k, i);
      }
    }

    const len = newValues.length;
    const newDynamics: DynamicNode[] = new Array(len);
    const newOldValues: any[] = new Array(len);
    const usedOldIndices = new Set<number>();

    for (let i = 0; i < len; i++) {
      const newVal = newValues[i];
      const key = newVal?.key;
      if (key === undefined) continue;
      const oldIndex = oldKeyToIndex.get(key);
      if (oldIndex === undefined || usedOldIndices.has(oldIndex)) continue;
      usedOldIndices.add(oldIndex);
      const dep = oldDynamics[oldIndex];
      const [updatedVal] = __setValues([dep], [newVal], [oldValues[oldIndex]], this.__owner);
      newDynamics[i] = dep;
      newOldValues[i] = updatedVal;
    }

    for (let i = 0; i < len; i++) {
      if (newDynamics[i]) continue;
      const refNode: ChildNode =
        i > 0 ? newDynamics[i - 1].endNode : this.__parentDependency.startNode;
      const [start, end] = this.__createMarkers(refNode);
      const dep = new DynamicNode(start, end);
      const [updatedVal] = __setValues([dep], [newValues[i]], [], this.__owner);
      newDynamics[i] = dep;
      newOldValues[i] = updatedVal;
    }

    for (let i = 0; i < oldDynamics.length; i++) {
      if (!usedOldIndices.has(i)) oldDynamics[i].dispose();
    }

    let currentRef: ChildNode = this.__parentDependency.startNode;
    for (let i = 0; i < len; i++) {
      const dep = newDynamics[i];
      if (currentRef.nextSibling !== dep.startNode) {
        const fragment = document.createDocumentFragment();
        const stopAt: Node | null = dep.endNode ? dep.endNode.nextSibling : null;
        let node: Node | null = dep.startNode;
        while (node && node !== stopAt) {
          const next: Node | null = node.nextSibling;
          fragment.appendChild(node);
          node = next;
        }
        currentRef.after(fragment);
      }
      currentRef = dep.endNode ?? dep.startNode;
    }

    this.dynamics = newDynamics;
    this.__oldValues = newOldValues;
    this.__oldPureValues = newValues;
    return this;
  }

  private handleArray(newValues: any[]) {
    const canUseKeys = this.__canUseKeys(newValues);
    if (this.__isKeyed && canUseKeys) this.updateKeyedArray(newValues);
    else this.updateNormalArray(newValues);
    this.__isKeyed = canUseKeys;
    return this;
  }

  public checkUpdates(newValues: any[]) {
    if (newValues === this.__oldPureValues) return this;
    return this.handleArray(newValues);
  }
}

/** The possible dynamic values: DynamicNode | DynamicAttribute | DynamicTag | DynamicAttributes. */
export type Dynamics = DynamicNode | DynamicAttribute | DynamicTag | DynamicAttributes;
