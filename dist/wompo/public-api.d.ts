import type { AttrsBag, Context, LazyCallbackResult, LazyResult, RenderHtml, SuspenseProps, WompoComponent, WompoComponentOptions, WompoProps } from './types.js';
/** Tagged-template for HTML interpolations. */
export declare function html(templateParts: TemplateStringsArray, ...values: any[]): RenderHtml;
/** Tagged-template for SVG interpolations. */
export declare function svg(templateParts: TemplateStringsArray, ...values: any[]): RenderHtml;
/** Builds a bag of attributes/events/properties to spread on a single element. */
export declare function attrs(entries: {
    [key: string]: any;
}): AttrsBag;
export declare const wompoDefaultOptions: WompoComponentOptions;
export declare const registeredComponents: {
    [key: string]: WompoComponent<any>;
};
export declare function defineWompo<Props extends WompoProps, E = {}>(Component: WompoComponent<Props & WompoProps>, options?: WompoComponentOptions): WompoComponent<Props & WompoProps>;
export declare const lazy: (load: () => LazyCallbackResult) => LazyResult;
export declare const unsafelyRenderString: (html: string) => RenderHtml;
export declare const createPortal: (html: RenderHtml, node: HTMLElement) => RenderHtml;
export declare const createContext: <S>(initialValue: S, providerName?: string) => Context<S>;
export declare function Suspense({ children, fallback }: SuspenseProps): RenderHtml;
