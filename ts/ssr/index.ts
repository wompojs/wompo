import {
	type RenderHtml,
	type WompoComponent,
	type WompoProps,
	registeredComponents,
} from '../wompo.js';

/* 
================================================
SSR
================================================
*/
type SsrDataObject = {
	count: number;
	cCounter: number;
	components: {
		[key: string]: WompoComponent;
	};
	props: {
		[key: string]: WompoProps[];
	};
	[key: string]: any;
};

export const ssr = (Component: WompoComponent, props: WompoProps, root?: boolean) => {
	const ssrData: SsrDataObject = {
		count: 0,
		cCounter: 0,
		components: {},
		props: {},
	};
	let htmlString = ssRenderComponent(Component, props, ssrData, root);
	htmlString = htmlString.replace(/\s[a-z]+="\$wcREMOVE\$"/g, '');
	const css: { [key: string]: string } = {};
	const components = ssrData.components;
	for (const comp in components) {
		const component = components[comp];
		const compCss = component.options.generatedCSS;
		if (compCss) css[comp] = compCss.replace(/\s\s+/g, ' ').replace(/\t/g, '').replace(/\n/g, '');
	}
	return {
		html: htmlString,
		css: css,
		props: ssrData.props,
	};
};

const ssRenderComponent = (
	Component: WompoComponent,
	props: WompoProps,
	ssrData: SsrDataObject,
	root?: boolean
) => {
	let html = '';
	const { generatedCSS, styles, shadow } = Component.options;
	props.styles = styles;
	const componentName = Component.componentName;
	if (!root) {
		if (!ssrData.props[componentName]) ssrData.props[componentName] = [];
		html += `<${componentName} wompo-hydrate="${ssrData.props[componentName].length}"`;
		for (const prop in props) {
			const value = props[prop as keyof WompoProps];
			const isPrimitive = value !== Object(value);
			if (isPrimitive && prop !== 'title') html += ` ${prop}="${value}"`;
		}
		html += '>';
		// Add shadow
		if (shadow) html += `<template shadowrootmode="open">`;
		ssrData.components[componentName] = Component;
	}
	const template = Component(props);
	delete props.children; //! Maybe remove when implementing hydration
	if (!root) ssrData.props[componentName].push(props);
	// Render component
	let toRender = generateSsHtml(template, ssrData);
	console.log(toRender);
	// Replace self-closing tags
	toRender = toRender.replace(/<([a-z]*-[a-z]*)(.*?)>/gs, (match, name, attrs) =>
		match.endsWith('/>') ? `<${name}${attrs.substring(0, attrs.length - 1)}></${name}>` : match
	);
	// Search for other custom components. It'll only manage "first-level" components, not the nested
	// ones. This will allow a good control of recursion.
	let counter = 0;
	let pending: string = '';
	const components: number[] = [];
	toRender = toRender.replace(/<\/?([a-z]+?-[a-z]+?)\s?(?:\s.*?)?>/gs, (match, name) => {
		const component = registeredComponents[name];
		console.log(match);
		if (!component) return match;
		if (match[1] !== '/') {
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
					pending = '';
					components.push(components.length);
					return res;
				}
			}
		}
		return match;
	});
	// Render first-layer custom components
	for (const id of components) {
		const regex = new RegExp(
			`<([a-z]+-[a-z]+)([^>]*?)><\\?\\$CWC${id}>(.*?)<\\/\\?\\$CWC${id}>`,
			'gs'
		);
		toRender = toRender.replace(regex, (_, name, attrs, children) => {
			const Component = registeredComponents[name];
			const componentProps: WompoProps = {};
			componentProps.children = {
				_$wompoChildren: true,
				nodes: children as any,
			};
			const attributes = attrs.matchAll(/\s?(.*?)="(.*?)"/gs);
			let attr;
			while (!(attr = attributes.next()).done) {
				const [_, attrName, attrValue] = attr.value;
				if (attrValue.match(/\$wc(.*?)\$/)) {
					const value = ssrData[attrValue];
					(componentProps as any)[attrName] = value;
				} else {
					(componentProps as any)[attrName] = attrValue;
				}
			}
			return ssRenderComponent(Component, componentProps, ssrData, false);
		});
	}
	html += toRender;
	// Close shadow
	if (shadow) html += `</template>`;
	// Close component
	html += `</${componentName}>`;
	return html;
};

const generateSsHtml = (template: RenderHtml, ssrData: SsrDataObject) => {
	let html = '';
	for (let i = 0; i < template.parts.length; i++) {
		let part = template.parts[i];
		const value = template.values[i];
		html += part;
		html += handleSsValue(part, value, ssrData);
	}
	return html;
};

const handleSsValue = (part: string, value: any, ssrData: SsrDataObject) => {
	let html = '';
	const shouldBeRemoved = value === false || value === undefined || value === null;
	const isPrimitive = value !== Object(value);
	// Is attribute
	if (part.endsWith('=')) {
		if (shouldBeRemoved) {
			html += `"$wcREMOVE$"`;
			return html;
		}
		if (isPrimitive) {
			html += `"${value}"`;
		} else {
			if (part.endsWith(' style=')) {
				// If it's a style attribute and it's an object
				let styleString = '';
				const styles = Object.keys(value);
				for (const key of styles) {
					let styleValue = value[key];
					let styleKey = key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
					if (typeof styleValue === 'number') styleValue = `${styleValue}px`;
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
	// Not an attribute: it's a falsy node (to remove)
	if (shouldBeRemoved) {
		return html;
	}
	// Is Wompo Component
	if (value._$wompoF) {
		html += value.componentName;
		return html;
	}
	// Is children
	if (value._$wompoChildren) {
		html += value.nodes;
		ssrData.cCounter++;
		return html;
	}
	// Is node
	if (isPrimitive) {
		html += value;
		return html;
	}
	// Is array
	if (Array.isArray(value)) {
		for (const val of value) {
			html += handleSsValue(part, val, ssrData);
		}
		return html;
	}
	// Is template
	if (value._$wompoHtml) {
		return generateSsHtml(value, ssrData);
	}

	return html;
};

// TODO Find weak points (e.g. if you put a ">" in the attributes).
// TODO Dynamic composed attr doesnt work on custom elements (e.g. title="N. ${counter}")
// TODO Deeply test ALL Regexes: putting line breaks, and stuff.
// TODO Maybe review the CSS Generation. Is it OK?
