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
const TAG_NAME = 2;
const treeWalker = document.createTreeWalker(
  document,
  129
  // NodeFilter.SHOW_{ELEMENT|COMMENT}
);
const generateSpecifcStyles = (component, options) => {
  const { css } = component;
  const { shadow, name } = options;
  const componentName = name;
  const completeCss = `${shadow ? ":host" : componentName} {display:block;}
${css}`;
  if (DEV_MODE) {
    const invalidSelectors = [];
    [...completeCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
      const cssSelector = selector[1].trim();
      if (!cssSelector.includes("."))
        invalidSelectors.push(cssSelector);
    });
    invalidSelectors.forEach((selector) => {
      console.warn(
        `The CSS selector "${selector} {...}" in the component "${componentName}" is not enough specific: include at least one class.
`
      );
    });
  }
  const classes = {};
  const generatedCss = completeCss.replace(/\.(.*?)[\s|{]/gm, (_, className) => {
    const uniqueClassName = `${componentName}__${className}`;
    classes[className] = uniqueClassName;
    return `.${uniqueClassName} `;
  });
  return [generatedCss, classes];
};
const createHtml = (parts) => {
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
const createDependencies = (template, parts, attributes) => {
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
          type: TAG_NAME,
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
class DynamicNode {
  // For faster access
  constructor(startNode, endNode) {
    this.isNode = true;
    // For faster access
    this.isAttr = false;
    // For faster access
    this.isTag = false;
    this.startNode = startNode;
    this.endNode = endNode;
  }
  clearValue() {
    let currentNode = this.startNode.nextSibling;
    while (currentNode !== this.endNode) {
      currentNode.remove();
      currentNode = this.startNode.nextSibling;
    }
  }
  dispose() {
    this.clearValue();
    this.startNode.remove();
    this.endNode.remove();
  }
}
class DynamicAttribute {
  constructor(node, dependency) {
    this.isNode = false;
    // For faster access
    this.isAttr = true;
    // For faster access
    this.isTag = false;
    this.eventInitialized = false;
    this.node = node;
    this.name = dependency.name;
    this.index = dependency.index;
    this.attrStructure = dependency.attrDynamics;
  }
  updateValue(newValue) {
    if (this.name === "ref" && newValue.__wcRef) {
      newValue.current = this.node;
      return;
    }
    if (this.node.__womp) {
      this.node.updateProps(this.name, newValue);
    }
    const isPrimitive = newValue !== Object(newValue);
    if (newValue === false)
      this.node.removeAttribute(this.name);
    else if (isPrimitive)
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
  }
  set callback(callback) {
    if (!this.eventInitialized) {
      const eventName = this.name.substring(1);
      this.node.addEventListener(eventName, this.listener.bind(this));
      this.eventInitialized = true;
    }
    this._callback = callback;
  }
  listener(event) {
    if (this._callback)
      this._callback(event);
  }
}
class DynamicTag {
  // For faster access
  constructor(node) {
    this.isNode = false;
    // For faster access
    this.isAttr = false;
    // For faster access
    this.isTag = true;
    this.node = node;
  }
}
class CachedTemplate {
  constructor(template, dependencies) {
    this.template = template;
    this.dependencies = dependencies;
  }
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
        } else if (type === TAG_NAME) {
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
class WompChildren {
  constructor(nodes, owner) {
    this.__wompChildren = true;
    this.nodes = nodes;
    this.owner = owner;
  }
}
class WompArrayDependency {
  constructor(values, dependency) {
    this.isArrayDependency = true;
    this.dynamics = [];
    this.parentDependency = dependency;
    this.addDependenciesFrom(dependency.startNode, values.length);
    this.oldValues = setValues(this.dynamics, values, []);
  }
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
  checkUpdates(newValues) {
    let diff = newValues.length - this.oldValues.length;
    if (diff > 0) {
      let startNode = this.dynamics[this.dynamics.length - 1]?.endNode;
      if (!startNode)
        startNode = this.parentDependency.startNode;
      this.addDependenciesFrom(startNode, diff);
    } else if (diff < 0) {
      while (diff) {
        const toClean = this.dynamics.pop();
        toClean.dispose();
        diff++;
      }
    }
    this.oldValues = setValues(this.dynamics, newValues, this.oldValues);
    return this;
  }
}
const getRenderHtmlString = (render) => {
  let value = "";
  const { parts, values } = render;
  for (let i = 0; i < parts.length; i++) {
    value += parts[i];
    if (values[i]?.componentName)
      value += values[i].componentName;
  }
  return value;
};
const shouldUpdate = (currentValue, oldValue, dependency) => {
  const valuesDiffers = currentValue !== oldValue;
  const isComposedAttribute = !!dependency.attrStructure;
  const isWompChildren = currentValue?.__wompChildren;
  const childrenNeedUpdate = isWompChildren && dependency.startNode.nextSibling !== currentValue.nodes[0];
  return valuesDiffers || isComposedAttribute || childrenNeedUpdate;
};
const setValues = (dynamics, values, oldValues) => {
  const newValues = [...values];
  for (let i = 0; i < dynamics.length; i++) {
    const currentDependency = dynamics[i];
    const currentValue = newValues[i];
    const oldValue = oldValues[i];
    if (!shouldUpdate(currentValue, oldValue, currentDependency))
      continue;
    if (currentDependency.isNode) {
      if (currentValue === false) {
        currentDependency.clearValue();
        continue;
      }
      if (currentValue?.__wompHtml) {
        const oldStringified = oldValue?.stringifiedTemplate;
        const newTemplate = getRenderHtmlString(currentValue);
        const sameString = newTemplate === oldStringified;
        if (oldValue === void 0 || !sameString) {
          const cachedTemplate = createTemplate(currentValue.parts);
          const template = cachedTemplate.clone();
          const [fragment, dynamics2] = template;
          newValues[i] = new HtmlProcessedValue(newTemplate, currentValue.values, template);
          setValues(dynamics2, currentValue.values, oldValue?.values ?? oldValue ?? []);
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
          const processedValues = setValues(
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
        if (currentValue.__wompChildren) {
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
            if (!oldValue?.isArrayDependency)
              newValues[i] = new WompArrayDependency(currentValue, currentDependency);
            else
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
      const isCustomComponent = currentValue.__womp;
      const newNodeName = isCustomComponent ? currentValue.componentName : currentValue;
      if (node.nodeName !== newNodeName.toUpperCase()) {
        const oldAttributes = node.getAttributeNames();
        if (isCustomComponent) {
          if (DEV_MODE) {
            if (node.__womp) {
              console.error(
                "Dynamic tags are currently not supported, unsless used to render for the first time a custom component.\nInstead, you can use conditional rendering (e.g. condition ? html`<${First} />` : html`<${Second} />`)."
              );
              continue;
            }
          }
          const initialProps = {};
          for (const attrName of oldAttributes) {
            initialProps[attrName] = node.getAttribute(attrName);
          }
          customElement = new currentValue();
          customElement.initialProps = initialProps;
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
            customElement.initialProps[currentDynamic.name] = values[index];
        }
        node.replaceWith(customElement);
      }
    }
  }
  return newValues;
};
const createTemplate = (parts) => {
  const [dom, attributes] = createHtml(parts);
  const template = document.createElement("template");
  template.innerHTML = dom;
  const dependencies = createDependencies(template, parts, attributes);
  return new CachedTemplate(template, dependencies);
};
const womp = (Component, options) => {
  const [generatedCSS, styles] = generateSpecifcStyles(Component, options);
  const style = document.createElement("style");
  const styleClassName = `${options.name}__styles`;
  style.classList.add(styleClassName);
  style.textContent = generatedCSS;
  if (!options.shadow) {
    document.body.appendChild(style);
  }
  const WompComponent = class extends HTMLElement {
    constructor() {
      super();
      this.hooks = [];
      this.props = {};
      this.__womp = true;
      this.initialProps = {};
      this.updating = false;
      this.oldValues = [];
      this.isInitializing = true;
      this.connected = false;
      this.isInTheDOM = false;
    }
    static {
      this.componentName = options.name;
    }
    static {
      this.__womp = true;
    }
    static getOrCreateTemplate(parts) {
      if (!this.cachedTemplate)
        this.cachedTemplate = createTemplate(parts);
      return this.cachedTemplate;
    }
    /** @override component is connected to DOM */
    connectedCallback() {
      this.isInTheDOM = true;
      if (!this.connected)
        this.initElement();
    }
    /** @override component is connected to DOM */
    disconnectedCallback() {
      if (this.connected) {
        this.isInTheDOM = false;
        Promise.resolve().then(() => {
          if (!this.isInTheDOM) {
            if (DEV_MODE)
              console.warn("Disconnected", this);
          }
        });
      }
    }
    /**
     * Initializes the component with the state, props, and styles.
     */
    initElement() {
      this.ROOT = this;
      this.props = {
        ...this.initialProps,
        styles
      };
      const componentAttributes = this.getAttributeNames();
      for (const attrName of componentAttributes) {
        if (!this.props.hasOwnProperty(attrName))
          this.props[attrName] = this.getAttribute(attrName);
      }
      const childNodes = this.ROOT.childNodes;
      const childrenArray = [];
      const supportTemplate = document.createElement("template");
      while (childNodes.length) {
        childrenArray.push(childNodes[0]);
        supportTemplate.appendChild(childNodes[0]);
      }
      const children = new WompChildren(childrenArray, this);
      this.props.children = children;
      if (options.shadow)
        this.ROOT = this.attachShadow({ mode: "open" });
      const root = this.getRootNode();
      if ((options.shadow || root !== document) && !root.querySelector(`.${styleClassName}`)) {
        const clonedStyles = style.cloneNode(true);
        this.ROOT.appendChild(clonedStyles);
      }
      const renderHtml = this.callComponent();
      const { values, parts } = renderHtml;
      const template = this.constructor.getOrCreateTemplate(parts);
      const [fragment, dynamics] = template.clone();
      this.dynamics = dynamics;
      const elaboratedValues = setValues(this.dynamics, values, this.oldValues);
      this.oldValues = elaboratedValues;
      while (fragment.childNodes.length) {
        this.ROOT.appendChild(fragment.childNodes[0]);
      }
      this.isInitializing = false;
      this.connected = true;
    }
    callComponent() {
      currentRenderingComponent = this;
      currentHookIndex = 0;
      const result = Component.call(this, this.props);
      let renderHtml = result;
      if (typeof result === "string" || result instanceof HTMLElement)
        renderHtml = html`${result}`;
      return renderHtml;
    }
    requestRender() {
      if (!this.updating) {
        this.updating = true;
        Promise.resolve().then(() => {
          const renderHtml = this.callComponent();
          console.time("Update");
          const oldValues = setValues(this.dynamics, renderHtml.values, this.oldValues);
          console.timeEnd("Update");
          this.oldValues = oldValues;
          this.updating = false;
        });
      }
    }
    updateProps(prop, value) {
      if (this.props[prop] !== value) {
        this.props[prop] = value;
        if (!this.isInitializing) {
          console.warn(`Updating ${prop}`, this.isInitializing);
          this.requestRender();
        }
      }
    }
  };
  return WompComponent;
};
export function defineWomp(component, options = {}) {
  if (!component.css)
    component.css = "";
  const defaultOptions = {
    shadow: false,
    name: ""
  };
  const componentOptions = {
    ...defaultOptions,
    ...options
  };
  if (!componentOptions.name) {
    let newName = component.name.replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`).toLowerCase();
    if (!newName.includes("-"))
      newName += "-womp";
    componentOptions.name = newName;
  }
  const Component = womp(component, componentOptions);
  customElements.define(componentOptions.name, Component);
  return Component;
}
export const useState = (defaultValue) => {
  const component = currentRenderingComponent;
  if (!component.hooks.hasOwnProperty(currentHookIndex)) {
    const index = currentHookIndex;
    component.hooks[index] = [
      defaultValue,
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
  const state = component.hooks[currentHookIndex];
  currentHookIndex++;
  return state;
};
export const useEffect = (callback, dependencies) => {
  const component = currentRenderingComponent;
  if (!component.hooks.hasOwnProperty(currentHookIndex)) {
    const effectHook = {
      dependencies,
      callback,
      cleanupFunction: null
    };
    component.hooks[currentHookIndex] = effectHook;
    Promise.resolve().then(() => {
      effectHook.cleanupFunction = callback();
    });
  } else {
    const componentEffect = component.hooks[currentHookIndex];
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
  currentHookIndex++;
};
export const useLayoutEffect = (callback, dependencies) => {
  const component = currentRenderingComponent;
  if (!component.hooks.hasOwnProperty(currentHookIndex)) {
    const effectHook = {
      dependencies,
      callback,
      cleanupFunction: null
    };
    component.hooks[currentHookIndex] = effectHook;
    effectHook.cleanupFunction = callback();
  } else {
    const componentEffect = component.hooks[currentHookIndex];
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
  currentHookIndex++;
};
export const useRef = (initialValue = null) => {
  const component = currentRenderingComponent;
  if (!component.hooks.hasOwnProperty(currentHookIndex)) {
    component.hooks[currentHookIndex] = {
      current: initialValue,
      __wcRef: true
    };
  }
  const ref = component.hooks[currentHookIndex];
  currentHookIndex++;
  return ref;
};
export const useCallback = (callbackFn) => {
  const component = currentRenderingComponent;
  if (!component.hooks.hasOwnProperty(currentHookIndex)) {
    callbackFn.__wcCallback = true;
    component.hooks[currentHookIndex] = callbackFn;
  }
  const callback = component.hooks[currentHookIndex];
  currentHookIndex++;
  return callback;
};
const useIdMemo = () => {
  let counter = 0;
  return () => {
    const component = currentRenderingComponent;
    if (!component.hooks.hasOwnProperty(currentHookIndex)) {
      component.hooks[currentHookIndex] = `:r${counter}:`;
      counter++;
    }
    const callback = component.hooks[currentHookIndex];
    currentHookIndex++;
    return callback;
  };
};
export const useId = useIdMemo();
export const useMemo = (callbackFn, dependencies) => {
  const component = currentRenderingComponent;
  if (!component.hooks.hasOwnProperty(currentHookIndex)) {
    component.hooks[currentHookIndex] = {
      value: callbackFn(),
      dependencies
    };
  } else {
    const oldMemo = component.hooks[currentHookIndex];
    for (let i = 0; i < dependencies.length; i++) {
      const oldDep = oldMemo.dependencies[i];
      if (oldDep !== dependencies[i]) {
        oldMemo.dependencies = dependencies;
        oldMemo.value = callbackFn();
        break;
      }
    }
  }
  const memoizedResult = component.hooks[currentHookIndex];
  currentHookIndex++;
  return memoizedResult.value;
};
export const useReducer = (reducer, initialState) => {
  const component = currentRenderingComponent;
  const index = currentHookIndex;
  if (!component.hooks.hasOwnProperty(index)) {
    const dispatch = (action) => {
      const currentState = component.hooks[index][0];
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
      component.hooks[currentHookIndex][0] = newState;
    };
    const reducerHook = [initialState, dispatch];
    component.hooks[currentHookIndex] = reducerHook;
  }
  const stateAndReducer = component.hooks[currentHookIndex];
  currentHookIndex++;
  return stateAndReducer;
};
export const useHook = () => {
  const currentRendering = currentRenderingComponent;
  const currentHook = currentHookIndex;
  currentHookIndex++;
  //! FINISH, usata per creare un hook personalizzato
  //! Magari fai un wrap di tutti gli hook in questa funzione, non so.
  return {};
};
export const useExposed = (toExpose) => {
  const component = currentRenderingComponent;
  const keys = Object.keys(toExpose);
  for (const key of keys) {
    component[key] = toExpose[key];
  }
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
    __wompHtml: true
  };
}
//! Opzioni per NON generare il CSS specifico
//! Customizzare opzioni default per TUTTI i componenti
//! Permetti solo in DEV_MODE di mettere un attributo wc-debug="debug|info|warn"
//! Crea i vari hooks
//! Crea la gestione stato globale stile Zustand
//! Ordina il codice
//! Prefisso nei metodi privati: __$
//! Aggiungi commenti alle funzioni/classi
//! Crea file .d.ts
//! Crea documentazione
//! NO useDeferredValue
//! NO useImperativeHandle
//! NO useInsertionEffect
//! NO useOptimistic
//# sourceMappingURL=womp.js.map
