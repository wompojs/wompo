const u = (p, r) => {
	const s = { parts: [], values: [], _$wompoHtml: !0 };
	let e = p;
	p._$wompoLazy
		? ((e = ''), s.parts.push('<'), s.values.push(p))
		: p._$wompoF
		? (e = p.componentName)
		: p === Fragment && (e = '');
	let a = e ? `<${e}` : '';
	const n = Object.keys(r);
	for (const o of n) {
		if (o === 'children') break;
		const t = o.match(/^on([A-Z].*)/);
		t ? (a += ` @${t[1].toLowerCase()}=`) : (a += ` ${o}=`),
			s.parts.push(a),
			s.values.push(r[o]),
			(a = '');
	}
	if (['br', 'img'].includes(e)) return (a += '/>'), s.parts.push(a), s;
	(a += e || p._$wompoLazy ? '>' : ''), s.parts.push(a);
	const l = r.children;
	if (l && l.parts) {
		if (r.children.parts)
			s.values.push(!1),
				s.parts.push(...r.children.parts),
				s.values.push(...r.children.values),
				s.values.push(!1);
		else if (Array.isArray(r.children))
			for (const o of r.children)
				s.values.push(!1), s.parts.push(...o.parts), s.values.push(...o.values), s.values.push(!1);
	} else s.values.push(l);
	return (a = e ? `</${e}>` : ''), p._$wompoLazy && (a = '</wc-wc>'), s.parts.push(a), s;
};
export const Fragment = 'wc-fragment',
	jsx = u,
	jsxs = jsx,
	jsxDEV = jsx;
