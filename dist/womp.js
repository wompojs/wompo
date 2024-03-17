const DEV_MODE = true;
let currentRenderingComponent = null;
let currentHookIndex = 0;
const WC_MARKER = "$wc$";
const DYNAMIC_TAG_MARKER = "wc-wc";
const isDynamicTagRegex = /<\/?$/g;
const isAttrRegex = /\s+([^\s]*?)="?$/g;
const selfClosingRegex = /(<([a-x]*?-[a-z]*).*?)\/>/g;
const isInsideTextTag = /<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi;
const onlyTextChildrenElementsRegex = /^(?:script|style|textarea|title)$/i;
const NODE = 0;
const ATTR = 1;
const TAG = 2;
const IS_SERVER = typeof global !== void 0;
const doc = IS_SERVER ? { createTreeWalker() {
} } : document;
const treeWalker = doc.createTreeWalker(
  doc,
  129
  // NodeFilter.SHOW_{ELEMENT|COMMENT}
);
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
  constructor(stringifiedTemplate, values, template) {
    this.stringifiedTemplate = stringifiedTemplate;
    this.values = values;
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
    while (currentNode !== this.endNode) {
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
      if (this.node._$womp) {
        const oldDisconnectedCallback = this.node.onDisconnected;
        this.node.onDisconnected = () => {
          newValue.current = null;
          oldDisconnectedCallback();
        };
      }
      return;
    }
    if (DEV_MODE && this.name === "wc-perf") {
      this.node._$measurePerf = true;
    }
    const isWompElement = this.node._$womp;
    if (isWompElement)
      this.node.updateProps(this.name, newValue);
    const isPrimitive = newValue !== Object(newValue);
    if (newValue === false)
      this.node.removeAttribute(this.name);
    else if (isPrimitive && !this.name.match(/[A-Z]/))
      this.node.setAttribute(this.name, newValue);
    else if (this.name === "style") {
      let styleString = "";
      const styles = Object.keys(newValue);
      for (const key of styles) {
        let styleValue = newValue[key];
        let styleKey = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
        if (typeof styleValue === "number")
          styleValue = `${styleValue}px`;
        styleString += `${styleKey}:${styleValue};`;
      }
      this.node.setAttribute(this.name, styleString);
    }
    if (this.name === "title" && isWompElement)
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
class WompChildren {
  constructor(nodes) {
    this._$wompChildren = true;
    this.nodes = nodes;
  }
}
class WompArrayDependency {
  /**
   * Creates a new WompArrayDependency instance.
   * @param values The array of values to put in the DOM
   * @param dependency The dynamic node dependency on which the array should be rendered.
   */
  constructor(values, dependency) {
    this.isArrayDependency = true;
    this.dynamics = [];
    this.__parentDependency = dependency;
    this.addDependenciesFrom(dependency.startNode, values.length);
    this.__oldValues = __setValues(this.dynamics, values, []);
  }
  /**
   * This function will add markers (HTML comments) and generate dynamic nodes dependecies used to
   * efficiently udpate the values inside of the array.
   * @param startNode The start node on which insert the new "single-item" dependencies.
   * @param toAdd The number of dependencies to generate.
   */
  addDependenciesFrom(startNode, toAdd) {
    let currentNode = startNode;
    let toAddNumber = toAdd;
    while (toAddNumber) {
      const startComment = document.createComment(`?START`);
      const endComment = document.createComment(`?END`);
      currentNode.after(startComment);
      startComment.after(endComment);
      const dependency = new DynamicNode(startComment, endComment);
      currentNode = endComment;
      this.dynamics.push(dependency);
      toAddNumber--;
    }
  }
  /**
   * Check if there are dependencies to add/remove, and then set the new values to the old nodes.
   * Setting the new values will start an eventual recursive check for eventual nested arrays.
   * @param newValues The new values to check with the old ones fot updates.
   * @returns This instance.
   */
  checkUpdates(newValues) {
    let diff = newValues.length - this.__oldValues.length;
    if (diff > 0) {
      let startNode = this.dynamics[this.dynamics.length - 1]?.endNode;
      if (!startNode)
        startNode = this.__parentDependency.startNode;
      this.addDependenciesFrom(startNode, diff);
    } else if (diff < 0) {
      while (diff) {
        const toClean = this.dynamics.pop();
        toClean.dispose();
        diff++;
      }
    }
    this.__oldValues = __setValues(this.dynamics, newValues, this.__oldValues);
    return this;
  }
}
const __generateSpecifcStyles = (component, options) => {
  const { css } = component;
  const { shadow, name, cssGeneration } = options;
  const componentName = name;
  const classes = {};
  let generatedCss = css;
  if (DEV_MODE) {
    if (!shadow && !cssGeneration && !name.startsWith("womp-context-provider"))
      console.warn(
        `The component ${name} is not an isolated component (shadow=false) and has the cssGeneration option set to false.
This can lead to unexpected behaviors, because this component can alter other components' styles.`
      );
  }
  if (cssGeneration) {
    if (!css.includes(":host"))
      generatedCss = `${shadow ? ":host" : componentName} {display:block;} ${css}`;
    if (DEV_MODE) {
      const invalidSelectors = [];
      [...generatedCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
        const cssSelector = selector[1].trim();
        if (!cssSelector.includes("."))
          invalidSelectors.push(cssSelector);
      });
      invalidSelectors.forEach((selector) => {
        console.warn(
          `The CSS selector "${selector} {...}" in the component "${componentName}" is not enough specific: include at least one class.`
        );
      });
    }
    if (!shadow)
      generatedCss = generatedCss.replace(/:host/g, componentName);
    generatedCss = generatedCss.replace(/\.(?!\d)(.*?)[\s|{|,|+|~|>]/gm, (_, className) => {
      const uniqueClassName = `${componentName}__${className}`;
      classes[className] = uniqueClassName;
      return `.${uniqueClassName} `;
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
        attrDelimiter = beforeLastChar === '"' || beforeLastChar === "'" ? beforeLastChar : "";
        part = part.substring(0, part.length - attrDelimiter.length - 1);
        let toAdd = `${part}${WC_MARKER}=`;
        if (attrDelimiter)
          toAdd += `${attrDelimiter}${WC_MARKER}`;
        else
          toAdd += '"0"';
        html2 += toAdd;
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
  html2 = html2.replace(selfClosingRegex, "$1></$2>");
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
const __createTemplate = (parts) => {
  const [dom, attributes] = __createHtml(parts);
  const template = document.createElement("template");
  template.innerHTML = dom;
  const dependencies = __createDependencies(template, parts, attributes);
  return new CachedTemplate(template, dependencies);
};
const __getRenderHtmlString = (render) => {
  let value = "";
  const { parts, values } = render;
  for (let i = 0; i < parts.length; i++) {
    value += parts[i];
    if (values[i]?.componentName)
      value += values[i].componentName;
  }
  return value;
};
const __shouldUpdate = (currentValue, oldValue, dependency) => {
  const valuesDiffers = currentValue !== oldValue;
  const isComposedAttribute = !!dependency.attrStructure;
  const isWompChildren = currentValue?._$wompChildren;
  const childrenNeedUpdate = isWompChildren && dependency.startNode.nextSibling !== currentValue.nodes[0];
  return valuesDiffers || isComposedAttribute || childrenNeedUpdate;
};
const __setValues = (dynamics, values, oldValues) => {
  const newValues = [...values];
  for (let i = 0; i < dynamics.length; i++) {
    const currentDependency = dynamics[i];
    const currentValue = newValues[i];
    const oldValue = oldValues[i];
    if (!__shouldUpdate(currentValue, oldValue, currentDependency))
      continue;
    if (currentDependency.isNode) {
      if (currentValue === false) {
        currentDependency.clearValue();
        continue;
      }
      if (currentValue?._$wompHtml) {
        const oldStringified = oldValue?.stringifiedTemplate;
        const newTemplate = __getRenderHtmlString(currentValue);
        const sameString = newTemplate === oldStringified;
        if (oldValue === void 0 || !sameString) {
          const cachedTemplate = __createTemplate(currentValue.parts);
          const template = cachedTemplate.clone();
          const [fragment, dynamics2] = template;
          newValues[i] = new HtmlProcessedValue(newTemplate, currentValue.values, template);
          __setValues(dynamics2, currentValue.values, oldValue?.values ?? oldValue ?? []);
          const endNode = currentDependency.endNode;
          const startNode2 = currentDependency.startNode;
          let currentNode = startNode2.nextSibling;
          while (currentNode !== endNode) {
            currentNode.remove();
            currentNode = startNode2.nextSibling;
          }
          currentNode = startNode2;
          while (fragment.childNodes.length) {
            currentNode.after(fragment.childNodes[0]);
            currentNode = currentNode.nextSibling;
          }
        } else {
          const [_, dynamics2] = oldValue.template;
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
        if (currentValue._$wompChildren) {
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
              newValues[i] = new WompArrayDependency(currentValue, currentDependency);
            } else
              newValues[i] = oldValue.checkUpdates(currentValue);
          } else if (DEV_MODE) {
            console.warn(
              "Rendering objects is not supported. Doing a stringified version of it can rise errors.\nThis node will be ignored."
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
            parts[j] = `${parts[j]}${dynamicValue}`;
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
      const node = currentDependency.node;
      let customElement = null;
      const isCustomComponent = currentValue._$wompF;
      const newNodeName = isCustomComponent ? currentValue.componentName : currentValue;
      if (node.nodeName !== newNodeName.toUpperCase()) {
        const oldAttributes = node.getAttributeNames();
        if (isCustomComponent) {
          if (DEV_MODE) {
            if (node._$womp) {
              console.error(
                "Dynamic tags are currently not supported, unsless used to render for the first time a custom component.\nInstead, you can use conditional rendering.\n(e.g. condition ? html`<${First} />` : html`<${Second} />`)."
              );
              continue;
            }
          }
          const initialProps = {};
          for (const attrName of oldAttributes) {
            const attrValue = node.getAttribute(attrName);
            initialProps[attrName] = attrValue === "" ? true : attrValue;
          }
          customElement = new currentValue.class();
          customElement._$initialProps = initialProps;
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
        let index = i;
        let currentDynamic = dynamics[index];
        while (currentDynamic?.node === node) {
          currentDynamic.node = customElement;
          currentDynamic = dynamics[++index];
          if (currentDynamic?.name && currentDynamic?.name !== "ref")
            customElement._$initialProps[currentDynamic.name] = values[index];
        }
        node.replaceWith(customElement);
      }
    }
  }
  return newValues;
};
const _$womp = (Component, options) => {
  const { generatedCSS, styles } = Component.options;
  const style = document.createElement("style");
  const styleClassName = `${options.name}__styles`;
  if (generatedCSS) {
    style.classList.add(styleClassName);
    style.textContent = generatedCSS;
    if (!options.shadow) {
      document.body.appendChild(style);
    }
  }
  const WompComponent = class extends HTMLElement {
    constructor() {
      super();
      this._$womp = true;
      // For faster access
      this.props = {};
      this._$hooks = [];
      this._$measurePerf = false;
      this._$initialProps = {};
      this._$usesContext = false;
      this._$hasBeenMoved = false;
      /** It'll be true if the component has already processing an update. */
      this.__updating = false;
      /** The array containing the dynamic values of the last render. */
      this.__oldValues = [];
      /** It'll be true if the component is currently initializing. */
      this.__isInitializing = true;
      /** It's true if the component is connected to the DOM. */
      this.__connected = false;
      /**
       * Used to know if a component has been completely removed from the DOM or only temporarely to
       * move it from a node to another.
       */
      this.__isInDOM = false;
    }
    static {
      this._$womp = true;
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
    static _$getOrCreateTemplate(parts) {
      if (!this._$cachedTemplate)
        this._$cachedTemplate = __createTemplate(parts);
      return this._$cachedTemplate;
    }
    /** @override component has been connected to the DOM */
    connectedCallback() {
      this.__isInDOM = true;
      if (!this.__connected && this.isConnected)
        this.initElement();
    }
    /** @override component has been disconnected from the DOM */
    disconnectedCallback() {
      if (this.__connected) {
        this.__isInDOM = false;
        Promise.resolve().then(() => {
          if (!this.__isInDOM) {
            this.onDisconnected();
            if (DEV_MODE)
              console.warn("Disconnected", this);
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
    initElement() {
      this.__ROOT = this;
      this.props = {
        ...this.props,
        ...this._$initialProps,
        styles
      };
      const componentAttributes = this.getAttributeNames();
      for (const attrName of componentAttributes) {
        if (!this.props.hasOwnProperty(attrName)) {
          const attrValue = this.getAttribute(attrName);
          this.props[attrName] = attrValue === "" ? true : attrValue;
        }
        if (DEV_MODE && attrName === "wc-perf") {
          this._$measurePerf = true;
        }
      }
      if (DEV_MODE && this.props["wc-perf"]) {
        this._$measurePerf = true;
      }
      if (DEV_MODE && this._$measurePerf)
        console.time("First render " + options.name);
      const childNodes = this.__ROOT.childNodes;
      const childrenArray = [];
      while (childNodes.length) {
        childrenArray.push(childNodes[0]);
        childNodes[0].remove();
      }
      const children = new WompChildren(childrenArray);
      this.props.children = children;
      if (options.shadow)
        this.__ROOT = this.attachShadow({ mode: "open" });
      const root = this.getRootNode();
      if ((options.shadow || root !== document.body) && !root.querySelector(`.${styleClassName}`)) {
        const clonedStyles = style.cloneNode(true);
        this.__ROOT.appendChild(clonedStyles);
      }
      const renderHtml = this.__callComponent();
      const { values, parts } = renderHtml;
      const template = this.constructor._$getOrCreateTemplate(parts);
      const [fragment, dynamics] = template.clone();
      this.__dynamics = dynamics;
      const elaboratedValues = __setValues(this.__dynamics, values, this.__oldValues);
      this.__oldValues = elaboratedValues;
      while (fragment.childNodes.length) {
        this.__ROOT.appendChild(fragment.childNodes[0]);
      }
      this.__isInitializing = false;
      this.__connected = true;
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
          const renderHtml = this.__callComponent();
          const oldValues = __setValues(this.__dynamics, renderHtml.values, this.__oldValues);
          this.__oldValues = oldValues;
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
    updateProps(prop, value) {
      if (this.props[prop] !== value) {
        this.props[prop] = value;
        if (!this.__isInitializing) {
          console.warn(`Updating ${prop}`, this.__isInitializing);
          this.requestRender();
        }
      }
    }
  };
  return WompComponent;
};
export const useHook = () => {
  const currentComponent = currentRenderingComponent;
  const currentIndex = currentHookIndex;
  const res = [currentComponent, currentIndex];
  currentHookIndex++;
  return res;
};
export const useState = (defaultValue) => {
  const [component, hookIndex] = useHook();
  if (IS_SERVER) {
    component._$front = true;
    return [defaultValue, () => {
    }];
  }
  if (!component._$hooks.hasOwnProperty(hookIndex)) {
    const index = hookIndex;
    component._$hooks[index] = [
      defaultValue,
      (newValue) => {
        let computedValue = newValue;
        const stateHook = component._$hooks[index];
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
  const state = component._$hooks[hookIndex];
  return state;
};
export const useEffect = (callback, dependencies) => {
  const [component, hookIndex] = useHook();
  if (!component._$hooks.hasOwnProperty(hookIndex)) {
    const effectHook = {
      dependencies,
      callback,
      cleanupFunction: null
    };
    component._$hooks[hookIndex] = effectHook;
    Promise.resolve().then(() => {
      effectHook.cleanupFunction = callback();
    });
  } else {
    const componentEffect = component._$hooks[hookIndex];
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
  }
};
export const useLayoutEffect = (callback, dependencies) => {
  const [component, hookIndex] = useHook();
  if (!component._$hooks.hasOwnProperty(hookIndex)) {
    const effectHook = {
      dependencies,
      callback,
      cleanupFunction: null
    };
    component._$hooks[hookIndex] = effectHook;
    effectHook.cleanupFunction = callback();
  } else {
    const componentEffect = component._$hooks[hookIndex];
    for (let i = 0; i < dependencies.length; i++) {
      const oldDep = componentEffect.dependencies[i];
      if (oldDep !== dependencies[i]) {
        if (typeof componentEffect.cleanupFunction === "function")
          componentEffect.cleanupFunction();
        componentEffect.cleanupFunction = callback();
        componentEffect.dependencies = dependencies;
        break;
      }
    }
  }
};
export const useRef = (initialValue = null) => {
  const [component, hookIndex] = useHook();
  if (!component._$hooks.hasOwnProperty(hookIndex)) {
    component._$hooks[hookIndex] = {
      current: initialValue,
      __wcRef: true
    };
  }
  const ref = component._$hooks[hookIndex];
  return ref;
};
export const useCallback = (callbackFn) => {
  const [component, hookIndex] = useHook();
  if (!component._$hooks.hasOwnProperty(hookIndex)) {
    component._$hooks[hookIndex] = callbackFn;
  }
  const callback = component._$hooks[hookIndex];
  return callback;
};
const useIdMemo = () => {
  let counter = 0;
  return () => {
    const [component, hookIndex] = useHook();
    if (!component._$hooks.hasOwnProperty(hookIndex)) {
      component._$hooks[hookIndex] = `:r${counter}:`;
      counter++;
    }
    const callback = component._$hooks[hookIndex];
    return callback;
  };
};
export const useId = useIdMemo();
export const useMemo = (callbackFn, dependencies) => {
  const [component, hookIndex] = useHook();
  if (!component._$hooks.hasOwnProperty(hookIndex)) {
    component._$hooks[hookIndex] = {
      value: callbackFn(),
      dependencies
    };
  } else {
    const oldMemo = component._$hooks[hookIndex];
    for (let i = 0; i < dependencies.length; i++) {
      const oldDep = oldMemo.dependencies[i];
      if (oldDep !== dependencies[i]) {
        oldMemo.dependencies = dependencies;
        oldMemo.value = callbackFn();
        break;
      }
    }
  }
  const memoizedResult = component._$hooks[hookIndex];
  return memoizedResult.value;
};
export const useReducer = (reducer, initialState) => {
  const [component, hookIndex] = useHook();
  const index = hookIndex;
  if (!component._$hooks.hasOwnProperty(index)) {
    const dispatch = (action) => {
      const currentState = component._$hooks[index][0];
      const partialState = reducer(currentState, action);
      const keys = Object.keys(partialState);
      for (const key of keys) {
        if (partialState[key] !== currentState[key]) {
          component.requestRender();
          break;
        }
      }
      const newState = {
        ...currentState,
        ...partialState
      };
      component._$hooks[hookIndex][0] = newState;
    };
    const reducerHook = [initialState, dispatch];
    component._$hooks[hookIndex] = reducerHook;
  }
  const stateAndReducer = component._$hooks[hookIndex];
  return stateAndReducer;
};
export const useExposed = (toExpose) => {
  const component = currentRenderingComponent;
  const keys = Object.keys(toExpose);
  for (const key of keys) {
    component[key] = toExpose[key];
  }
};
const createContextMemo = () => {
  let contextIdentifier = 0;
  return (initialValue) => {
    const name = `womp-context-provider-${contextIdentifier}`;
    contextIdentifier++;
    const ProviderFunction = defineWomp(
      ({ children }) => {
        const initialSubscribers = /* @__PURE__ */ new Set();
        const subscribers = useRef(initialSubscribers);
        useExposed({ subscribers });
        subscribers.current.forEach((el) => el.requestRender());
        return html`${children}`;
      },
      {
        name,
        cssGeneration: false
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
  if (!component._$hooks.hasOwnProperty(hookIndex) || component._$hasBeenMoved) {
    let parent = component;
    const toFind = Context.name.toUpperCase();
    while (parent && parent.nodeName !== toFind && parent !== document.body) {
      if (parent instanceof ShadowRoot)
        parent = parent.host;
      else
        parent = parent.parentNode;
    }
    const oldParent = component._$hooks[hookIndex]?.node;
    if (parent && parent !== document.body) {
      parent.subscribers.current.add(component);
      const oldDisconnect = component.onDisconnected;
      component.onDisconnected = () => {
        parent.subscribers.current.delete(component);
        oldDisconnect();
      };
    } else if (oldParent) {
      if (DEV_MODE) {
        console.warn(
          `The element ${component.tagName} doens't have access to the Context ${Context.name} because is no longer a child of it.`
        );
      }
      oldParent.subscribers.current.delete(component);
    } else if (DEV_MODE && component.isConnected) {
      console.warn(
        `The element ${component.tagName} doens't have access to the Context ${Context.name}. The default value will be returned instead.`
      );
    }
    component._$hooks[hookIndex] = {
      node: parent,
      value: parent && parent !== document.body ? parent.props.value : Context.default
    };
  }
  const contextNode = component._$hooks[hookIndex].node;
  return contextNode ? contextNode.props.value : Context.default;
};
export function html(templateParts, ...values) {
  const cleanValues = [];
  const length = templateParts.length - 1;
  if (!IS_SERVER) {
    for (let i = 0; i < length; i++) {
      if (!templateParts[i].endsWith("</"))
        cleanValues.push(values[i]);
    }
  } else {
    cleanValues.push(...values);
  }
  return {
    parts: templateParts,
    values: cleanValues,
    _$wompHtml: true
  };
}
export const wompDefaultOptions = {
  shadow: false,
  name: "",
  cssGeneration: true
};
const registeredComponents = {};
export function defineWomp(Component, options) {
  if (!Component.css)
    Component.css = "";
  const componentOptions = {
    ...wompDefaultOptions,
    ...options || {}
  };
  if (!componentOptions.name) {
    let newName = Component.name.replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`).toLowerCase();
    if (!newName.includes("-"))
      newName += "-womp";
    componentOptions.name = newName;
  }
  Component.componentName = componentOptions.name;
  Component._$wompF = true;
  const [generatedCSS, styles] = __generateSpecifcStyles(Component, componentOptions);
  Component.css = generatedCSS;
  Component.options = {
    generatedCSS,
    styles,
    shadow: componentOptions.shadow
  };
  if (!IS_SERVER) {
    const ComponentClass = _$womp(Component, componentOptions);
    Component.class = ComponentClass;
    customElements.define(componentOptions.name, ComponentClass);
  }
  registeredComponents[componentOptions.name] = Component;
  //! Save registered elements' functions, so that they can be accessed through SSR
  //! Es. registeredWomps[componentName] ? render() : skip;
  return Component;
}
export const jsx = (Element, attributes) => {
  const template = {
    parts: [],
    values: [],
    _$wompHtml: true
  };
  let tagName = Element;
  if (Element._$wompF)
    tagName = Element.componentName;
  else if (Element === Fragment)
    tagName = "";
  let staticHtml = tagName ? `<${tagName}` : "";
  const attrNames = Object.keys(attributes);
  for (const attrName of attrNames) {
    if (attrName === "children") {
      break;
    }
    const isEvent = attrName.match(/on([A-Z].*)/);
    if (isEvent) {
      staticHtml += ` @${isEvent[1].toLowerCase()}=`;
    } else {
      staticHtml += ` ${attrName}=`;
    }
    template.parts.push(staticHtml);
    template.values.push(attributes[attrName]);
    staticHtml = "";
  }
  staticHtml += tagName ? ">" : "";
  template.parts.push(staticHtml);
  const children = attributes.children;
  if (children && children.parts) {
    if (attributes.children.parts) {
      template.values.push(false);
      template.parts.push(...attributes.children.parts);
      template.values.push(...attributes.children.values);
      template.values.push(false);
    } else if (Array.isArray(attributes.children)) {
      for (const part of attributes.children) {
        template.values.push(false);
        template.parts.push(...part.parts);
        template.values.push(...part.values);
        template.values.push(false);
      }
    }
  } else {
    template.values.push(children);
  }
  staticHtml = tagName ? `</${tagName}>` : "";
  template.parts.push(staticHtml);
  return template;
};
export const Fragment = "wc-fragment";
export const ssr = (Component, props = { styles: {} }, root = true) => {
  let html2 = "";
  const { generatedCSS, styles, shadow } = Component.options;
  props.styles = styles;
  if (root)
    html2 += `<${Component.componentName}>`;
  if (shadow) {
    html2 += `<template shadowrootmode="open">`;
  }
  if (generatedCSS && (!Component.ssrStylesAttached || shadow)) {
    //! There can be repreated styles inside a shadow root.
    //! Find a way to know if a style is already present inside a shadow root
    Component.ssrStylesAttached = true;
    html2 += `<style class="${Component.componentName}__styles">${generatedCSS}</style>`;
  }
  currentRenderingComponent = Component;
  const template = Component(props);
  if (Component._$front) {
    //! Is a dynamic script
  }
  return html2 + generateSsrHtml(template, props.children) + (shadow ? "</template>" : "") + (root ? `</${Component.componentName}>` : "");
};
const generateSsrHtml = (template, children = null) => {
  let html2 = "";
  let counter = 0;
  let pendingTag = "";
  const pending = [];
  const components = [];
  for (let i = 0; i < template.parts.length; i++) {
    let part = template.parts[i];
    const value = template.values[i];
    part = part.replace(/<\/?([a-z]*?-[a-z]*?)[\s|/|>].*?[|/|>]?/gs, (match, componentName) => {
      const wompComponent = registeredComponents[componentName];
      if (wompComponent) {
        if (match.endsWith("/")) {
          components.push({
            component: wompComponent,
            props: {
              styles: {}
            }
          });
          const toReturn = `${match}><?$WC${counter}></?$WC${counter}></${componentName}>`;
          counter++;
          return toReturn;
        } else if (match[1] === "/") {
          return `</?$WC${pending.pop()}>${match}`;
        } else if (match.endsWith(">")) {
          components.push({
            component: wompComponent,
            props: {
              styles: {}
            }
          });
          pending.push(counter);
          const toReturn = `${match}<?$WC${counter}>`;
          counter++;
          return toReturn;
        } else {
          components.push({
            component: wompComponent,
            props: {
              styles: {}
            }
          });
          pendingTag = componentName;
          return match;
        }
      }
      return match;
    });
    if (pendingTag && part.includes(">")) {
      const firstPart = part.slice(0, part.indexOf(">") + 1);
      const secondPart = part.slice(part.indexOf(">") + 1);
      if (firstPart[firstPart.length - 2] === "/") {
        const before = firstPart.slice(0, firstPart.length - 2);
        part = `${before}>
						<?$WC${counter}></?$WC${counter}>
					</${pendingTag}>` + secondPart;
        pendingTag = "";
        counter++;
      } else {
        part = firstPart + `<?$WC${counter}>` + secondPart;
        pending.push(counter);
        pendingTag = "";
        counter++;
      }
    }
    if (pending.length && part.endsWith("/") && value._$wompF) {
      const before = part.slice(0, part.lastIndexOf("<"));
      part = before + `</?$WC${pending.pop()}></`;
      pendingTag = "";
    }
    html2 += part;
    const isPrimitive = value !== Object(value);
    if (pendingTag && !isPrimitive) {
      const propName = part.match(/\s(.*)[=|"]$/)[1];
      components[components.length - 1].props[propName] = value;
    }
    const isAttr = part.endsWith("=");
    const canBeRemoved = value === false || value === void 0 || value === null;
    if (isAttr) {
      if (isPrimitive && !canBeRemoved) {
        html2 += `"${value}"`;
      } else {
        const attrs = html2.split(" ");
        const attrName = attrs.pop();
        if (attrName === "style=" && typeof value === "object" && !canBeRemoved) {
          let styleString = "";
          const styles = Object.keys(value);
          for (const key of styles) {
            let styleValue = value[key];
            let styleKey = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
            if (typeof styleValue === "number")
              styleValue = `${styleValue}px`;
            styleString += `${styleKey}:${styleValue};`;
          }
          html2 += `"${styleString}"`;
        } else {
          html2 = attrs.join(" ");
        }
      }
    } else {
      const [toAdd, pendingTagFound] = handleSsrValue(value, part, components);
      html2 += toAdd;
      if (pendingTagFound)
        pendingTag = pendingTagFound;
    }
  }
  const wompComponents = {};
  components.forEach((comp) => wompComponents[comp.component.componentName] = true);
  let compIndex = 0;
  html2 = html2.replace(">>", ">");
  html2 = html2.replace(/<([a-z]*?-[a-z]*?)\s(.*?)>/gs, (match, name, attrs) => {
    if (!wompComponents[name])
      return match;
    const props = components[compIndex].props;
    const attributes = attrs.matchAll(/(.*?)="(.*?)"\s?/gs);
    let attrMatch;
    while (!(attrMatch = attributes.next()).done) {
      const [_, attrName, attrValue] = attrMatch.value;
      if (props[attrName] === void 0)
        props[attrName] = attrValue;
    }
    compIndex++;
    const res = match.replace(/title=".*?"/, "");
    return res;
  });
  for (let i = components.length - 1; i >= 0; i--) {
    const component = components[i];
    const childrenRegex = new RegExp(`<\\?\\$WC${i}>(.*?)<\\/\\?\\$WC${i}>`, "gs");
    html2 = html2.replace(childrenRegex, (_, group) => {
      component.props.children = {
        value: group,
        nodes: [],
        _$wompChildren: true
      };
      const rendered = ssr(component.component, component.props, false);
      return rendered;
    });
  }
  if (children)
    html2 = html2.replace(`<?WC-C>`, children.value);
  return html2;
};
const handleSsrValue = (value, part, components) => {
  let html2 = "";
  let pendingTag = "";
  const isPrimitive = value !== Object(value);
  const canBeRemoved = value === false || value === void 0 || value === null;
  if (value?._$wompF) {
    if (!part.endsWith("/")) {
      components.push({
        component: value,
        props: {
          styles: {}
        }
      });
      pendingTag = value.componentName;
    }
    html2 += value.componentName;
  } else if (value?._$wompChildren) {
    html2 += `<?WC-C>`;
  } else if (Array.isArray(value)) {
    for (const arrVal of value) {
      const [toAdd] = handleSsrValue(arrVal, part, components);
      html2 += toAdd;
    }
  } else if (value?._$wompHtml) {
    html2 += generateSsrHtml(value);
  } else if (isPrimitive && !canBeRemoved) {
    html2 += value;
  }
  return [html2, pendingTag];
};
//# sourceMappingURL=womp.js.map
