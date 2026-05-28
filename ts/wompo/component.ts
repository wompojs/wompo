/* Factory that turns a WompoComponent function into the custom-element class. */
import { DEV_MODE, adoptedStyles } from './constants.js';
import { DynamicNode, WompoChildren } from './dynamics.js';
import { observeRoot } from './mutation-observer.js';
import { CachedTemplate, HydrationMismatch, __createTemplate } from './template.js';
import { __setValues } from './render.js';
import { findSuspense } from './suspense-utils.js';
import {
  resetHookIndex,
  setCurrentRenderingComponent,
} from './render-context.js';
import type {
  AsyncHook,
  EffectHook,
  Hook,
  RenderHtml,
  WompoComponent,
  WompoComponentOptions,
  WompoElement,
  WompoElementClass,
  WompoProps,
} from './types.js';
import { html } from './public-api.js';

export const _$wompo = <Props extends WompoProps, E>(
  Component: WompoComponent,
  options: WompoComponentOptions,
): WompoElementClass<Props, E> => {
  const { generatedCSS, styles } = Component.options;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(generatedCSS);
  const Constructor = HTMLElement;
  const WompoComponentClass = class extends Constructor implements WompoElement {
    static _$wompo = true;
    static componentName = options.name;
    static _$cachedTemplates: Map<TemplateStringsArray, CachedTemplate> = new Map();

    static _$getOrCreateTemplate(html: RenderHtml) {
      let template = this._$cachedTemplates.get(html.parts);
      if (!template) {
        template = __createTemplate(html);
        this._$cachedTemplates.set(html.parts, template);
      }
      return template;
    }

    public _$wompo: true = true;

    public props: WompoProps = {};
    public hooks: Hook[] = [];
    public _$measurePerf: boolean = false;
    public _$initialProps: WompoProps = {} as any;
    public _$usesContext: boolean = false;
    public _$hasBeenMoved: boolean = false;
    public _$layoutEffects: EffectHook[] = [];
    public _$effects: EffectHook[] = [];
    public _$asyncCalls: AsyncHook<any>[] = [];
    public _$suspendedAsyncCalls: AsyncHook<any>[] = [];

    private __ROOT: this | ShadowRoot;
    private __dynamics: any[];
    public _$updating: boolean = false;
    private __oldValues: any[] = [];
    public _$portals: DynamicNode[] = [];
    private __isInitializing: boolean = true;
    private __connected: boolean = false;
    private __disconnected: boolean = false;
    private __isInDOM: boolean = false;
    /** When true, the first render adopts the existing DOM instead of cloning the template. */
    public __isHydrating: boolean = false;

    constructor() {
      super();
    }

    /** Hydration entry: seed initial props, mark this instance as hydrating, and run the normal
     * connection flow. If the existing DOM doesn't match the expected structure, we fall back
     * to a destructive client re-render with a console warning. */
    public _$hydrate(element: HTMLElement, initialProps: WompoProps): void {
      this._$initialProps = initialProps;
      this.__isHydrating = true;
      // The element passed in IS this instance — we mark and rely on connectedCallback to run
      // when the upgrader is attached. If already connected (the SSR'd element was upgraded
      // before hydrate() was called), kick off __initElement now.
      if (this.isConnected && !this.__connected) this.__initElement();
    }

    connectedCallback() {
      if (this.__disconnected && this.isConnected) {
        this.__disconnected = false;
        for (const hook of this.hooks) {
          if ((hook as EffectHook)?.callback) {
            Promise.resolve().then(() => {
              (hook as EffectHook).callback();
            });
          }
        }

        if (this._$suspendedAsyncCalls.length) {
          const suspense = findSuspense(this);
          const promises: Promise<any>[] = [];
          for (const asyncHook of this._$suspendedAsyncCalls) {
            if (asyncHook.activateSuspense) suspense?.addSuspense(this);
            promises.push(
              asyncHook.asyncCallback().then((data) => {
                asyncHook.value = data;
              }),
            );
          }
          this._$suspendedAsyncCalls = [];
          Promise.all(promises).then(() => {
            this.requestRender();
            suspense?.removeSuspense(this);
          });
        }

        this._$hasBeenMoved = true;
        if (this._$usesContext) this.requestRender();
      }
      this.__isInDOM = true;
      if (!this.__connected && this.isConnected) {
        // Two SSR-aware skip paths:
        //  - `data-wompo-island`: the hydrate runtime will call `_$hydrate()` later; that's
        //    where we set `__isHydrating` + run `__initElement` in adopt mode.
        //  - `data-wompo-ssr` (without an island marker): this is a non-island Wompo component
        //    that the SSR already rendered. We must NOT re-run `__initElement` here, because
        //    that would clone the template and append it next to the existing children —
        //    duplicating the entire subtree (header inside header, etc.). We mark the instance
        //    as static-from-SSR and return.
        if (this.hasAttribute('data-wompo-island')) return;
        if (this.hasAttribute('data-wompo-ssr')) {
          // Treat the element as already-initialized. Effects + event handlers don't fire
          // (non-islands have no client behavior); the SSR'd DOM is the final DOM.
          this.__connected = true;
          this.removeAttribute('data-wompo-ssr');
          return;
        }
        this.__initElement();
      }
    }

    disconnectedCallback() {
      if (this.__connected) {
        this.__isInDOM = false;
        Promise.resolve().then(() => {
          if (!this.__isInDOM) {
            this.onDisconnected();
            this.__disconnected = true;
            for (const hook of this.hooks) {
              if ((hook as EffectHook)?.cleanupFunction) (hook as any).cleanupFunction();
            }
            for (const portal of this._$portals) {
              portal.dispose();
            }
          } else {
            this._$hasBeenMoved = true;
            if (this._$usesContext) this.requestRender();
          }
        });
      }
    }

    public adoptedCallback() {
      Object.setPrototypeOf(this, WompoComponentClass.prototype);

      const style = document.createElement('style');
      style.textContent = generatedCSS;

      const componentName = this.nodeName.toLowerCase();
      if (!adoptedStyles[componentName]) adoptedStyles[componentName] = [];

      if (options.shadow) {
        if (!adoptedStyles[componentName].includes(this.__ROOT)) {
          adoptedStyles[componentName].push(this.__ROOT);
          (this.__ROOT as ShadowRoot).appendChild(style);
        }
      } else {
        const root = this.getRootNode();
        if (!adoptedStyles[componentName].includes(root)) {
          adoptedStyles[componentName].push(root);
          if ((root as Document).body) (root as Document).body.appendChild(style);
          else (root as Document | ShadowRoot).appendChild(style);
        }
      }
    }

    public onDisconnected() {}

    private __initElement() {
      this.__ROOT = this;
      this.props = {
        ...this.props,
        ...this._$initialProps,
        styles: styles,
      } as any;

      const componentAttributes = this.getAttributeNames();
      for (const attrName of componentAttributes) {
        let propName = attrName;
        if (propName.includes('-')) propName = propName.replace(/-(.)/g, (_, l) => l.toUpperCase());
        if (!this.props.hasOwnProperty(propName)) {
          const attrValue = this.getAttribute(attrName);
          (this.props as any)[propName] = attrValue === '' ? true : attrValue;
        }
      }

      const initialPropsKeys = Object.keys(this._$initialProps);
      for (const key of initialPropsKeys) {
        const prop = this._$initialProps[key as keyof typeof this._$initialProps];
        if (prop !== Object(prop) && (prop || (prop as any) === 0) && key !== 'title') {
          this.setAttribute(
            key.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`),
            prop.toString(),
          );
        }
      }

      if (DEV_MODE && this.props.wcPerf) this._$measurePerf = true;

      if (DEV_MODE && this._$measurePerf) console.time('First render ' + options.name);

      if (this.__isHydrating) {
        // Hydration: the SSR'd DOM is already in place. Adopt it instead of cloning.
        // - Light DOM: walk this directly.
        // - Shadow DOM: the browser automatically attaches `<template shadowrootmode>` content as
        //   shadowRoot; walk that. If no shadowRoot exists (declarative shadow DOM unsupported
        //   or component was server-rendered without it), fall back to destructive render.
        if (options.shadow) {
          if (!this.shadowRoot) {
            this.__isHydrating = false;
            this.__ROOT = this.attachShadow({ mode: 'open' });
          } else {
            this.__ROOT = this.shadowRoot;
          }
        }
        // Children: SSR baked them into the rendered tree, so we pass an empty WompoChildren.
        // The `${children}` interp position (if any) will be bound by the adopt() walk and the
        // subsequent __setValues will see "no children to insert" — leaving the SSR'd subtree.
        this.props.children = new WompoChildren([]);
      } else {
        const childNodes = this.__ROOT.childNodes;
        const childrenArray: Node[] = [];
        while (childNodes.length) {
          childrenArray.push(childNodes[0]);
          childNodes[0].remove();
        }
        const children = new WompoChildren(childrenArray);
        this.props.children = children;

        if (options.shadow && !this.shadowRoot) this.__ROOT = this.attachShadow({ mode: 'open' });
      }

      const componentName = this.nodeName.toLowerCase();
      if (!adoptedStyles[componentName]) adoptedStyles[componentName] = [];

      if (options.shadow) {
        if (!adoptedStyles[componentName].includes(this.__ROOT)) {
          adoptedStyles[componentName].push(this.__ROOT);
          (this.__ROOT as ShadowRoot).adoptedStyleSheets = [sheet];
        }
      } else {
        const root = this.getRootNode();
        if (!adoptedStyles[componentName].includes(root)) {
          adoptedStyles[componentName].push(root);
          (root as Document | ShadowRoot).adoptedStyleSheets.push(sheet);
        }
      }

      this.__render();

      this.__isInitializing = false;
      this.__connected = true;

      if (options.shadow) {
        observeRoot(this.__ROOT as ShadowRoot);
      } else {
        observeRoot(this.getRootNode() as Document | ShadowRoot);
      }

      if (DEV_MODE && this._$measurePerf) console.timeEnd('First render ' + options.name);
    }

    private __callComponent() {
      setCurrentRenderingComponent(this);
      resetHookIndex();
      const result = Component.call(this, this.props);
      let renderHtml: RenderHtml = result as RenderHtml;
      if (typeof result === 'string' || result instanceof HTMLElement) renderHtml = html`${result}`;
      return renderHtml;
    }

    private __render() {
      try {
        const renderHtml = this.__callComponent();
        if (renderHtml === null || renderHtml === undefined) {
          this.__dynamics = [];
          this.__oldValues = [];
          this.remove();
          return;
        }
        const constructor = this.constructor as typeof WompoComponentClass;
        this._$portals = [];
        if (this.__isInitializing && this.__isHydrating) {
          const template = constructor._$getOrCreateTemplate(renderHtml);
          // Remove the SSR'd <template data-wompo-props> first child (in light DOM). The walk
          // must not see it as part of the rendered tree.
          const root = this.__ROOT as Element;
          let propsTpl: ChildNode | null = root.firstChild as ChildNode | null;
          while (propsTpl) {
            if (
              propsTpl.nodeType === 1 &&
              (propsTpl as Element).tagName.toLowerCase() === 'template' &&
              (propsTpl as Element).hasAttribute('data-wompo-props')
            ) {
              propsTpl.remove();
              break;
            }
            propsTpl = propsTpl.nextSibling;
          }
          let dynamics: any[];
          try {
            dynamics = (template as CachedTemplate).adopt(root);
          } catch (err) {
            if ((err as HydrationMismatch)?._$wompoHydrationMismatch) {
              if (typeof console !== 'undefined')
                console.warn(
                  '[wompo] hydration mismatch in <' + this.tagName.toLowerCase() + '>: ' +
                    (err as Error).message + ' — falling back to client render',
                );
              this.__isHydrating = false;
              (this.__ROOT as Element).innerHTML = '';
              const [fragment, freshDynamics] = (template as CachedTemplate).clone();
              dynamics = freshDynamics;
              this.__dynamics = dynamics;
              const elaboratedValues = __setValues(
                this.__dynamics,
                renderHtml.values,
                this.__oldValues,
                this,
              );
              this.__oldValues = elaboratedValues;
              while (fragment.childNodes.length) {
                this.__ROOT.appendChild(fragment.childNodes[0]);
              }
              return this.__postRender();
            }
            throw err;
          }
          this.__dynamics = dynamics;
          const elaboratedValues = __setValues(
            this.__dynamics,
            renderHtml.values,
            this.__oldValues,
            this,
          );
          this.__oldValues = elaboratedValues;
          this.__isHydrating = false;
          return this.__postRender();
        } else if (this.__isInitializing) {
          const template = constructor._$getOrCreateTemplate(renderHtml);
          const [fragment, dynamics] = template.clone();
          this.__dynamics = dynamics;
          const elaboratedValues = __setValues(
            this.__dynamics,
            renderHtml.values,
            this.__oldValues,
            this,
          );
          this.__oldValues = elaboratedValues;
          if (!this.__isInitializing) this.__ROOT.innerHTML = '';
          while (fragment.childNodes.length) {
            this.__ROOT.appendChild(fragment.childNodes[0]);
          }
        } else {
          const oldValues = __setValues(this.__dynamics, renderHtml.values, this.__oldValues, this);
          this.__oldValues = oldValues;
        }
        this.__postRender();
      } catch (err) {
        console.error(err);
      }
    }

    /** Run layout-effects, schedule effects + useAsync work. Shared between the cloning and the
     * hydration code paths so behavior stays identical after the initial render. */
    private __postRender() {
      for (const layoutEffectHook of this._$layoutEffects) {
        layoutEffectHook.cleanupFunction = layoutEffectHook.callback();
      }
      this._$layoutEffects = [];
      Promise.resolve().then(() => {
        if (this.isConnected) {
          for (const effectHook of this._$effects) {
            effectHook.cleanupFunction = effectHook.callback();
          }
          this._$effects = [];

          if (this._$asyncCalls.length) {
            const promises: Promise<any>[] = [];
            const suspense = findSuspense(this);
            for (const asyncHook of this._$asyncCalls) {
              if (asyncHook.activateSuspense) suspense?.addSuspense(this);
              const promise = asyncHook
                .asyncCallback()
                .then((data) => {
                  asyncHook.value = data;
                })
                .catch((err) => console.error(err));
              promises.push(promise);
            }
            Promise.all(promises).then(() => {
              suspense?.removeSuspense(this);
              this.requestRender();
            });
          }
          this._$asyncCalls = [];
        } else {
          this._$suspendedAsyncCalls = this._$asyncCalls;
        }
      });
    }

    public requestRender() {
      if (!this._$updating) {
        this._$updating = true;
        Promise.resolve().then(() => {
          if (DEV_MODE && this._$measurePerf) console.time('Re-render ' + options.name);
          this.__render();
          this._$updating = false;
          this._$hasBeenMoved = false;
          if (DEV_MODE && this._$measurePerf) console.timeEnd('Re-render ' + options.name);
        });
      }
    }

    public updateProp(prop: string, value: any) {
      if ((this.props as any)[prop] !== value) {
        const isPrimitive = value !== Object(value);
        const attrName = prop.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
        if (isPrimitive && value !== undefined && value !== null && value !== false)
          this.setAttribute(attrName, value);
        else this.removeAttribute(attrName);
        (this.props as any)[prop] = value;
        if (!this.__isInitializing) {
          this.requestRender();
        }
      }
    }
  };
  return WompoComponentClass as unknown as WompoElementClass<Props, E>;
};
