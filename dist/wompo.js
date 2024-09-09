const DEV_MODE = false;
let currentRenderingComponent = null;
let currentHookIndex = 0;
const WC_MARKER = "$wc$";
const DYNAMIC_TAG_MARKER = "wc-wc";
const isDynamicTagRegex = /<\/?$/g;
const isAttrRegex = /\s+([^\s]*?)=(["'][^"']*?)?$/g;
const selfClosingRegex = /(<([a-z]*-[a-z]*).*?)\/?>/gs;
const isInsideTextTag = /<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi;
const onlyTextChildrenElementsRegex = /^(?:script|style|textarea|title)$/i;
const NODE = 0;
const ATTR = 1;
const TAG = 2;
const IS_SERVER = typeof global !== "undefined";
const doc = IS_SERVER ? { createTreeWalker() {
} } : document;
const treeWalker = doc.createTreeWalker(
  doc,
  129
  // NodeFilter.SHOW_{ELEMENT|COMMENT}
);
const mutationAttributesExclusions = ["class", "style", "id"];
class CachedTemplate {
  /**
   * Create a new CachedTemplate instance.
   * @param template The HTML Template already elaborated to handle the dynamic parts.
   * @param dependencies The metadata dependencies for the template.
   */
  constructor(template, dependencies) {
    this.template = template;
    this.dependencies = dependencies;
  }
  /**
   * This function will clone the template content and build the dynamcis metadata - an array
   * containing all the information to efficiently put values in the DOM, without checking if each
   * node is equal to a virtual one. The DOM update is not done through this function, but thanks to
   * the `__setValues` function.
   * @returns An array containing 2 values: The DOM fragment cloned from the content of the
   * template, and the dynamics metadata.
   */
  clone() {
    const content = this.template.content;
    const dependencies = this.dependencies;
    const fragment = document.importNode(content, true);
    treeWalker.currentNode = fragment;
    let node = treeWalker.nextNode();
    let nodeIndex = 0;
    let dynamicIndex = 0;
    let templateDependency = dependencies[0];
    const dynamics = [];
    while (templateDependency !== void 0) {
      if (nodeIndex === templateDependency.index) {
        let dynamic;
        const type = templateDependency.type;
        if (type === NODE) {
          dynamic = new DynamicNode(node, node.nextSibling);
        } else if (type === ATTR) {
          dynamic = new DynamicAttribute(node, templateDependency);
        } else if (type === TAG) {
          dynamic = new DynamicTag(node);
        }
        dynamics.push(dynamic);
        templateDependency = dependencies[++dynamicIndex];
      }
      if (nodeIndex !== templateDependency?.index) {
        node = treeWalker.nextNode();
        nodeIndex++;
      }
    }
    treeWalker.currentNode = document;
    return [fragment, dynamics];
  }
}
class HtmlProcessedValue {
  constructor(render, template) {
    this.values = render.values;
    this.parts = render.parts;
    this.template = template;
  }
}
class DynamicNode {
  // For faster access
  /**
   * Creates a new DynamicNode instance.
   * @param startNode The start node.
   * @param endNode The end node.
   */
  constructor(startNode, endNode) {
    this.isNode = true;
    // For faster access
    this.isAttr = false;
    // For faster access
    this.isTag = false;
    this.startNode = startNode;
    this.endNode = endNode;
  }
  /**
   * Removes all the nodes between the start and the end nodes.
   */
  clearValue() {
    let currentNode = this.startNode.nextSibling;
    while (currentNode && currentNode !== this.endNode) {
      currentNode.remove();
      currentNode = this.startNode.nextSibling;
    }
  }
  /**
   * First removes all the nodes between the start and the end nodes, then it also removes the
   * start node and the end node.
   */
  dispose() {
    this.clearValue();
    this.startNode.remove();
    if (this.endNode)
      this.endNode.remove();
  }
}
class DynamicAttribute {
  /**
   * Creates a new DynamicAttribute instance.
   * @param node The node that owns the attribute.
   * @param dependency The dependency metadata.
   */
  constructor(node, dependency) {
    this.isNode = false;
    // For faster access
    this.isAttr = true;
    // For faster access
    this.isTag = false;
    /** True if an event has already been initialized. */
    this.__eventInitialized = false;
    this.node = node;
    this.name = dependency.name;
    this.attrStructure = dependency.attrDynamics;
  }
  /**
   * Update an attribute value.
   * @param newValue The new value of the attribute
   */
  updateValue(newValue) {
    if (this.name === "ref" && newValue.__wcRef) {
      newValue.current = this.node;
      return;
    }
    if (DEV_MODE && (this.name === "wc-perf" || this.name == "wcPerf"))
      this.node._$measurePerf = true;
    const isWompoElement = this.node._$wompo;
    if (isWompoElement)
      this.node.updateProp(this.name, newValue);
    const isPrimitive = newValue !== Object(newValue);
    if (newValue === false || newValue === null || newValue === void 0) {
      this.node.removeAttribute(this.name);
    } else if (isPrimitive && (!this.name.match(/[A-Z]/) || this.node.nodeName === "svg") && this.name !== "title") {
      this.node.setAttribute(this.name, newValue);
    } else if (this.name === "style") {
      let styleString = "";
      const styles = Object.keys(newValue);
      for (const key of styles) {
        let styleValue = newValue[key];
        let styleKey = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
        if (typeof styleValue === "number")
          styleValue = `${styleValue}px`;
        if (styleValue !== void 0 && styleValue !== null && styleValue !== false)
          styleString += `${styleKey}:${styleValue};`;
      }
      this.node.setAttribute(this.name, styleString);
    }
    if (this.name === "title" && isWompoElement)
      this.node.removeAttribute(this.name);
  }
  /**
   * Set the callback function to be executed when an event is fired. If the event has not been
   * initialized, the event listener will be added.
   */
  set callback(callback) {
    if (!this.__eventInitialized) {
      const eventName = this.name.substring(1);
      this.node.addEventListener(eventName, this.__listener.bind(this));
      this.__eventInitialized = true;
    }
    this.__callback = callback;
  }
  /**
   * The listener that will execute the __callback function (if defined).
   * @param event The event object
   */
  __listener(event) {
    if (this.__callback)
      this.__callback(event);
  }
}
class DynamicTag {
  // For faster access
  /**
   * Creates a new DynamicTag instance.
   * @param node The node instance.
   */
  constructor(node) {
    this.isNode = false;
    // For faster access
    this.isAttr = false;
    // For faster access
    this.isTag = true;
    this.node = node;
  }
}
class WompoChildren {
  constructor(nodes) {
    this._$wompoChildren = true;
    this.nodes = nodes;
  }
}
class WompoArrayDependency {
  /**
   * Creates a new WompoArrayDependency instance.
   * @param values The array of values to put in the DOM
   * @param dependency The dynamic node dependency on which the array should be rendered.
   */
  constructor(values, dependency) {
    this.isArrayDependency = true;
    this.dynamics = [];
    this.__oldValues = [];
    this.__parentDependency = dependency;
    dependency.startNode.after(document.createComment("?wc-end"));
    this.addDependenciesFrom(dependency.startNode, values);
    this.__oldPureValues = values;
  }
  /**
   * This function will add markers (HTML comments) and generate dynamic nodes dependecies used to
   * efficiently udpate the values inside of the array.
   * @param startNode The start node on which insert the new "single-item" dependencies.
   * @param toAdd The values to add
   */
  addDependenciesFrom(startNode, toAdd) {
    let currentNode = startNode;
    for (let i = 0; i < toAdd.length; i++) {
      const value = toAdd[i];
      currentNode.after(document.createTextNode(""));
      currentNode.after(document.createTextNode(""));
      const dependency = new DynamicNode(
        currentNode.nextSibling,
        currentNode.nextSibling.nextSibling
      );
      currentNode = currentNode.nextSibling.nextSibling;
      this.dynamics.push(dependency);
      this.__oldValues.push(__setValues([dependency], [value], [])[0]);
    }
  }
  /**
   * Check if there are dependencies to add/remove, and then set the new values to the old nodes.
   * Setting the new values will start an eventual recursive check for eventual nested arrays.
   * @param newValues The new values to check with the old ones fot updates.
   * @returns This instance.
   */
  checkUpdates(newValues) {
    if (newValues === this.__oldPureValues)
      return this;
    const oldValuesLength = this.__oldValues.length;
    let diff = newValues.length - oldValuesLength;
    if (diff < 0) {
      while (diff) {
        const toClean = this.dynamics.pop();
        this.__oldValues.pop();
        toClean.dispose();
        diff++;
      }
    }
    for (let i = 0; i < this.dynamics.length; i++) {
      const newValue = newValues[i];
      const dependency = this.dynamics[i];
      const oldValue = this.__oldValues[i];
      this.__oldValues[i] = __setValues([dependency], [newValue], [oldValue])[0];
    }
    if (diff > 0) {
      let currentNode = this.dynamics[this.dynamics.length - 1]?.endNode;
      if (!currentNode)
        currentNode = this.__parentDependency.startNode;
      for (let i = 0; i < diff; i++) {
        const value = newValues[oldValuesLength + i];
        currentNode.after(document.createTextNode(""));
        currentNode.after(document.createTextNode(""));
        const dependency = new DynamicNode(
          currentNode.nextSibling,
          currentNode.nextSibling.nextSibling
        );
        currentNode = currentNode.nextSibling.nextSibling;
        this.dynamics.push(dependency);
        this.__oldValues.push(__setValues([dependency], [value], []));
      }
    }
    this.__oldPureValues = newValues;
    return this;
  }
}
const __generateSpecifcStyles = (component, options) => {
  const { css } = component;
  const { shadow, name, cssModule } = options;
  const componentName = name;
  const classes = {};
  let generatedCss = css;
  if (cssModule) {
    if (!css.includes(":host"))
      generatedCss = `${shadow ? ":host" : componentName} {display:block;} ${css}`;
    if (DEV_MODE) {
      const invalidSelectors = [];
      [...generatedCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
        const cssSelector = selector[1].trim();
        if (!cssSelector.match(/\.|:host|@/))
          invalidSelectors.push(cssSelector);
      });
      invalidSelectors.forEach((selector) => {
        console.warn(
          `The CSS selector "${selector} {...}" in the component "${componentName}" is not enough specific: include at least one class or deactive the "cssModule" option on the component.`
        );
      });
    }
    if (!shadow)
      generatedCss = generatedCss.replace(/:host/g, componentName);
    generatedCss = generatedCss.replace(/\.(?!\d)([_a-zA-Z0-9-]+)/gm, (_, className) => {
      const uniqueClassName = `${componentName}__${className}`;
      classes[className] = uniqueClassName;
      return `.${uniqueClassName}`;
    });
  }
  return [generatedCss, classes];
};
const __createHtml = (parts) => {
  let html2 = "";
  const attributes = [];
  const length = parts.length - 1;
  let attrDelimiter = "";
  let textTagName = "";
  for (let i = 0; i < length; i++) {
    let part = parts[i];
    if (attrDelimiter && part.includes(attrDelimiter))
      attrDelimiter = "";
    if (textTagName && new RegExp(`</${textTagName}>`))
      textTagName = "";
    if (attrDelimiter || textTagName) {
      html2 += part + WC_MARKER;
    } else {
      isAttrRegex.lastIndex = 0;
      const isAttr = isAttrRegex.exec(part);
      if (isAttr) {
        const [match, attrName] = isAttr;
        const beforeLastChar = match[match.length - 1];
        const delimiter = match.lastIndexOf('"') > match.lastIndexOf("'") ? '"' : "'";
        if (!attrDelimiter) {
          attrDelimiter = beforeLastChar === "=" ? "" : delimiter;
          part = part.replace(/=([^=]*)$/g, (el) => `${WC_MARKER}=${el.substring(1)}`);
          let toAdd = part;
          if (attrDelimiter)
            toAdd += WC_MARKER;
          else
            toAdd += '"0"';
          html2 += toAdd;
        }
        attributes.push(attrName);
      } else {
        if (part.match(isDynamicTagRegex)) {
          html2 += part + DYNAMIC_TAG_MARKER;
          continue;
        }
        isInsideTextTag.lastIndex = 0;
        const insideTextTag = isInsideTextTag.exec(part);
        if (insideTextTag) {
          textTagName = insideTextTag[1];
          html2 += part + WC_MARKER;
        } else {
          html2 += part + `<?${WC_MARKER}>`;
        }
      }
    }
  }
  html2 += parts[parts.length - 1];
  html2 = html2.replace(selfClosingRegex, (match, firstPart, componentName) => {
    if (match.endsWith("/>"))
      return `${firstPart}></${componentName}>`;
    return match;
  });
  html2 = html2.replace(/<[a-z]*-[a-z]*\s?.*?>/gms, (match) => {
    return match.replace(
      /(?<=\s)([a-z]+([A-Z][a-z]*)+)[=\s]/gms,
      (attr) => attr.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    );
  });
  return [html2, attributes];
};
const __createDependencies = (template, parts, attributes) => {
  const dependencies = [];
  treeWalker.currentNode = template.content;
  let node;
  let dependencyIndex = 0;
  let nodeIndex = 0;
  const partsLength = parts.length;
  while ((node = treeWalker.nextNode()) !== null && dependencies.length < partsLength) {
    if (node.nodeType === 1) {
      if (node.nodeName === DYNAMIC_TAG_MARKER.toUpperCase()) {
        const dependency = {
          type: TAG,
          index: nodeIndex
        };
        dependencies.push(dependency);
      }
      if (node.hasAttributes()) {
        const attributeNames = node.getAttributeNames();
        for (const attrName of attributeNames) {
          if (attrName.endsWith(WC_MARKER)) {
            const realName = attributes[dependencyIndex++];
            const attrValue = node.getAttribute(attrName);
            if (attrValue !== "0") {
              const dynamicParts = attrValue.split(WC_MARKER);
              for (let i = 0; i < dynamicParts.length - 1; i++) {
                const dependency = {
                  type: ATTR,
                  index: nodeIndex,
                  attrDynamics: attrValue,
                  name: realName
                };
                dependencies.push(dependency);
              }
            } else {
              const dependency = {
                type: ATTR,
                index: nodeIndex,
                name: realName
              };
              dependencies.push(dependency);
            }
            node.removeAttribute(attrName);
          }
        }
      }
      if (onlyTextChildrenElementsRegex.test(node.tagName)) {
        const strings = node.textContent.split(WC_MARKER);
        const lastIndex = strings.length - 1;
        if (lastIndex > 0) {
          node.textContent = "";
          for (let i = 0; i < lastIndex; i++) {
            node.append(strings[i], document.createComment(""));
            treeWalker.nextNode();
            dependencies.push({ type: NODE, index: ++nodeIndex });
          }
          node.append(strings[lastIndex], document.createComment(""));
        }
      }
    } else if (node.nodeType === 8) {
      const data = node.data;
      if (data === `?${WC_MARKER}`)
        dependencies.push({ type: NODE, index: nodeIndex });
    }
    nodeIndex++;
  }
  return dependencies;
};
const __createTemplate = (html2) => {
  const [dom, attributes] = __createHtml(html2.parts);
  const template = document.createElement("template");
  template.innerHTML = dom;
  const dependencies = __createDependencies(template, html2.parts, attributes);
  return new CachedTemplate(template, dependencies);
};
const __areSameTemplates = (newTemplate, oldTemplate) => {
  if (!newTemplate || !oldTemplate)
    return false;
  const newParts = newTemplate.parts;
  const oldParts = oldTemplate.parts;
  if (newParts.length !== oldParts?.length)
    return false;
  const newValues = newTemplate.values;
  const oldValues = oldTemplate.values;
  for (let i = 0; i < newParts.length; i++) {
    if (newParts[i] !== oldParts[i])
      return false;
    if (newValues[i]?._$wompoF) {
      if (!oldValues[i]?._$wompoF)
        return false;
      if (newValues[i].componentName !== oldValues[i].componentName)
        return false;
    }
  }
  return true;
};
const __shouldUpdate = (currentValue, oldValue, dependency) => {
  const valuesDiffers = currentValue !== oldValue;
  const isComposedAttribute = !!dependency.attrStructure;
  const isWompoChildren = currentValue?._$wompoChildren;
  const childrenNeedUpdate = isWompoChildren && dependency.startNode.nextSibling !== currentValue.nodes[0];
  return valuesDiffers || isComposedAttribute || childrenNeedUpdate;
};
const __handleDynamicTag = (currentValue, currentDependency, valueIndex, dynamics, values) => {
  const node = currentDependency.node;
  let customElement = null;
  const isCustomComponent = currentValue._$wompoF;
  const newNodeName = isCustomComponent ? currentValue.componentName : currentValue;
  if (node.nodeName !== newNodeName.toUpperCase()) {
    const oldAttributes = node.getAttributeNames();
    if (isCustomComponent) {
      const initialProps = {};
      for (const attrName of oldAttributes) {
        const attrValue = node.getAttribute(attrName);
        let propName = attrName;
        if (propName.includes("-"))
          propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
        initialProps[propName] = attrValue === "" ? true : attrValue;
      }
      customElement = new currentValue.class();
      customElement._$initialProps = initialProps;
      customElement.props = initialProps;
      const childNodes = node.childNodes;
      while (childNodes.length) {
        customElement.appendChild(childNodes[0]);
      }
    } else {
      customElement = document.createElement(newNodeName);
      for (const attrName of oldAttributes) {
        customElement.setAttribute(attrName, node.getAttribute(attrName));
      }
    }
    let index = valueIndex;
    let currentDynamic = dynamics[index];
    while (currentDynamic?.node === node) {
      currentDynamic.node = customElement;
      if (index === valueIndex) {
        index++;
        currentDynamic = dynamics[index];
      } else {
        if (currentDynamic?.name && currentDynamic?.name !== "ref") {
          customElement._$initialProps[currentDynamic.name] = values[index];
          customElement.props[currentDynamic.name] = values[index];
        }
        index++;
        currentDynamic = dynamics[index];
      }
    }
    node.replaceWith(customElement);
    return customElement;
  }
};
const __setValues = (dynamics, values, oldValues) => {
  const newValues = [...values];
  for (let i = 0; i < dynamics.length; i++) {
    const currentDependency = dynamics[i];
    const currentValue = newValues[i];
    const oldValue = oldValues[i];
    if (currentValue?.__wcRef && currentDependency.isAttr && currentDependency.name === "ref")
      currentValue.current = currentDependency.node;
    if (!__shouldUpdate(currentValue, oldValue, currentDependency))
      continue;
    if (currentDependency.isNode) {
      if (currentValue === false || currentValue === void 0 || currentValue === null) {
        currentDependency.clearValue();
        continue;
      }
      if (currentValue?._$wompoHtml) {
        const areTheSame = __areSameTemplates(currentValue, oldValue);
        if (oldValue === void 0 || !areTheSame) {
          const cachedTemplate = __createTemplate(currentValue);
          const template = cachedTemplate.clone();
          const [fragment, dynamics2] = template;
          newValues[i] = new HtmlProcessedValue(currentValue, template);
          newValues[i].values = __setValues(
            dynamics2,
            currentValue.values,
            oldValue?.values ?? oldValue ?? []
          );
          const startNode2 = currentDependency.startNode;
          currentDependency.clearValue();
          let currentNode = startNode2;
          while (fragment.childNodes.length) {
            currentNode.after(fragment.childNodes[0]);
            currentNode = currentNode.nextSibling;
          }
        } else {
          let oldTemplateValue = oldValue;
          if (!oldValue.template) {
            const cachedTemplate = __createTemplate(currentValue);
            const template = cachedTemplate.clone();
            newValues[i] = new HtmlProcessedValue(currentValue, template);
            oldTemplateValue = newValues[i];
          }
          const [_, dynamics2] = oldTemplateValue.template;
          const processedValues = __setValues(
            dynamics2,
            currentValue.values,
            oldValue.values
          );
          oldValue.values = processedValues;
          newValues[i] = oldValue;
        }
        continue;
      }
      const isPrimitive = currentValue !== Object(currentValue);
      const oldIsPrimitive = oldValue !== Object(oldValue) && oldValue !== void 0;
      const startNode = currentDependency.startNode;
      if (isPrimitive) {
        if (oldIsPrimitive) {
          if (startNode.nextSibling)
            startNode.nextSibling.textContent = currentValue;
          else
            startNode.after(currentValue);
        } else {
          currentDependency.clearValue();
          startNode.after(currentValue);
        }
      } else {
        let currentNode = startNode.nextSibling;
        let newNodeIndex = 0;
        let index = 0;
        if (currentValue._$wompoChildren) {
          if (oldValue && !oldValue?._$wompoChildren)
            currentDependency.clearValue();
          const childrenNodes = currentValue.nodes;
          while (index < childrenNodes.length) {
            if (!currentNode || index === 0)
              currentNode = startNode;
            const newNode = childrenNodes[newNodeIndex];
            newNodeIndex++;
            currentNode.after(newNode);
            currentNode = currentNode.nextSibling;
            index++;
          }
        } else {
          if (Array.isArray(currentValue)) {
            if (!oldValue?.isArrayDependency) {
              currentDependency.clearValue();
              newValues[i] = new WompoArrayDependency(currentValue, currentDependency);
            } else
              newValues[i] = oldValue.checkUpdates(currentValue);
          } else if (DEV_MODE) {
            throw new Error(
              "Rendering objects is not supported. Please stringify or remove the object."
            );
          }
        }
      }
    } else if (currentDependency.isAttr) {
      const attrName = currentDependency.name;
      if (attrName.startsWith("@")) {
        currentDependency.callback = currentValue;
      } else {
        const attrStructure = currentDependency.attrStructure;
        if (attrStructure) {
          const parts = attrStructure.split(WC_MARKER);
          let dynamicValue = currentValue;
          for (let j = 0; j < parts.length - 1; j++) {
            const value = dynamicValue !== void 0 && dynamicValue !== null && dynamicValue !== false ? dynamicValue : "";
            parts[j] = `${parts[j]}${value}`;
            i++;
            dynamicValue = newValues[i];
          }
          i--;
          currentDependency.updateValue(parts.join("").trim());
        } else {
          currentDependency.updateValue(currentValue);
        }
      }
    } else if (currentDependency.isTag) {
      const isLazy = currentValue._$wompoLazy;
      if (isLazy) {
        const node = currentDependency.node;
        const suspenseNode = findSuspense(node);
        if (suspenseNode) {
          if (suspenseNode.addSuspense) {
            suspenseNode.addSuspense(node);
          } else {
            suspenseNode.loadingComponents = /* @__PURE__ */ new Set();
            suspenseNode.loadingComponents.add(node);
          }
          node.suspense = suspenseNode;
        }
        currentValue().then((Component) => {
          const customElement = __handleDynamicTag(
            Component,
            currentDependency,
            i,
            dynamics,
            values
          );
          if (suspenseNode)
            suspenseNode.removeSuspense(node, customElement);
        });
        continue;
      } else {
        __handleDynamicTag(currentValue, currentDependency, i, dynamics, values);
      }
    }
  }
  return newValues;
};
const _$wompo = (Component, options) => {
  const { generatedCSS, styles } = Component.options;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(generatedCSS);
  const WompoComponent = class extends HTMLElement {
    constructor() {
      super();
      this._$wompo = true;
      // For faster access
      this.props = {};
      this.hooks = [];
      this._$measurePerf = false;
      this._$initialProps = {};
      this._$usesContext = false;
      this._$hasBeenMoved = false;
      this._$layoutEffects = [];
      /** It'll be true if the component has already processing an update. */
      this.__updating = false;
      /** The array containing the dynamic values of the last render. */
      this.__oldValues = [];
      /** It'll be true if the component is currently initializing. */
      this.__isInitializing = true;
      /** It's true if the component is connected to the DOM. */
      this.__connected = false;
      /** It's true if the component has been disconnected from the DOM. */
      this.__disconnected = false;
      /**
       * Used to know if a component has been completely removed from the DOM or only temporarely to
       * move it from a node to another.
       */
      this.__isInDOM = false;
    }
    static {
      this._$wompo = true;
    }
    static {
      // For faster access
      /** The component name, used in the DOM */
      this.componentName = options.name;
    }
    /**
     * Get the already present cached template, or create a new one if the component is rendering
     * for the first time.
     * @param parts The template parts from the html function.
     * @returns The cached template.
     */
    static _$getOrCreateTemplate(html2) {
      if (!this._$cachedTemplate)
        this._$cachedTemplate = __createTemplate(html2);
      return this._$cachedTemplate;
    }
    /** @override component has been connected to the DOM */
    connectedCallback() {
      if (this.__disconnected && this.isConnected) {
        this.__disconnected = false;
        for (const hook of this.hooks) {
          if (hook?.callback) {
            Promise.resolve().then(() => {
              hook.callback();
            });
          }
        }
      }
      this.__isInDOM = true;
      if (!this.__connected && this.isConnected)
        this.__initElement();
    }
    /** @override component has been disconnected from the DOM */
    disconnectedCallback() {
      if (this.__connected) {
        this.__isInDOM = false;
        Promise.resolve().then(() => {
          if (!this.__isInDOM) {
            this.onDisconnected();
            this.__disconnected = true;
            for (const hook of this.hooks) {
              if (hook?.cleanupFunction)
                hook.cleanupFunction();
            }
          } else {
            this._$hasBeenMoved = true;
            if (this._$usesContext)
              this.requestRender();
          }
        });
      }
    }
    /**
     * This public callback will be used when a component is removed permanently from the DOM.
     * It allows other code to hook into the component and unmount listeners or similar when the
     * component is disconnected from the DOM.
     */
    onDisconnected() {
    }
    /**
     * Initializes the component with the state, props, and styles.
     */
    __initElement() {
      this.__ROOT = this;
      this.props = {
        ...this.props,
        ...this._$initialProps,
        styles
      };
      const componentAttributes = this.getAttributeNames();
      for (const attrName of componentAttributes) {
        let propName = attrName;
        if (propName.includes("-"))
          propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
        if (!this.props.hasOwnProperty(propName)) {
          const attrValue = this.getAttribute(attrName);
          this.props[propName] = attrValue === "" ? true : attrValue;
        }
      }
      const initialPropsKeys = Object.keys(this._$initialProps);
      for (const key of initialPropsKeys) {
        const prop = this._$initialProps[key];
        if (prop !== Object(prop) && (prop || prop === 0) && key !== "title") {
          this.setAttribute(
            key.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`),
            prop.toString()
          );
        }
      }
      if (DEV_MODE && this.props.wcPerf)
        this._$measurePerf = true;
      if (DEV_MODE && this._$measurePerf)
        console.time("First render " + options.name);
      const childNodes = this.__ROOT.childNodes;
      const childrenArray = [];
      while (childNodes.length) {
        childrenArray.push(childNodes[0]);
        childNodes[0].remove();
      }
      const children = new WompoChildren(childrenArray);
      this.props.children = children;
      if (options.shadow && !this.shadowRoot)
        this.__ROOT = this.attachShadow({ mode: "open" });
      if (options.shadow) {
        this.__ROOT.adoptedStyleSheets = [sheet];
      } else {
        const root = this.getRootNode();
        root.adoptedStyleSheets.push(sheet);
      }
      this.__render();
      this.__isInitializing = false;
      this.__connected = true;
      new MutationObserver((mutationRecords) => {
        if (!this.__updating) {
          mutationRecords.forEach((record) => {
            if (!mutationAttributesExclusions.includes(record.attributeName)) {
              let propName = record.attributeName;
              if (propName.includes("-"))
                propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
              this.updateProp(propName, this.getAttribute(record.attributeName));
            }
          });
        }
      }).observe(this, { attributes: true });
      if (DEV_MODE && this._$measurePerf)
        console.timeEnd("First render " + options.name);
    }
    /**
     * Calls the functional component by first setting correct values to the
     * [currentRenderingComponent] and [currentHookIndex] variables.
     * @returns The result of the call.
     */
    __callComponent() {
      currentRenderingComponent = this;
      currentHookIndex = 0;
      const result = Component.call(this, this.props);
      let renderHtml = result;
      if (typeof result === "string" || result instanceof HTMLElement)
        renderHtml = html`${result}`;
      return renderHtml;
    }
    /**
     * Calls the component and executes the operations to update the DOM.
     */
    __render() {
      try {
        const renderHtml = this.__callComponent();
        if (renderHtml === null || renderHtml === void 0) {
          this.__dynamics = [];
          this.__oldValues = [];
          this.remove();
          return;
        }
        const constructor = this.constructor;
        if (this.__isInitializing) {
          const template = constructor._$getOrCreateTemplate(renderHtml);
          const [fragment, dynamics] = template.clone();
          this.__dynamics = dynamics;
          const elaboratedValues = __setValues(
            this.__dynamics,
            renderHtml.values,
            this.__oldValues
          );
          this.__oldValues = elaboratedValues;
          if (!this.__isInitializing)
            this.__ROOT.innerHTML = "";
          while (fragment.childNodes.length) {
            this.__ROOT.appendChild(fragment.childNodes[0]);
          }
        } else {
          const oldValues = __setValues(this.__dynamics, renderHtml.values, this.__oldValues);
          this.__oldValues = oldValues;
        }
        while (this._$layoutEffects.length) {
          const layoutEffectHook = this._$layoutEffects.pop();
          layoutEffectHook.cleanupFunction = layoutEffectHook.callback();
        }
      } catch (err) {
        console.error(err);
        if (DEV_MODE) {
          const error = new WompoError.class();
          error.props.error = err;
          error.props.element = this;
          this.__ROOT.innerHTML = "";
          this.__ROOT.appendChild(error);
        }
      }
    }
    /**
     * It requests a render to the component. If the component has already received a render
     * request, the request will be rejected. This is to avoid multiple re-renders when it's not
     * necessary. The following function will cause a single re-render:
     * ```javascript
     * const incBy2 = () => {
     *   setState((oldState) => oldState + 1)
     *   setState((oldState) => oldState + 1)
     * }
     * ```
     */
    requestRender() {
      if (!this.__updating) {
        this.__updating = true;
        Promise.resolve().then(() => {
          if (DEV_MODE && this._$measurePerf)
            console.time("Re-render " + options.name);
          this.__render();
          this.__updating = false;
          this._$hasBeenMoved = false;
          if (DEV_MODE && this._$measurePerf)
            console.timeEnd("Re-render " + options.name);
        });
      }
    }
    /**
     * It'll set a new value to a specific prop of the component, and a re-render will be requested.
     * @param prop The prop name.
     * @param value The new value to set.
     */
    updateProp(prop, value) {
      if (this.props[prop] !== value) {
        this.props[prop] = value;
        if (!this.__isInitializing) {
          this.requestRender();
        }
      }
    }
  };
  return WompoComponent;
};
export const useHook = () => {
  const currentComponent = currentRenderingComponent;
  const currentIndex = currentHookIndex;
  const res = [currentComponent, currentIndex];
  currentHookIndex++;
  return res;
};
export const useState = (initialState) => {
  const [component, hookIndex] = useHook();
  if (!component) {
    if (typeof initialState === "function")
      return [initialState(), () => {
      }];
    return [initialState, () => {
    }];
  }
  if (!component.hooks.hasOwnProperty(hookIndex)) {
    const index = hookIndex;
    component.hooks[index] = [
      typeof initialState === "function" ? initialState() : initialState,
      (newValue) => {
        let computedValue = newValue;
        const stateHook = component.hooks[index];
        if (typeof newValue === "function") {
          computedValue = newValue(stateHook[0]);
        }
        if (computedValue !== stateHook[0]) {
          stateHook[0] = computedValue;
          component.requestRender();
        }
      }
    ];
  }
  const state = component.hooks[hookIndex];
  return state;
};
export const useEffect = (callback, dependencies = null) => {
  const [component, hookIndex] = useHook();
  if (!component.hooks.hasOwnProperty(hookIndex)) {
    const effectHook = {
      dependencies,
      callback,
      cleanupFunction: null
    };
    component.hooks[hookIndex] = effectHook;
    Promise.resolve().then(() => {
      effectHook.cleanupFunction = callback();
    });
  } else {
    const componentEffect = component.hooks[hookIndex];
    if (dependencies !== null) {
      for (let i = 0; i < dependencies.length; i++) {
        const oldDep = componentEffect.dependencies[i];
        if (oldDep !== dependencies[i]) {
          if (typeof componentEffect.cleanupFunction === "function")
            componentEffect.cleanupFunction();
          Promise.resolve().then(() => {
            componentEffect.cleanupFunction = callback();
            componentEffect.dependencies = dependencies;
          });
          break;
        }
      }
    } else {
      Promise.resolve().then(() => {
        componentEffect.cleanupFunction = callback();
        componentEffect.dependencies = dependencies;
      });
    }
  }
};
export const useLayoutEffect = (callback, dependencies = null) => {
  const [component, hookIndex] = useHook();
  if (!component.hooks.hasOwnProperty(hookIndex)) {
    const effectHook = {
      dependencies,
      callback,
      cleanupFunction: null
    };
    component.hooks[hookIndex] = effectHook;
    component._$layoutEffects.push(effectHook);
  } else {
    const effectHook = component.hooks[hookIndex];
    if (dependencies !== null) {
      for (let i = 0; i < dependencies.length; i++) {
        const oldDep = effectHook.dependencies[i];
        if (oldDep !== dependencies[i]) {
          if (typeof effectHook.cleanupFunction === "function")
            effectHook.cleanupFunction();
          effectHook.dependencies = dependencies;
          effectHook.callback = callback;
          component._$layoutEffects.push(effectHook);
          break;
        }
      }
    } else {
      component._$layoutEffects.push(effectHook);
    }
  }
};
export const useRef = (initialValue = null) => {
  const [component, hookIndex] = useHook();
  if (!component.hooks.hasOwnProperty(hookIndex)) {
    component.hooks[hookIndex] = {
      current: initialValue,
      __wcRef: true
    };
  }
  const ref = component.hooks[hookIndex];
  return ref;
};
export const useCallback = (callbackFn, dependencies = []) => {
  const [component, hookIndex] = useHook();
  if (!component.hooks.hasOwnProperty(hookIndex)) {
    component.hooks[hookIndex] = {
      dependencies,
      value: callbackFn
    };
  } else {
    const callbackHook = component.hooks[hookIndex];
    for (let i = 0; i < dependencies.length; i++) {
      const oldDep = callbackHook.dependencies[i];
      if (oldDep !== dependencies[i]) {
        callbackHook.dependencies = dependencies;
        callbackHook.value = callbackFn;
        break;
      }
    }
  }
  const callback = component.hooks[hookIndex];
  return callback.value;
};
const useIdMemo = () => {
  let counter = 0;
  return () => {
    const [component, hookIndex] = useHook();
    if (!component.hooks.hasOwnProperty(hookIndex)) {
      component.hooks[hookIndex] = `:w${counter}:`;
      counter++;
    }
    const callback = component.hooks[hookIndex];
    return callback;
  };
};
export const useId = useIdMemo();
export const useMemo = (callbackFn, dependencies) => {
  const [component, hookIndex] = useHook();
  if (!component.hooks.hasOwnProperty(hookIndex)) {
    component.hooks[hookIndex] = {
      value: callbackFn(),
      dependencies
    };
  } else {
    const oldMemo = component.hooks[hookIndex];
    for (let i = 0; i < dependencies.length; i++) {
      const oldDep = oldMemo.dependencies[i];
      if (oldDep !== dependencies[i]) {
        oldMemo.dependencies = dependencies;
        oldMemo.value = callbackFn();
        break;
      }
    }
  }
  const memoizedResult = component.hooks[hookIndex];
  return memoizedResult.value;
};
export const useReducer = (reducer, initialState) => {
  const [component, hookIndex] = useHook();
  const index = hookIndex;
  if (!component.hooks.hasOwnProperty(index)) {
    const dispatch = (action) => {
      const currentState = component.hooks[index][0];
      const partialState = reducer(currentState, action);
      let newState = partialState;
      if (typeof currentState === "object" && !Array.isArray(currentState) && currentState !== null) {
        newState = {
          ...currentState,
          ...partialState
        };
      }
      component.hooks[hookIndex][0] = newState;
      if (newState !== currentState)
        component.requestRender();
    };
    const reducerHook = [initialState, dispatch];
    component.hooks[hookIndex] = reducerHook;
  }
  const stateAndReducer = component.hooks[hookIndex];
  return stateAndReducer;
};
export const useExposed = (toExpose) => {
  const component = currentRenderingComponent;
  const keys = Object.keys(toExpose);
  for (const key of keys) {
    component[key] = toExpose[key];
  }
};
const executeUseAsyncCallback = (hook, suspense, callback) => {
  const [component, hookIndex] = hook;
  if (suspense) {
    suspense.addSuspense(component);
  }
  component.hooks[hookIndex].value = null;
  const promise = callback();
  promise.then((data) => {
    component.requestRender();
    suspense?.removeSuspense(component);
    component.hooks[hookIndex].value = data;
  }).catch((err) => console.error(err));
};
export const useAsync = (callback, dependencies) => {
  const [component, hookIndex] = useHook();
  const suspense = findSuspense(component);
  if (!component.hooks.hasOwnProperty(hookIndex)) {
    component.hooks[hookIndex] = {
      dependencies,
      value: null
    };
    executeUseAsyncCallback([component, hookIndex], suspense, callback);
  } else {
    const oldAsync = component.hooks[hookIndex];
    let newCall = false;
    for (let i = 0; i < dependencies.length; i++) {
      const oldDep = oldAsync.dependencies[i];
      if (oldDep !== dependencies[i]) {
        oldAsync.dependencies = dependencies;
        newCall = true;
        break;
      }
    }
    if (newCall) {
      executeUseAsyncCallback([component, hookIndex], suspense, callback);
    }
  }
  return component.hooks[hookIndex].value;
};
const createContextMemo = () => {
  let contextIdentifier = 0;
  return (initialValue, providerName) => {
    const name = providerName ?? `wompo-context-provider-${contextIdentifier}`;
    contextIdentifier++;
    const ProviderFunction = defineWompo(
      ({ children, value }) => {
        const initialSubscribers = /* @__PURE__ */ new Set();
        const subscribers = useRef(initialSubscribers);
        useExposed({ subscribers });
        subscribers.current.forEach((el) => {
          if (el.isConnected)
            el.requestRender();
        });
        return html`${children}`;
      },
      {
        name,
        cssModule: false
      }
    );
    const Context = {
      name,
      Provider: ProviderFunction,
      default: initialValue,
      subscribers: /* @__PURE__ */ new Set()
    };
    return Context;
  };
};
export const createContext = createContextMemo();
export const useContext = (Context) => {
  const [component, hookIndex] = useHook();
  component._$usesContext = true;
  if (!component.hooks.hasOwnProperty(hookIndex) || component._$hasBeenMoved) {
    let parent = component;
    const toFind = Context.name.toUpperCase();
    while (parent && parent.nodeName !== toFind && parent !== document.body) {
      if (parent instanceof ShadowRoot)
        parent = parent.host;
      else
        parent = parent.parentNode;
    }
    const oldParent = component.hooks[hookIndex]?.node;
    if (parent && parent !== document.body) {
      Promise.resolve().then(() => {
        parent.subscribers.current.add(component);
        const oldDisconnect = component.onDisconnected;
        component.onDisconnected = () => {
          parent.subscribers.current.delete(component);
          oldDisconnect();
        };
      });
    } else if (oldParent) {
      if (DEV_MODE) {
        console.warn(
          `The element ${component.tagName} doens't have access to the Context ${Context.name} because is no longer a child of it.`
        );
      }
      parent = null;
      oldParent.subscribers.current.delete(component);
    } else if (component.isConnected) {
      console.warn(
        `The element ${component.tagName} doens't have access to the Context ${Context.name}. The default value will be returned instead.`
      );
      parent = null;
    }
    component.hooks[hookIndex] = {
      node: parent
    };
  }
  const contextNode = component.hooks[hookIndex].node;
  return contextNode ? contextNode.props.value : Context.default;
};
export function html(templateParts, ...values) {
  const cleanValues = [];
  const length = templateParts.length - 1;
  for (let i = 0; i < length; i++) {
    if (!templateParts[i].endsWith("</"))
      cleanValues.push(values[i]);
  }
  return {
    parts: templateParts,
    values: cleanValues,
    _$wompoHtml: true
  };
}
export const wompoDefaultOptions = {
  shadow: false,
  name: "",
  cssModule: true
};
export const registeredComponents = {};
export function defineWompo(Component, options) {
  if (!Component.css)
    Component.css = "";
  const componentOptions = {
    ...wompoDefaultOptions,
    ...options || {}
  };
  if (!componentOptions.name) {
    let newName = Component.name.replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`).toLowerCase();
    if (!newName.includes("-"))
      newName += "-wompo";
    componentOptions.name = newName;
  }
  Component.componentName = componentOptions.name;
  Component._$wompoF = true;
  const [generatedCSS, styles] = __generateSpecifcStyles(Component, componentOptions);
  Component.css = generatedCSS;
  Component.options = {
    generatedCSS,
    styles,
    shadow: componentOptions.shadow
  };
  if (!IS_SERVER) {
    const ComponentClass = _$wompo(Component, componentOptions);
    Component.class = ComponentClass;
    customElements.define(componentOptions.name, ComponentClass);
  } else {
    Component.class = class {
      constructor(props) {
        this.props = props;
        if (this.props.childNodes) {
          this.childNodes = this.props.childNodes;
        } else {
          this.childNodes = [];
        }
      }
    };
  }
  registeredComponents[componentOptions.name] = Component;
  return Component;
}
export const lazy = (load) => {
  let loaded = null;
  async function LazyComponent() {
    if (!loaded) {
      try {
        const importedModule = await load();
        loaded = importedModule.default;
        return loaded;
      } catch (err) {
        console.error(err);
        return WompoError;
      }
    }
    return loaded;
  }
  LazyComponent._$wompoLazy = true;
  return LazyComponent;
};
const findSuspense = (startNode) => {
  let suspense = startNode;
  while (suspense && suspense.nodeName !== Suspense.componentName.toUpperCase()) {
    if (suspense.parentNode === null && suspense.host)
      suspense = suspense.host;
    else
      suspense = suspense?.parentNode;
  }
  return suspense;
};
let WompoError;
if (DEV_MODE) {
  WompoError = function({ styles: s, error, element }) {
    let content;
    if (element && error) {
      content = html`<div>
				<p>An error rised while rendering the element "${element.nodeName.toLowerCase()}".</p>
				<p>${error.stack.split("\n").map((row) => html`${row}<br />`)}</p>
			</div>`;
    } else {
      content = html`<div>
				<p>An error rised while rendering. Check the developer console for more details.</p>
			</div>`;
    }
    return html`${content}`;
  };
  WompoError.css = `
		:host {
			display: block;
			padding: 20px;
			background-color: #ffd0cf;
			color: #a44040;
			margin: 20px;
			border-left: 3px solid #a44040;
		}
	`;
  defineWompo(WompoError, { name: "wompo-error", shadow: true });
}
export function Suspense({ children, fallback }) {
  if (!this.loadingComponents) {
    this.loadingComponents = useRef(/* @__PURE__ */ new Set()).current;
  }
  this.addSuspense = (node) => {
    if (!this.loadingComponents.size)
      this.requestRender();
    this.loadingComponents.add(node);
  };
  this.removeSuspense = (node, newNode = null) => {
    this.loadingComponents.delete(node);
    if (newNode) {
      for (let i = 0; i < children.nodes.length; i++) {
        if (children.nodes[i] === node) {
          children.nodes[i] = newNode;
          break;
        }
      }
    }
    if (!this.loadingComponents.size)
      this.requestRender();
  };
  if (this.loadingComponents.size)
    return html`${fallback}`;
  return html`${children}`;
}
defineWompo(Suspense, {
  name: "wompo-suspense"
});
//# sourceMappingURL=wompo.js.map
