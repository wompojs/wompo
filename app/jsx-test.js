const jsx = (Element, attributes) => {
	const template = {
		parts: [],
		values: [],
		_$wompHtml: true,
	};
	if (Element === 'wc-fragment') {
		return attributes.children;
	} else {
		//! Hanlde womp elements
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
			template.values.push(false); // NO value
			template.parts = [...template.parts, ...children.parts];
			template.values = [...template.values, ...children.values];
			template.values.push(false); // NO value
		} else {
			template.values.push(children);
		}
		staticHtml = `</${tagName}>`;
		template.parts.push(staticHtml);
	}
	console.log(template);
	return template;
};

const Fragment = 'wc-fragment';

function Test() {
	const state = 'state';
	const setState = () => null;
	return /* @__PURE__ */ jsx(Fragment, {
		children: /* @__PURE__ */ jsx('div', {
			id: 'Ciccio',
			class: state,
			onClick: () => setState('hidden'),
			children: jsx(
				{
					_$womp: true,
					componentName: 'counter-component',
				},
				{ children: 'Test' }
			),
		}),
	});
}
Test();
