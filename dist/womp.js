const DEV_MODE = true;
let currentRenderingComponent = null;
let currentHookIndex = 0;
let currentEffectIndex = 0;
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
const generateSpecifcStyles = (component) => {
  const { css, componentName } = component;
  if (DEV_MODE) {
    const invalidSelectors = [];
    [...css.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
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
  const generatedCss = css.replace(/\.(.*?)[\s|{]/gm, (_, className) => {
    const uniqueClassName = `${componentName}__${className}`;
    classes[className] = uniqueClassName;
    return `.${uniqueClassName} `;
  }) + `${componentName} {display:block;}`;
  return [generatedCss, classes];
};
//! HTML Nested fare il "join" delle dependencies (???)
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
  constructor(startNode, endNode, index) {
    this.isNode = true;
    // For faster access
    this.isAttr = false;
    // For faster access
    this.isTag = false;
    this.startNode = startNode;
    this.endNode = endNode;
    this.index = index;
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
    if (this.node.__womp) {
      this.node.updateProps(this.name, newValue);
    }
    const isPrimitive = newValue !== Object(newValue);
    if (newValue === false)
      this.node.removeAttribute(this.name);
    else if (isPrimitive)
      this.node.setAttribute(this.name, newValue);
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
          dynamic = new DynamicNode(
            node,
            node.nextSibling,
            templateDependency.index
          );
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
const handleChildren = (children, dependency) => {
  console.log("isChildren");
  if (children.static) {
    let currentNode = dependency.startNode;
    while (children.nodes.length) {
      currentNode.after(children.nodes[0]);
      currentNode = currentNode.nextSibling;
    }
  }
};
const setValues = (dynamics, values, oldValues) => {
  for (let i = 0; i < dynamics.length; i++) {
    const currentDependency = dynamics[i];
    const currentValue = values[i];
    if (currentValue === oldValues[i] && !currentDependency.attrStructure)
      continue;
    if (currentDependency.isNode) {
      const newNode = currentValue;
      if (newNode.__wompChildren) {
        handleChildren(newNode, currentDependency);
      }
      //! Metti dentro il loop sotto
      //! Una cosa alla volta. Prima singoli elementi, poi array
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
            dynamicValue = values[i];
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
        //! DA FINIRE TAG DINAMICI: PROBLEMA CON I CHILDREN
        const oldAttributes = node.getAttributeNames();
        if (isCustomComponent) {
          let children = node.childNodes;
          if (!!node.__womp) {
            children = node.staticChildren.content.childNodes;
          }
          const initialProps = {
            children: {
              static: false,
              __wompChildren: true,
              nodes: children
            }
          };
          for (const attrName of oldAttributes) {
            initialProps[attrName] = node.getAttribute(attrName);
          }
          customElement = new currentValue(initialProps);
        } else {
          customElement = document.createElement(newNodeName);
          for (const attrName of oldAttributes) {
            customElement.setAttribute(attrName, node.getAttribute(attrName));
          }
        }
        let index = i;
        let currentDynamic = dynamics[index];
        while (currentDynamic.node === node) {
          currentDynamic.node = customElement;
          currentDynamic = dynamics[++index];
        }
        node.replaceWith(customElement);
      }
    }
  }
};
//! Se un component vuole esporre dei metodi?? ( es. modal.open() )
//! Dovrei metterli nella chiave this. Opzioni:
//! 1. puoi fare this.method dentro il componente: viene già chiamato con this impostato
//! 2. Crea un hook tipo "useExposedState(nome, defaultValue)"
const womp = (Component) => {
  const [generatedCSS, styles] = generateSpecifcStyles(Component);
  const style = document.createElement("style");
  style.textContent = generatedCSS;
  document.body.appendChild(style);
  //! Check where to attach styles: if shadow-dom, inside the element
  const WompComponent = class extends HTMLElement {
    constructor(initialProps) {
      super();
      this.state = [];
      this.effects = [];
      this.props = {};
      this.__womp = true;
      this.updating = false;
      this.initElement(initialProps ?? {});
    }
    static {
      this.componentName = Component.componentName;
    }
    static {
      this.__womp = true;
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
    initElement(initialProps) {
      this.ROOT = this;
      this.oldValues = [];
      this.props = {
        ...initialProps,
        styles
      };
      const componentAttributes = this.getAttributeNames();
      for (const attrName of componentAttributes) {
        this.props[attrName] = this.getAttribute(attrName);
      }
      //! Da finire!
      if (!initialProps.children) {
        const children = initialProps.children ? initialProps.children.nodes : this.ROOT.childNodes;
        const childrenTemplate = document.createElement("template");
        let currentChild = null;
        while (children.length) {
          currentChild = children[0];
          childrenTemplate.content.appendChild(currentChild);
        }
        this.props.children = {
          __wompChildren: true,
          static: true,
          nodes: document.importNode(
            childrenTemplate.content,
            true
          ).childNodes
        };
      }
      const renderHtml = this.callComponent();
      const { values, parts } = renderHtml;
      const template = this.constructor.getOrCreateTemplate(parts);
      const [fragment, dynamics] = template.clone();
      this.dynamics = dynamics;
      setValues(this.dynamics, values, this.oldValues);
      while (fragment.childNodes.length) {
        this.ROOT.appendChild(fragment.childNodes[0]);
      }
    }
    callComponent() {
      currentRenderingComponent = this;
      currentHookIndex = 0;
      currentEffectIndex = 0;
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
          if (this.staticChildren)
            this.props.children = document.importNode(this.staticChildren.content, true);
          const renderHtml = this.callComponent();
          setValues(this.dynamics, renderHtml.values, this.oldValues);
          this.oldValues = renderHtml.values;
          this.updating = false;
        });
      }
    }
    updateProps(prop, value) {
      if (this.props[prop] !== value) {
        this.props[prop] = value;
        console.log(`Updating ${prop}`);
        //! Test how many times it requests an update and how many it actually updates
        this.requestRender();
      }
    }
  };
  return WompComponent;
};
export function defineWomp(component) {
  if (!component.css)
    component.css = "";
  if (!component.componentName) {
    let newName = component.name.replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`).toLowerCase();
    if (!newName.includes("-"))
      newName += "-womp";
    component.componentName = newName;
  }
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
  const cleanValues = [];
  const length = templateParts.length - 1;
  for (let i = 0; i < length; i++) {
    if (!templateParts[i].endsWith("</"))
      cleanValues.push(values[i]);
  }
  return {
    parts: templateParts,
    values: cleanValues,
    __womp: true
  };
}
//# sourceMappingURL=womp.js.map
