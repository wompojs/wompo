const jsx = (Element, attributes) => {
	const template = {
		parts: [],
		values: [],
		_$wompHtml: true,
	};
	if (Element === 'wc-fragment') {
		if (attributes.children.parts) {
			template.parts.push(...attributes.children.parts);
			template.values.push(...attributes.children.values);
		} else if (Array.isArray(attributes.children)) {
			for (const part of attributes.children) {
				template.parts.push(...part.parts);
				template.values.push(...part.values);
				template.values.push(false);
			}
			template.values.pop();
		}
	} else {
		let tagName = Element;
		if (Element._$womp) tagName = Element.componentName;
		let staticHtml = `<${tagName}`;
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
			// Children is alway the last key
		}
		staticHtml += '>';
		template.parts.push(staticHtml);
		const children = attributes.children;
		if (children && children.parts) {
			if (attributes.children.parts) {
				template.values.push(false); // NO value
				template.parts.push(...attributes.children.parts);
				template.values.push(attributes.children.values);
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
		staticHtml = `</${tagName}>`;
		template.parts.push(staticHtml);
	}
	return template;
};

const Fragment = 'wc-fragment';

const jsxs = jsx;

function Test() {
	const counter = 'state';
	const setCounter = () => null;
	return /* @__PURE__ */ jsxs(Fragment, {
		children: [
			/* @__PURE__ */ jsx('button', { onClick: () => setCounter(counter - 1), children: '-' }),
			/* @__PURE__ */ jsx('span', { children: counter }),
			/* @__PURE__ */ jsx('button', { onClick: () => setCounter(counter + 1), children: '+' }),
		],
	});
}
Test();
