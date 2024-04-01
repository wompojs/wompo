import { type RenderHtml } from './ts/wompo';
/** JSX Fragment */
export declare const Fragment = "wc-fragment";
export declare const jsx: (Element: any, attributes: {
    [key: string]: any;
}) => {
    parts: string[];
    values: any[];
    _$wompoHtml: true;
} | RenderHtml;
export declare const jsxs: (Element: any, attributes: {
    [key: string]: any;
}) => {
    parts: string[];
    values: any[];
    _$wompoHtml: true;
} | RenderHtml;
export declare const jsxDEV: (Element: any, attributes: {
    [key: string]: any;
}) => {
    parts: string[];
    values: any[];
    _$wompoHtml: true;
} | RenderHtml;
