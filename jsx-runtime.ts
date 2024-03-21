import { type RenderHtml } from './ts/womp';

/* 
================================================
JSX
================================================
*/
/**
 * This function enables to use JSX to create Womp Components. It'll simply re-create the
 * functioning of the `html` tag template function, and will return a RenderHtml object.
 *
 * Note: Using JSX will have a small drop in performances: since with JSX you cannot know which are
 * the dynamic parts in a component, everything will be re-rendered.
 *
 * @param Element The tag name or custom element function.
 * @param attributes The attributes (props).
 * @returns A RenderHtml.
 */
const wJsx = (Element: any, attributes: { [key: string]: any }) => {
	const template = {
		parts: [],
		values: [],
		_$wompHtml: true,
	} as { parts: string[]; values: any[]; _$wompHtml: true };
	let tagName = Element;
	if (Element._$wompF) tagName = Element.componentName;
	else if (Element === Fragment) tagName = '';
	let staticHtml = tagName ? `<${tagName}` : '';
	const attrNames = Object.keys(attributes);
	for (const attrName of attrNames) {
		if (attrName === 'children') {
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
		staticHtml = '';
		// Children is always the last key
	}
	staticHtml += tagName ? '>' : '';
	template.parts.push(staticHtml);
	const children = attributes.children;
	if (children && children.parts) {
		if (attributes.children.parts) {
			template.values.push(false); // NO value
			template.parts.push(...attributes.children.parts);
			template.values.push(...attributes.children.values);
			template.values.push(false); // NO value
		} else if (Array.isArray(attributes.children)) {
			for (const part of attributes.children) {
				template.values.push(false); // NO value
				template.parts.push(...part.parts);
				template.values.push(...part.values);
				template.values.push(false); // NO value
			}
		}
	} else {
		template.values.push(children);
	}
	staticHtml = tagName ? `</${tagName}>` : '';
	template.parts.push(staticHtml);
	// }
	return template as unknown as RenderHtml;
};
/** JSX Fragment */
export const Fragment = 'wc-fragment';

export const jsx = wJsx;

export const jsxs = jsx;

export const jsxDEV = jsx;
