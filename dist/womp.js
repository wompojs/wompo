const DEV_MODE = true;
let currentRenderingComponent = null;
let currentHookIndex = 0;
const WC_MARKER = "$wc$";
const isAttrRegex = /\s+([^\s]*?)="?$/g;
const selfClosingRegex = /(<([a-x]*?-[a-z]*).*?)\/>/g;
const NODE = 0;
const ATTR = 1;
const generateSpecifcStyles = (component) => {
  const componentCss = component.css || "";
  const invalidSelectors = [];
  if (DEV_MODE) {
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
  classNames.forEach((className) => {
    const uniqueClassName = `${component.componentName}__${className}`;
    generatedCss = generatedCss.replaceAll(className, uniqueClassName);
  });
  return generatedCss;
};
const createHtml = (parts) => {
  console.time("Create HTML");
  let html2 = "";
  const length = parts.length - 1;
  let attrDelimiter = "";
  let consecutiveAttributes = 0;
  for (let i = 0; i < length; i++) {
    let part = parts[i];
    isAttrRegex.lastIndex = 0;
    const isAttr = isAttrRegex.exec(part);
    if (attrDelimiter && part.trim()[0] === attrDelimiter) {
      part = part.replace(attrDelimiter, "");
      attrDelimiter = "";
      html2 += `"${consecutiveAttributes}"`;
      consecutiveAttributes = 0;
    }
    if (isAttr) {
      const [match, attrName] = isAttr;
      const beforeLastChar = match[match.length - 2];
      attrDelimiter = beforeLastChar === '"' || beforeLastChar === "'" ? beforeLastChar : "";
      const prevPart = part.substring(0, isAttr.index);
      let toAdd = `${prevPart} ${attrName}${WC_MARKER}=`;
      if (attrDelimiter)
        toAdd += `"${WC_MARKER}`;
      else
        toAdd += '"0"';
      html2 += toAdd;
    } else if (attrDelimiter) {
      html2 += part + `${WC_MARKER}`;
    } else {
      html2 += part + `<?${WC_MARKER}>`;
    }
  }
  html2 += parts[parts.length - 1];
  html2 = html2.replace(selfClosingRegex, "$1></$2>");
  console.timeEnd("Create HTML");
  return html2;
};
const traverse = (childNodes, values, index, dependencies) => {
  const dependencyValue = values[index];
  for (const childNode of childNodes) {
    const child = childNode;
    const attributes = child.attributes;
    if (attributes) {
      const toRemove = [];
      const toSet = [];
      for (const attr of attributes) {
        const attrName = attr.name;
        if (attrName.endsWith(WC_MARKER)) {
          const name = attrName.substring(0, attrName.length - WC_MARKER.length);
          const attrValue = attr.value;
          const dependency = {
            type: ATTR,
            name,
            node: child,
            index
          };
          if (attrValue !== "0") {
          } else {
            toRemove.push(attrName);
            if (!child.nodeName.includes("-")) {
              if (name[0] === "@") {
                //! Handle events
              } else if (dependencyValue !== false) {
                toSet.push({ name, value: dependencyValue });
              }
            }
          }
          dependencies.push(dependency);
          index++;
        }
      }
      for (const name of toRemove) {
        child.removeAttribute(name);
      }
      for (const attr of toSet) {
        child.setAttribute(attr.name, attr.value);
      }
    } else if (child.nodeName === "#comment" && childNode.data === `?${WC_MARKER}`) {
      childNode.after(dependencyValue);
      const dependency = {
        type: NODE,
        name: "",
        node: childNode.nextSibling,
        index
      };
      dependencies.push(dependency);
      index++;
    }
    traverse(child.childNodes, values, index, dependencies);
  }
};
const womp = (Component) => {
  const WompComponent = class extends HTMLElement {
    constructor() {
      super();
      this.state = [];
      this.initElement();
    }
    static getOrCreateTemplate(renderHtml) {
      const { values, parts } = renderHtml;
      if (!this.template) {
        const dom = createHtml(parts);
        const template = document.createElement("template");
        template.innerHTML = dom;
        const dependencies = [];
        console.time("Traverse");
        traverse(template.content.childNodes, values, 0, dependencies);
        console.timeEnd("Traverse");
        this.template = template;
        console.log(dependencies);
      }
      return this.template;
    }
    /** @override component is connected to DOM */
    connectedCallback() {
    }
    /**
     * Initializes the component with the state, props, and styles.
     */
    initElement() {
      console.time("Init");
      const constructor = this.constructor;
      this.ROOT = this;
      currentRenderingComponent = this;
      currentHookIndex = 0;
      const result = Component.call(this, {});
      let renderHtml = result;
      if (typeof result === "string" || result instanceof HTMLElement)
        renderHtml = html`${result}`;
      const template = constructor.getOrCreateTemplate(renderHtml);
      const clone = template.cloneNode(true);
      this.ROOT.replaceChildren(...clone.content.childNodes);
      console.timeEnd("Init");
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
    component.state[index] = {
      value: defaultValue,
      setter: (newValue) => {
        component.state[index].value = newValue;
      }
    };
  }
  const state = component.state[currentHookIndex];
  currentHookIndex++;
  return [state.value, state.setter];
};
export function html(templateParts, ...values) {
  return {
    parts: templateParts,
    values,
    __womp: true
  };
}
//# sourceMappingURL=womp.js.map
