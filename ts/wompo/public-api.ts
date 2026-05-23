/* Public surface: html/svg/attrs tag functions, defineWompo, lazy, createPortal, Suspense,
 * createContext, and the registries. */
import { IS_SERVER } from './constants.js';
import { _$wompo } from './component.js';
import { useEffect, useRef, useSelf, useExposed } from './hooks.js';
import { __generateSpecifcStyles } from './styles.js';
import type {
  AttrsBag,
  Context,
  ContextProviderExposed,
  ContextProviderProps,
  LazyCallbackResult,
  LazyResult,
  RenderHtml,
  SuspenseInstance,
  SuspenseProps,
  WompoComponent,
  WompoComponentOptions,
  WompoProps,
} from './types.js';

/** Tagged-template for HTML interpolations. */
export function html(templateParts: TemplateStringsArray, ...values: any[]): RenderHtml {
  // Values for closing dynamic tags (`</${tag}>`) are dropped so that `values` aligns 1:1 with
  // the `dependencies` produced by the parser. Multiple consecutive dynamic tags (e.g.
  // `<${a}>..</${a}> <${b}>..</${b}>`) would otherwise read the closing `a` as the opening `b`.
  // Server-side serializers consume parts directly and don't rely on this scheme.
  const cleanValues = [];
  const length = templateParts.length - 1;
  if (!IS_SERVER) {
    for (let i = 0; i < length; i++) {
      if (!templateParts[i].endsWith('</')) cleanValues.push(values[i]);
    }
  } else {
    cleanValues.push(...values);
  }
  return {
    parts: templateParts,
    values: cleanValues,
    _$wompoHtml: true,
  };
}

/** Tagged-template for SVG interpolations. */
export function svg(templateParts: TemplateStringsArray, ...values: any[]): RenderHtml {
  const renderHtml = html(templateParts, ...values);
  renderHtml._$wompoSvg = true;
  return renderHtml;
}

/** Builds a bag of attributes/events/properties to spread on a single element. */
export function attrs(entries: { [key: string]: any }): AttrsBag {
  return {
    _$wompoAttrs: true,
    entries: entries || {},
  };
}

export const wompoDefaultOptions: WompoComponentOptions = {
  shadow: false,
  name: '',
  cssModule: true,
};

export const registeredComponents: { [key: string]: WompoComponent<any> } = {};

export function defineWompo<Props extends WompoProps, E = {}>(
  Component: WompoComponent<Props & WompoProps>,
  options?: WompoComponentOptions,
) {
  if (!Component.css) Component.css = '';
  const componentOptions = {
    ...wompoDefaultOptions,
    ...(options || {}),
  };
  if (!componentOptions.name) {
    let newName = Component.name
      .replace(/.[A-Z]/g, (letter) => `${letter[0]}-${letter[1].toLowerCase()}`)
      .toLowerCase();
    if (!newName.includes('-')) newName += '-wompo';
    componentOptions.name = newName;
  }
  Component.componentName = componentOptions.name;
  Component._$wompoF = true;
  const [generatedCSS, styles] = __generateSpecifcStyles(
    Component as unknown as WompoComponent,
    componentOptions,
  );
  Component.css = generatedCSS;
  Component.options = {
    generatedCSS: generatedCSS,
    styles: styles,
    shadow: componentOptions.shadow,
    island: componentOptions.island,
  };
  if (!IS_SERVER) {
    const ComponentClass = _$wompo<Props, E>(
      Component as unknown as WompoComponent,
      componentOptions,
    );
    Component.class = ComponentClass;
    customElements.define(componentOptions.name, ComponentClass);
  }
  registeredComponents[componentOptions.name] = Component;
  return Component as WompoComponent<Props & WompoProps>;
}

export const lazy = (load: () => LazyCallbackResult): LazyResult => {
  let loaded: WompoComponent = null;
  async function LazyComponent() {
    if (!loaded) {
      try {
        const importedModule = await load();
        loaded = importedModule.default;
        return loaded;
      } catch (err) {
        console.error(err);
      }
    }
    return loaded;
  }
  LazyComponent._$wompoLazy = true;
  return LazyComponent;
};

export const unsafelyRenderString = (html: string): RenderHtml => {
  return {
    _$wompoHtml: true,
    parts: [html] as any,
    values: [],
  };
};

export const createPortal = (html: RenderHtml, node: HTMLElement): RenderHtml => {
  return {
    ...html,
    _$portal: node,
  };
};

const createContextMemo = () => {
  let contextIdentifier = 0;
  return <S>(initialValue: S, providerName?: string): Context<S> => {
    const name = providerName ?? `wompo-context-provider-${contextIdentifier}`;
    contextIdentifier++;
    const ProviderFunction = defineWompo<ContextProviderProps, ContextProviderExposed>(
      ({ children, value }: ContextProviderProps) => {
        const initialSubscribers = new Set();
        const subscribers = useRef(initialSubscribers);
        useEffect(() => {
          subscribers.current.forEach((el: any) => {
            if (el.isConnected) el.requestRender();
          });
        }, [value]);
        useExposed({ subscribers: subscribers });
        return html`${children}`;
      },
      {
        name: name,
        cssModule: false,
      },
    );
    const Context = {
      name: name,
      Provider: ProviderFunction,
      default: initialValue,
    };
    return Context;
  };
};

export const createContext = createContextMemo();

export function Suspense({ children, fallback }: SuspenseProps) {
  const self = useSelf() as unknown as SuspenseInstance;
  if (!self.loadingComponents) {
    self.loadingComponents = useRef(new Set<Node>()).current;
  }
  self.addSuspense = (node: Node) => {
    if (!self.loadingComponents.size) self.requestRender();
    self.loadingComponents.add(node);
  };
  self.removeSuspense = (node: Node, newNode: Node = null) => {
    self.loadingComponents.delete(node);
    if (newNode) {
      for (let i = 0; i < (children as any).nodes.length; i++) {
        if ((children as any).nodes[i] === node) {
          (children as any).nodes[i] = newNode;
          break;
        }
      }
    }
    if (!self.loadingComponents.size) self.requestRender();
  };
  if (self.loadingComponents.size && fallback) return html`${fallback}`;
  return html`${children}`;
}
defineWompo(Suspense, { name: 'wompo-suspense' });
