import { html, defineWompo, useEffect, useRef, useState, attrs } from 'wompo';

const ok = (results, label, cond, detail = '') => results.push({ label, ok: !!cond, detail });

// A small inner component used to verify spread on a custom element.
function AttrsTarget({ label, count }) {
  // Use safe placeholders, NOT inline text like `count=${count}` — the wompo parser would
  // mis-identify `name=` followed by ${} as an attribute even when it sits in text content.
  const safeLabel = label == null ? 'NONE' : String(label);
  const safeCount = count == null ? 'NONE' : String(count);
  return html`<span data-label=${safeLabel} data-count=${safeCount}>span</span>`;
}
defineWompo(AttrsTarget, { name: 'attrs-target' });

export default function TestAttrs() {
  const [phase, setPhase] = useState(0);
  const [results, setResults] = useState([]);
  const clickCount = useRef(0);

  const buttonRef = useRef();
  const inputRef = useRef();
  const customRef = useRef();
  const phase0Done = useRef(false);

  const onClick = () => {
    clickCount.current++;
  };

  const bag0 = { a: '1', b: 'two', disabled: true };
  const bag1 = { b: 'changed', disabled: false };
  const currentBag = phase === 0 ? bag0 : bag1;

  const main = attrs({ ...currentBag, '@click': onClick });
  const extra = attrs({ c: 'three' });
  const inputAttrs = attrs({ '.value': 'hello', placeholder: 'type here' });
  const customAttrs = attrs({ label: 'ciao', count: 7 });

  useEffect(() => {
    const out = [];
    const btn = buttonRef.current;
    const inp = inputRef.current;
    const cust = customRef.current;

    if (phase === 0) {
      if (phase0Done.current) return;
      phase0Done.current = true;

      ok(out, 'plain attribute a', btn.getAttribute('a') === '1');
      ok(out, 'plain attribute b', btn.getAttribute('b') === 'two');
      ok(out, 'boolean true -> present', btn.hasAttribute('disabled'));
      ok(out, 'second spread attribute c', btn.getAttribute('c') === 'three');
      ok(out, 'static attribute data-static', btn.getAttribute('data-static') === 'yes');
      ok(out, 'inline attribute title', btn.getAttribute('title') === 'inline');
      ok(out, 'property .value', inp.value === 'hello');
      ok(out, 'spread placeholder', inp.getAttribute('placeholder') === 'type here');

      // Click verification: dispatch a real MouseEvent (works reliably from within microtasks).
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      ok(out, 'event @click fired twice', clickCount.current === 2, `count=${clickCount.current}`);

      // Custom element initial props: check the rendered <span> children.
      const span = cust.querySelector('span');
      ok(out, 'custom el initial prop "label"', span?.getAttribute('data-label') === 'ciao');
      ok(out, 'custom el initial prop "count"', span?.getAttribute('data-count') === '7');

      setResults(out);
      queueMicrotask(() => setPhase(1));
    } else {
      ok(out, 'removed attribute a', !btn.hasAttribute('a'));
      ok(out, 'changed attribute b', btn.getAttribute('b') === 'changed');
      ok(out, 'boolean false -> removed', !btn.hasAttribute('disabled'));
      ok(out, 'kept c from second spread', btn.getAttribute('c') === 'three');
      setResults((r) => [...r, ...out]);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 1) return;
    const total = results.length;
    const passed = results.filter((r) => r.ok).length;
    console.group(`attrs() tests — ${passed}/${total} passed`);
    for (const r of results) {
      if (r.ok) console.log('%c ok ', 'background:#0a0;color:#fff', r.label);
      else console.error('FAIL', r.label, r.detail);
    }
    console.groupEnd();
  }, [results, phase]);

  return html`<section style="padding: 16px; border: 1px solid #888; margin: 8px;">
    <h3>attrs() smoke tests (phase ${phase})</h3>
    <button ref=${buttonRef} data-static="yes" ${main} ${extra} title="inline">click me</button>
    <br /><br />
    <input ref=${inputRef} ${inputAttrs} />
    <br /><br />
    <${AttrsTarget} ref=${customRef} ${customAttrs} />
    <ul>
      ${results.map((r) => html`<li>${r.ok ? 'ok' : 'FAIL'} — ${r.label}</li>`)}
    </ul>
  </section>`;
}

defineWompo(TestAttrs, { name: 'test-attrs' });
