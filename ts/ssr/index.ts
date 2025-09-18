import {
        type RenderHtml,
        type WompoComponent,
        type WompoElement,
        type WompoProps,
        registeredComponents,
        pushRenderingContext,
        popRenderingContext,
        html,
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

const singleValueTemplate = (() => {
        const template = ['', ''];
        (template as any).raw = ['', ''];
        return template as unknown as TemplateStringsArray;
})();

const wrapAsRenderHtml = (value: any): RenderHtml => html(singleValueTemplate, value);

const isRenderHtml = (value: any): value is RenderHtml => Boolean(value?._$wompoHtml);

const createServerComponent = (props: WompoProps): WompoElement => {
        const serverComponent = {
                props,
                hooks: [],
                _$effects: [],
                _$layoutEffects: [],
                _$asyncCalls: [],
                _$suspendedAsyncCalls: [],
                _$portals: [],
                _$usesContext: false,
                _$hasBeenMoved: false,
                _$measurePerf: false,
                _$initialProps: props,
                requestRender() {},
                onDisconnected() {},
                updateProp() {},
        } as Partial<WompoElement>;
        return serverComponent as WompoElement;
};

const HYDRATION_IGNORED_PROPS = new Set(['children', 'styles', 'ref']);

const isDomLikeNode = (value: any): value is Node => {
        if (!value || typeof value !== 'object') return false;
        if (typeof Node !== 'undefined' && value instanceof Node) return true;
        const maybeNode = value as { nodeType?: unknown; nodeName?: unknown };
        return typeof maybeNode.nodeType === 'number' && typeof maybeNode.nodeName === 'string';
};

const sanitizeHydrationValue = (value: any, seen: WeakSet<object>): any => {
        if (value === null) return null;
        const valueType = typeof value;

        if (valueType === 'string' || valueType === 'boolean') return value;
        if (valueType === 'number') return Number.isFinite(value) ? value : null;
        if (valueType === 'bigint') return value.toString();
        if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol') return undefined;

        if (value instanceof String || value instanceof Number || value instanceof Boolean)
                return sanitizeHydrationValue(value.valueOf(), seen);

        if (value instanceof Date) return value.toJSON();
        if (value instanceof RegExp) return value.toString();
        if (value instanceof Error)
                return {
                        name: value.name,
                        message: value.message,
                        stack: value.stack,
                };

        if (typeof value === 'object') {
                if (typeof (value as Promise<unknown>)?.then === 'function') return undefined;
                if ((value as { _$wompoHtml?: unknown; _$wompoF?: unknown; _$wompoChildren?: unknown })._$wompoHtml)
                        return undefined;
                if ((value as { _$wompoF?: unknown })._$wompoF) return undefined;
                if ((value as { _$wompoChildren?: unknown })._$wompoChildren) return undefined;

                const jsonable = value as { toJSON?: () => unknown };
                if (typeof jsonable.toJSON === 'function') {
                        try {
                                const jsonValue = jsonable.toJSON();
                                if (jsonValue !== value) return sanitizeHydrationValue(jsonValue, seen);
                        } catch {
                                return undefined;
                        }
                }

                if (Array.isArray(value)) {
                        if (seen.has(value)) return undefined;
                        seen.add(value);
                        const arr: any[] = [];
                        for (const item of value) {
                                const sanitizedItem = sanitizeHydrationValue(item, seen);
                                if (sanitizedItem !== undefined) arr.push(sanitizedItem);
                        }
                        seen.delete(value);
                        return arr;
                }

                if (typeof ArrayBuffer !== 'undefined') {
                        if (ArrayBuffer.isView(value)) {
                                if (value instanceof DataView) {
                                        const view = value as DataView;
                                        const bytes = new Uint8Array(
                                                view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
                                        );
                                        return Array.from(bytes);
                                }
                                return Array.from(value as unknown as ArrayLike<number>);
                        }
                        if (value instanceof ArrayBuffer) {
                                return Array.from(new Uint8Array(value));
                        }
                }

                if (value instanceof Map) {
                        if (seen.has(value)) return undefined;
                        seen.add(value);
                        const entries: any[] = [];
                        for (const [mapKey, mapValue] of value.entries()) {
                                const sanitizedKey = sanitizeHydrationValue(mapKey, seen);
                                const sanitizedValue = sanitizeHydrationValue(mapValue, seen);
                                if (sanitizedKey !== undefined && sanitizedValue !== undefined)
                                        entries.push([sanitizedKey, sanitizedValue]);
                        }
                        seen.delete(value);
                        return entries;
                }

                if (value instanceof Set) {
                        if (seen.has(value)) return undefined;
                        seen.add(value);
                        const items: any[] = [];
                        for (const setValue of value.values()) {
                                const sanitizedSetValue = sanitizeHydrationValue(setValue, seen);
                                if (sanitizedSetValue !== undefined) items.push(sanitizedSetValue);
                        }
                        seen.delete(value);
                        return items;
                }

                if (isDomLikeNode(value)) return undefined;

                if (seen.has(value)) return undefined;
                seen.add(value);
                const result: Record<string, any> = {};
                for (const key of Object.keys(value)) {
                        const sanitizedChild = sanitizeHydrationValue((value as Record<string, any>)[key], seen);
                        if (sanitizedChild !== undefined) result[key] = sanitizedChild;
                }
                seen.delete(value);
                return result;
        }

        return undefined;
};

const sanitizeHydrationProps = (props: WompoProps): WompoProps => {
        const sanitized: Record<string, any> = {};
        const seen = new WeakSet<object>();
        for (const key in props) {
                if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
                if (HYDRATION_IGNORED_PROPS.has(key)) continue;
                const value = (props as Record<string, any>)[key];
                const sanitizedValue = sanitizeHydrationValue(value, seen);
                if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue;
        }
        return sanitized as WompoProps;
};

export const ssr = (Component: WompoComponent, props: WompoProps) => {
        const ssrData: SsrDataObject = {
                count: 0,
                cCounter: 0,
		components: {},
		props: {},
	};
	let htmlString = ssRenderComponent(Component, props, ssrData);
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
        incomingProps: WompoProps,
        ssrData: SsrDataObject
) => {
        let html = '';
        const { generatedCSS, styles, shadow } = Component.options;
        const componentProps: WompoProps = {
                ...incomingProps,
                styles,
        };
        const componentName = Component.componentName;
        if (!ssrData.props[componentName]) ssrData.props[componentName] = [];
        const hydrateIndex = ssrData.props[componentName].length;
        html += `<${componentName} wompo-hydrate="${hydrateIndex}"`;
        for (const prop in componentProps) {
                if (!Object.prototype.hasOwnProperty.call(componentProps, prop)) continue;
                if (prop === 'children' || prop === 'styles' || prop === 'ref') continue;
                if (prop.startsWith('on')) continue;
                const value = componentProps[prop as keyof WompoProps];
                const isPrimitive = value !== Object(value);
                if (typeof value === 'function') continue;
                if (isPrimitive && prop !== 'title') html += ` ${prop}="${value}"`;
        }
        html += '>';
        // Add shadow
        if (shadow) html += `<template shadowrootmode="open">`;
        // Append styles
        if (generatedCSS) html += `<link rel="stylesheet" href="/${componentName}.css" />`;
        ssrData.components[componentName] = Component;
        const serverComponent = createServerComponent(componentProps);
        const snapshot = pushRenderingContext(serverComponent);
        let templateResult: RenderHtml | string | null;
        try {
                templateResult = Component.call(serverComponent as any, componentProps);
        } finally {
                popRenderingContext(snapshot);
        }
        if (templateResult === null || templateResult === undefined) return '';
        const template = isRenderHtml(templateResult)
                ? templateResult
                : wrapAsRenderHtml(templateResult);
        ssrData.props[componentName].push(sanitizeHydrationProps(componentProps));
        // Render component
        let toRender = generateSsHtml(template, ssrData);
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
			return ssRenderComponent(Component, componentProps, ssrData);
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
