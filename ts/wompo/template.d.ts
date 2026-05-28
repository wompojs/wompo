import { Dynamics } from './dynamics.js';
import type { Dependency, RenderHtml } from './types.js';
/**
 * The CachedTemplate class is used to efficiently render components. The template HTML element is
 * stored here and only cloned when a new component is instantiated.
 */
export declare class CachedTemplate {
    template: HTMLTemplateElement;
    dependencies: Dependency[];
    /** Indices where the template has an element with no walker-visible children. Used by
     * `adopt()` to skip over unexpected descendants the live DOM may have grown after SSR. */
    leafElementIndices: Set<number>;
    constructor(template: HTMLTemplateElement, dependencies: Dependency[], leafElementIndices: Set<number>);
    /**
     * Hydration variant of `clone()`. Walks an existing DOM subtree (an SSR-rendered host element)
     * and constructs the same `Dynamics[]` it would have produced from a freshly cloned fragment —
     * but with each Dynamic pointing at the existing DOM nodes.
     *
     * Relies on the SSR emitting `<!--w-->` / `<!--/w-->` marker comments around every node-position
     * interpolation. ATTR/TAG/ATTRS dependencies use the existing element directly.
     *
     * When a NODE region is found, the walker is advanced past its end marker so subsequent
     * dependencies resync with the template's walk order. Mismatches (missing markers or
     * structural drift) throw `HydrationMismatch`, which the component class catches and falls
     * back to destructive re-render.
     */
    adopt(rootElement: Element): Dynamics[];
    /**
     * Clone the cached template and build the Dynamics metadata used by __setValues to apply values
     * to the DOM. NODE-dependency empty boundary comments are swapped with invisible text nodes
     * after the walker is done — replacing them mid-iteration would make the walker skip nodes.
     */
    clone(): [DocumentFragment, Dynamics[]];
}
/** Thrown by `CachedTemplate.adopt()` when the existing DOM doesn't match the expected template
 * structure. The caller (component class hydration entry) traps this and falls back to a
 * destructive re-render. */
export declare class HydrationMismatch extends Error {
    _$wompoHydrationMismatch: boolean;
    constructor(message: string);
}
/**
 * Stores the processed value of a nested `html` / `svg` interpolation. Lets the renderer keep
 * track of the same kind of caching used by every component.
 */
export declare class HtmlProcessedValue {
    values: any[];
    parts: TemplateStringsArray;
    template: [DocumentFragment, Dynamics[]];
    index: number;
    renderHtml: RenderHtml;
    key?: string;
    constructor(render: RenderHtml, template: [DocumentFragment, Dynamics[]], index: number);
}
/**
 * Builds the static HTML string used to populate a `<template>`, replacing dynamic interpolations
 * with markers that __createDependencies will then read back.
 */
export declare const __createHtml: (parts: TemplateStringsArray) => [string, string[]];
/**
 * Walks the just-built template content and extracts the dependency metadata that __setValues uses
 * to efficiently update the DOM on each render.
 */
export declare const __createDependencies: (template: HTMLTemplateElement, parts: TemplateStringsArray, attributes: string[]) => Dependency[];
/** Create a new CachedTemplate for a given RenderHtml. */
export declare const __createTemplate: (html: RenderHtml) => CachedTemplate;
/** True if two RenderHtml objects describe the same template. */
export declare const __areSameTemplates: (newTemplate: RenderHtml, oldTemplate: RenderHtml) => boolean;
