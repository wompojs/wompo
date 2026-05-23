import { html, defineWompo, useEffect, useRef, useState, attrs } from 'wompo';

const ok = (results, label, cond, detail = '') => results.push({ label, ok: !!cond, detail });

export default function TagSwitch() {
  const [tag, setTag] = useState('h1');
  const [phase, setPhase] = useState(0);
  const [results, setResults] = useState([]);
  const richRef = useRef();
  const richClicks = useRef(0);
  const richInputs = useRef(0);
  const richAttrs = attrs({ 'data-extra': 'yes' });

  useEffect(() => {
    if (phase === 0) {
      const root = document.querySelector('tag-switch');
      const out = [];
      ok(out, 'first render mounts h1', !!root.querySelector('h1'));
      ok(out, 'h1 has class "heading"', root.querySelector('h1')?.getAttribute('class') === 'heading');
      ok(out, 'h1 contains "hello"', root.querySelector('h1')?.textContent.includes('hello'));
      // Native element with many dynamic deps (event, attr, .property, ref, spread).
      const rich = richRef.current;
      ok(out, 'rich native: initial tag is div', rich?.tagName === 'DIV');
      ok(out, 'rich native: class applied', rich?.getAttribute('class') === 'rich');
      ok(out, 'rich native: data-id applied', rich?.getAttribute('data-id') === 'r-0');
      ok(out, 'rich native: spread data-extra applied', rich?.getAttribute('data-extra') === 'yes');
      ok(out, 'rich native: .innerHTML applied', rich?.innerHTML.includes('phase 0'));
      rich?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      rich?.dispatchEvent(new InputEvent('input', { bubbles: true }));
      ok(out, 'rich native: @click fired', richClicks.current === 1);
      ok(out, 'rich native: @input fired', richInputs.current === 1);
      setResults(out);
      queueMicrotask(() => {
        setTag('h2');
        setPhase(1);
      });
    } else if (phase === 1) {
      const root = document.querySelector('tag-switch');
      const out = [];
      ok(out, 'h1 is gone after swap', !root.querySelector('h1'));
      ok(out, 'h2 mounted after swap', !!root.querySelector('h2'));
      ok(out, 'h2 keeps class="heading"', root.querySelector('h2')?.getAttribute('class') === 'heading');
      ok(out, 'h2 keeps children text', root.querySelector('h2')?.textContent.includes('hello'));
      setResults((r) => [...r, ...out]);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 1) return;
    const total = results.length;
    const passed = results.filter((r) => r.ok).length;
    console.group(`tag-switch tests — ${passed}/${total} passed`);
    for (const r of results) {
      if (r.ok) console.log('%c ok ', 'background:#0a0;color:#fff', r.label);
      else console.error('FAIL', r.label, r.detail);
    }
    console.groupEnd();
  }, [results, phase]);

  const richTag = 'div';
  const onRichClick = () => { richClicks.current++; };
  const onRichInput = () => { richInputs.current++; };
  return html`<section style="padding: 16px; border: 1px solid #888; margin: 8px;">
    <h3>dynamic tag swap (phase ${phase})</h3>
    <${tag} class="heading">hello ${phase}</${tag}>
    <${richTag}
      ref=${richRef}
      class="rich"
      data-id=${'r-' + phase}
      @click=${onRichClick}
      @input=${onRichInput}
      ${richAttrs}
      .innerHTML=${`<i>phase ${phase}</i>`}
    ></${richTag}>
    <ul>
      ${results.map((r) => html`<li>${r.ok ? 'ok' : 'FAIL'} — ${r.label}</li>`)}
    </ul>
  </section>`;
}

defineWompo(TagSwitch, { name: 'tag-switch' });
