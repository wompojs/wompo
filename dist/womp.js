const DEV_MODE = true;
let currentRenderingComponent = null;
let currentHookIndex = 0;
let currentEffectIndex = 0;
const WC_MARKER = "$wc$";
const isAttrRegex = /\s+([^\s]*?)="?$/g;
const selfClosingRegex = /(<([a-x]*?-[a-z]*).*?)\/>/g;
const isInsideTextTag = /<(?<tag>script|style|textarea|title])(?!.*?<\/\k<tag>)/gi;
const onlyTextChildrenElementsRegex = /^(?:script|style|textarea|title)$/i;
const NODE = 0;
const ATTR = 1;
const treeWalker = document.createTreeWalker(
  document,
  129
  // NodeFilter.SHOW_{ELEMENT|COMMENT}
);
const generateSpecifcStyles = (component) => {
  const componentCss = component.css || "";
  if (DEV_MODE) {
    const invalidSelectors = [];
    [...componentCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
      const cssSelector = selector[1].trim();
      if (!cssSelector.includes("."))
        invalidSelectors.push(cssSelector);
    });
    invalidSelectors.forEach((selector) => {
      console.warn(
        `The CSS selector "${selector} {...}" in the component "${component.componentName}" is not enough specific: include at least one class.
`
      );
    });
  }
  const classNames = /* @__PURE__ */ new Set();
  [...componentCss.matchAll(/\.(.*?)[\s|{]/gm)].forEach((match) => {
    const className = match[1];
    classNames.add(className);
  });
  let generatedCss = componentCss;
  const classes = {};
  classNames.forEach((className) => {
    const uniqueClassName = `${component.componentName}__${className}`;
    generatedCss = generatedCss.replaceAll(className, uniqueClassName);
    classes[className] = uniqueClassName;
  });
  return [generatedCss, classes];
};
//! HTML Nested fare il "join" delle dependencies
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
      if (data === `?${WC_MARKER}`) {
        dependencies.push({ type: NODE, index: nodeIndex });
      } else {
        //! Capisci sta roba
      }
    }
    nodeIndex++;
  }
  return dependencies;
};
class DynamicNode {
  // For faster access
  constructor(startNode, endNode, index) {
    this.isNode = true;
    this.startNode = startNode;
    this.endNode = endNode;
    this.index = index;
  }
}
class DynamicAttribute {
  constructor(node, dependency) {
    this.isNode = false;
    this.eventInitialized = false;
    this.node = node;
    this.name = dependency.name;
    this.index = dependency.index;
    this.attrStructure = dependency.attrDynamics;
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
        if (templateDependency.type === NODE) {
          dynamic = new DynamicNode(
            node,
            node.nextSibling,
            templateDependency.index
          );
        } else if (templateDependency.type === ATTR) {
          dynamic = new DynamicAttribute(node, templateDependency);
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
const setValues = (dynamics, values, oldValues) => {
  for (let i = 0; i < dynamics.length; i++) {
    const currentDependency = dynamics[i];
    const currentValue = values[i];
    if (currentValue === oldValues[i] && !currentDependency.attrStructure)
      continue;
    if (currentDependency.isNode) {
      let newNodesList = [currentValue];
      if (currentValue instanceof NodeList || currentValue instanceof HTMLCollection)
        newNodesList = currentValue;
      let prevNode = currentDependency.startNode;
      let currentNode = prevNode.nextSibling;
      let newNodeIndex = 0;
      let index = 0;
      const newNodesLength = newNodesList.length;
      while (currentNode !== currentDependency.endNode) {
        const newNode = newNodesList[newNodeIndex];
        const next = currentNode.nextSibling;
        const isNode = newNode instanceof Node;
        if (newNode === void 0 || newNode === false)
          currentNode.remove();
        else if (isNode && !currentNode.isEqualNode(newNode) || !isNode) {
          currentNode.replaceWith(newNode);
          if (!isNode)
            newNodeIndex++;
        }
        prevNode = currentNode;
        currentNode = next;
        index++;
      }
      while (index < newNodesLength) {
        if (!currentNode || index === 0)
          currentNode = prevNode;
        const newNode = newNodesList[newNodeIndex];
        const isNode = newNode instanceof Node;
        if (newNode !== false) {
          if (!isNode)
            newNodeIndex++;
          currentNode.after(newNode);
        }
        currentNode = currentNode.nextSibling;
        index++;
      }
    } else if (currentDependency.isNode === false) {
      const attrName = currentDependency.name;
      if (attrName.startsWith("@")) {
        currentDependency.callback = currentValue;
      } else {
        const node = currentDependency.node;
        const attrStructure = currentDependency.attrStructure;
        if (attrStructure) {
          const parts = attrStructure.split(WC_MARKER);
          let dynamicValue = currentValue;
          for (let j = 0; j < parts.length - 1; j++) {
            parts[j] = `${parts[j]}${dynamicValue}`;
            i++;
            dynamicValue = values[i];
          }
          i--;
          node.setAttribute(attrName, parts.join("").trim());
        } else if (currentValue === false)
          node.removeAttribute(attrName);
        else
          node.setAttribute(attrName, currentValue);
      }
    }
  }
};
const womp = (Component) => {
  const [generatedCSS, styles] = generateSpecifcStyles(Component);
  const style = document.createElement("style");
  style.textContent = generatedCSS;
  document.body.appendChild(style);
  //! Check where to attach styles: if shadow-dom, inside the element
  const WompComponent = class extends HTMLElement {
    constructor() {
      super();
      this.state = [];
      this.effects = [];
      this.props = {};
      this.updating = false;
      this.initElement();
    }
    static getOrCreateTemplate(parts) {
      if (!this.cachedTemplate) {
        const [dom, attributes] = createHtml(parts);
        const template = document.createElement("template");
        template.innerHTML = dom;
        const dependencies = createDependencies(template, parts, attributes);
        this.cachedTemplate = new CachedTemplate(template, dependencies);
      }
      return this.cachedTemplate;
    }
    /** @override component is connected to DOM */
    connectedCallback() {
    }
    /**
     * Initializes the component with the state, props, and styles.
     */
    initElement() {
      this.ROOT = this;
      this.ROOT.innerHTML = "";
      this.oldValues = [];
      this.props = {
        ...this.props,
        styles
      };
      currentRenderingComponent = this;
      currentHookIndex = 0;
      currentEffectIndex = 0;
      const renderHtml = this.getRenderData();
      const { values, parts } = renderHtml;
      const template = this.constructor.getOrCreateTemplate(parts);
      const [fragment, dynamics] = template.clone();
      this.dynamics = dynamics;
      setValues(this.dynamics, values, this.oldValues);
      while (fragment.childNodes.length) {
        this.ROOT.appendChild(fragment.childNodes[0]);
      }
    }
    getRenderData() {
      const result = Component(this.props);
      let renderHtml = result;
      if (typeof result === "string" || result instanceof HTMLElement)
        renderHtml = html`${result}`;
      return renderHtml;
    }
    requestRender() {
      //! Maybe improve re-rendering
      if (!this.updating) {
        this.updating = true;
        Promise.resolve().then(() => {
          currentHookIndex = 0;
          currentEffectIndex = 0;
          currentRenderingComponent = this;
          const renderHtml = this.getRenderData();
          setValues(this.dynamics, renderHtml.values, this.oldValues);
          this.oldValues = renderHtml.values;
          this.updating = false;
        });
      }
    }
  };
  return WompComponent;
};
export function defineWomp(component) {
  const Component = womp(component);
  customElements.define(component.componentName, Component);
  return Component;
}
export const useState = (defaultValue) => {
  const component = currentRenderingComponent;
  if (!component.state.hasOwnProperty(currentHookIndex)) {
    const index = currentHookIndex;
    component.state[index] = [
      defaultValue,
      (newValue) => {
        let computedValue = newValue;
        if (typeof newValue === "function") {
          computedValue = newValue(component.state[index][0]);
        }
        if (computedValue !== component.state[index][0]) {
          component.state[index][0] = computedValue;
          component.requestRender();
        }
      }
    ];
  }
  const state = component.state[currentHookIndex];
  currentHookIndex++;
  return state;
};
export const useEffect = (callback, dependencies) => {
  const component = currentRenderingComponent;
  if (!component.effects.hasOwnProperty(currentEffectIndex)) {
    const index = currentEffectIndex;
    const cleanupFunction = callback();
    component.effects[index] = {
      dependencies,
      callback,
      cleanupFunction
    };
  } else {
    const componentEffect = component.effects[currentEffectIndex];
    for (let i = 0; i < dependencies.length; i++) {
      const oldDep = componentEffect.dependencies[i];
      if (oldDep !== dependencies[i]) {
        if (componentEffect.cleanupFunction)
          componentEffect.cleanupFunction();
        componentEffect.cleanupFunction = callback();
        componentEffect.dependencies = dependencies;
        break;
      }
    }
  }
  currentEffectIndex++;
};
export function html(templateParts, ...values) {
  return {
    parts: templateParts,
    values,
    __womp: true
  };
}
//# sourceMappingURL=womp.js.map
