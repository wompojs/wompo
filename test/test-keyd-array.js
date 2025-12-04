import { defineWompo, html, useMemo, useState } from 'wompo';

export default function ListComponent({ styles: s }) {
  const [values, setValue] = useState([]);

  const addAbove = () => {
    const randomImageId = Math.floor(Math.random() * 500);
    const newItem = {
      key: crypto.randomUUID(),
      props: {
        title: `Item #${values.length + 1}`,
        img: `https://picsum.photos/id/${randomImageId}/5000/3000`,
      },
    };
    const newValues = [newItem, ...values];
    setValue(newValues);
  };

  const getItem = (item) => {
    return html`<div>
      <img src=${item.props.img} />
    </div>`;
  };

  const optimizedItems = useMemo(() => {
    return values.map((item) => {
      const htmlItem = getItem(item);
      htmlItem.key = item.key;
      return htmlItem;
    });
  }, [values]);

  const items = useMemo(() => {
    return values.map((item, i) => {
      const htmlItem = getItem(item);
      return htmlItem;
    });
  }, [values]);

  return html`
    <button @click=${addAbove}>Add in the middle</button>

    <div class=${s.test}>
      <div class=${s.optimized}>
        <h2 style="width: 100%">Optimized with keys</h2>
        ${optimizedItems}
      </div>

      <div class=${s.normal}>
        <h2 style="width: 100%">Normal array</h2>
        ${items}
      </div>
    </div>
  `;
}

ListComponent.css = `
  .test {
    display: flex;
    gap: 20px;
  }
  .test img {
    width: 100px;
    height: 100px;
    object-fit: cover;
  }
  .optimized, .normal {
    width: 50%;
    display: flex;
    flex-wrap: wrap;
  }
`;

defineWompo(ListComponent, { name: 'test-keyd-array' });
