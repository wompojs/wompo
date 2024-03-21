import { registeredComponents } from "../womp";
export const ssr = (Component, props) => {
  const ssrData = {
    count: 0,
    cCounter: 0,
    components: {},
    props: {}
  };
  let htmlString = ssRenderComponent(Component, props, ssrData);
  htmlString = htmlString.replace(/\s[a-z]+="\$wcREMOVE\$"/g, "");
  const css = {};
  const components = ssrData.components;
  for (const comp in components) {
    const component = components[comp];
    const compCss = component.options.generatedCSS;
    if (compCss)
      css[comp] = compCss.replace(/\s\s+/g, " ").replace(/\t/g, "").replace(/\n/g, "");
  }
  return {
    html: htmlString,
    css,
    props: ssrData.props
  };
};
const ssRenderComponent = (Component, props, ssrData) => {
  let html = "";
  const { generatedCSS, styles, shadow } = Component.options;
  props.styles = styles;
  const componentName = Component.componentName;
  if (!ssrData.props[componentName])
    ssrData.props[componentName] = [];
  html += `<${componentName} womp-hydrate="${ssrData.props[componentName].length}"`;
  for (const prop in props) {
    const value = props[prop];
    const isPrimitive = value !== Object(value);
    if (isPrimitive && prop !== "title")
      html += ` ${prop}="${value}"`;
  }
  html += ">";
  if (shadow)
    html += `<template shadowrootmode="open">`;
  if (generatedCSS)
    html += `<link rel="stylesheet" href="/${componentName}.css" />`;
  ssrData.components[componentName] = Component;
  const template = Component(props);
  delete props.children;
  //! Maybe remove when implementing hydration
  ssrData.props[componentName].push(props);
  let toRender = generateSsHtml(template, ssrData);
  toRender = toRender.replace(
    /<([a-z]*-[a-z]*)(.*?)>/gs,
    (match, name, attrs) => match.endsWith("/>") ? `<${name}${attrs.substring(0, attrs.length - 1)}></${name}>` : match
  );
  let counter = 0;
  let pending = "";
  const components = [];
  toRender = toRender.replace(/<\/?([a-z]+?-[a-z]+?)\s?(?:\s.*?)?>/gs, (match, name) => {
    const component = registeredComponents[name];
    if (!component)
      return match;
    if (match[1] !== "/") {
      if (name === pending) {
        counter++;
      } else if (!pending) {
        pending = name;
        const res = match + `<?$CWC${components.length}>`;
        counter++;
        return res;
      }
    } else if (pending) {
      if (name === pending) {
        counter--;
        if (!counter) {
          const res = `</?$CWC${components.length}>` + match;
          pending = "";
          components.push(components.length);
          return res;
        }
      }
    }
    return match;
  });
  for (const id of components) {
    const regex = new RegExp(
      `<([a-z]+-[a-z]+)([^>]*?)><\\?\\$CWC${id}>(.*?)<\\/\\?\\$CWC${id}>`,
      "gs"
    );
    toRender = toRender.replace(regex, (_, name, attrs, children) => {
      const Component2 = registeredComponents[name];
      const componentProps = {};
      componentProps.children = {
        _$wompChildren: true,
        nodes: children
      };
      const attributes = attrs.matchAll(/\s?(.*?)="(.*?)"/gs);
      let attr;
      while (!(attr = attributes.next()).done) {
        const [_2, attrName, attrValue] = attr.value;
        if (attrValue.match(/\$wc(.*?)\$/)) {
          const value = ssrData[attrValue];
          componentProps[attrName] = value;
        } else {
          componentProps[attrName] = attrValue;
        }
      }
      return ssRenderComponent(Component2, componentProps, ssrData);
    });
  }
  html += toRender;
  if (shadow)
    html += `</template>`;
  html += `</${componentName}>`;
  return html;
};
const generateSsHtml = (template, ssrData) => {
  let html = "";
  for (let i = 0; i < template.parts.length; i++) {
    let part = template.parts[i];
    const value = template.values[i];
    html += part;
    html += handleSsValue(part, value, ssrData);
  }
  return html;
};
const handleSsValue = (part, value, ssrData) => {
  let html = "";
  const shouldBeRemoved = value === false || value === void 0 || value === null;
  const isPrimitive = value !== Object(value);
  if (part.endsWith("=")) {
    if (shouldBeRemoved) {
      html += `"$wcREMOVE$"`;
      return html;
    }
    if (isPrimitive) {
      html += `"${value}"`;
    } else {
      if (part.endsWith(" style=")) {
        let styleString = "";
        const styles = Object.keys(value);
        for (const key of styles) {
          let styleValue = value[key];
          let styleKey = key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
          if (typeof styleValue === "number")
            styleValue = `${styleValue}px`;
          styleString += `${styleKey}:${styleValue};`;
        }
        html += `"${styleString}"`;
      } else {
        const identifier = `$wc${ssrData.count}$`;
        html += `"${identifier}"`;
        ssrData[identifier] = value;
        ssrData.count++;
      }
    }
    return html;
  }
  if (shouldBeRemoved) {
    return html;
  }
  if (value._$wompF) {
    html += value.componentName;
    return html;
  }
  if (value._$wompChildren) {
    html += value.nodes;
    ssrData.cCounter++;
    return html;
  }
  if (isPrimitive) {
    html += value;
    return html;
  }
  if (Array.isArray(value)) {
    for (const val of value) {
      html += handleSsValue(part, val, ssrData);
    }
    return html;
  }
  if (value._$wompHtml) {
    return generateSsHtml(value, ssrData);
  }
  return html;
};
//! Find weak points (e.g. if you put a ">" in the attributes).
//! Dynamic composed attr doesnt work on custom elements (e.g. title="N. ${counter}")
//! Deeply test ALL Regexes: putting line breaks, and stuff.
//! Maybe review the CSS Generation. Is it OK?
//# sourceMappingURL=index.js.map
