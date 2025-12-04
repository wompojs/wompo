import { useEffect, html, defineWompo, useState, unsafelyRenderString } from 'wompo';

export default function Test() {
  const [counter, setCounter] = useState(0);

  const [items, setItems] = useState([{ value: `Valore <b> iniziale</b>` }]);

  const inc = () => [setCounter(counter + 1)];

  useEffect(() => {
    console.log('rendered Test');
  }, []);

  const onInput = (e, index) => {
    const newItems = [...items];
    newItems[index].value = e.target.value || e.target.innerHTML;
    console.log(e.target.innerHTML);
    setItems(newItems);
  };

  return html`<div>
    <button @click=${inc}>${counter}</button>

    <div
      contenteditable="true"
      style="padding: 20px; border: 1px solid #505050; margin: 10px"
      @input=${(ev) => onInput(ev, 0)}
      .innerHTML=${items[0].value}
    ></div>

    ${items.map(
      (item, i) =>
        html`
          <div
            contenteditable="true"
            style="padding: 20px; border: 1px solid #505050; margin: 10px"
            @input=${{ fn: (ev) => onInput(ev, i), options: { passive: true } }}
          >
            ${unsafelyRenderString(items[0].value)}
          </div>
          <input .value=${item.value} @input=${(e) => onInput(e, i)} />
        `
    )}

    <hr />
  </div>`;
}

defineWompo(Test, { extends: 'div', name: 'test-wompo' });
