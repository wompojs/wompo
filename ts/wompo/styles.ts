/* CSS-module style generation: prefixes user-provided classes with a unique component name. */
import { DEV_MODE } from './constants.js';
import type { WompoComponent, WompoComponentOptions } from './types.js';

export const __generateSpecifcStyles = (
  component: WompoComponent,
  options: WompoComponentOptions,
): [string, { [className: string]: string }] => {
  const { css } = component;
  const { shadow, name, cssModule } = options;
  const componentName = name;
  const classes: { [key: string]: string } = {};
  let generatedCss = css;
  if (cssModule) {
    if (!css.includes(':host'))
      generatedCss = `${shadow ? ':host' : componentName} {display:block;} ${css}`;
    if (DEV_MODE) {
      const invalidSelectors: string[] = [];
      [...generatedCss.matchAll(/.*?}([\s\S]*?){/gm)].forEach((selector) => {
        const cssSelector = selector[1].trim();
        if (!cssSelector.match(/\.|:host|@/)) invalidSelectors.push(cssSelector);
      });
      invalidSelectors.forEach((selector) => {
        console.warn(
          `The CSS selector "${selector} {...}" in the component "${componentName}" is not enough` +
            ` specific: include at least one class or deactive the "cssModule" option on the component.`,
        );
      });
    }
    if (!shadow) generatedCss = generatedCss.replace(/:host/g, componentName);
    generatedCss = generatedCss.replace(/\.(?!\d)([_a-zA-Z0-9-]+)/gm, (_, className) => {
      const uniqueClassName = `${componentName}__${className}`;
      classes[className] = uniqueClassName;
      return `.${uniqueClassName}`;
    });
  }
  return [generatedCss, classes];
};
