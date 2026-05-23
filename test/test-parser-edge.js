import { html, defineWompo, useEffect, useState } from 'wompo';

const ok = (results, label, cond, detail = '') => results.push({ label, ok: !!cond, detail });

export default function ParserEdge() {
  const [value, setValue] = useState('alpha');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const root = document.querySelector('parser-edge');
    const out = [];

    // The original bug: text content starting with `name=${...}` was mis-parsed as an
    // attribute when a prior attribute in the same static part was quoted.
    const target = root.querySelector('[data-target="text-eq"]');
    ok(out, 'text "prefix=alpha" rendered as text', target?.textContent.trim().includes('prefix=alpha'));
    ok(out, 'class attribute preserved', target?.getAttribute('class') === 'box');
    ok(out, 'data-target attribute preserved', target?.getAttribute('data-target') === 'text-eq');

    // The legit attribute interpolation still works alongside text with `=`.
    const mixed = root.querySelector('[data-target="mixed"]');
    ok(out, 'mixed: real attr data-real applied', mixed?.getAttribute('data-real') === 'attr-value');
    ok(out, 'mixed: text "text=alpha" preserved', mixed?.textContent.trim().includes('text=alpha'));

    setResults(out);

    const total = out.length;
    const passed = out.filter((r) => r.ok).length;
    console.group(`parser-edge tests — ${passed}/${total} passed`);
    for (const r of out) {
      if (r.ok) console.log('%c ok ', 'background:#0a0;color:#fff', r.label);
      else console.error('FAIL', r.label, r.detail);
    }
    console.groupEnd();
  }, []);

  return html`<section style="padding: 16px; border: 1px solid #888; margin: 8px;">
    <h3>parser edge: literal "=" in text content</h3>
    <div class="box" data-target="text-eq">prefix=${value}</div>
    <div class="box" data-target="mixed" data-real=${'attr-value'}>text=${value}</div>
    <ul>
      ${results.map((r) => html`<li>${r.ok ? 'ok' : 'FAIL'} — ${r.label}</li>`)}
    </ul>
  </section>`;
}

defineWompo(ParserEdge, { name: 'parser-edge' });
