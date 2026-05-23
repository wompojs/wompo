/* CSS collection + dedup for SSR.
 *
 * As the serializer renders components it pushes each unique component into
 * `ctx.usedComponents`. This module turns that registry into a deduplicated map of
 * `componentName -> generatedCSS` and produces a single `<style>` block ready to inject
 * inline (default) or hand off to the framework for extraction into a separate `.css` file.
 *
 * Shadow vs light DOM:
 *   - shadow:  the component's CSS is already emitted inside its declarative `<template
 *              shadowrootmode>` (the browser scopes it). It should NOT be inlined at the page
 *              level — including it twice is wasteful, but the inline `<style>` is still safe
 *              because shadow scoping isolates it. We expose `shadowSelector: 'exclude' | 'include'`
 *              (default `exclude`) so the framework can pick.
 *   - light:   `__generateSpecifcStyles` produces selectors prefixed with the component name
 *              (e.g. `my-counter__primary`), so dedup-by-component-name is sufficient.
 */
import type { WompoComponent } from '../wompo.js';

export interface CollectCssOptions {
  /** When `'exclude'` (default), shadow-DOM components' CSS is omitted from the inline block
   * (it's already in the shadow root). When `'include'`, it's emitted anyway. */
  shadow?: 'include' | 'exclude';
}

/** Build a `componentName -> css` map from used components, applying shadow rules. */
export function collectCss(
  usedComponents: Map<string, WompoComponent>,
  opts: CollectCssOptions = {},
): Map<string, string> {
  const shadow = opts.shadow ?? 'exclude';
  const out = new Map<string, string>();
  for (const [name, comp] of usedComponents) {
    const css = comp.options?.generatedCSS;
    if (!css) continue;
    if (shadow === 'exclude' && comp.options?.shadow) continue;
    out.set(name, css);
  }
  return out;
}

/** Concatenate component CSS into a single string, separated by newlines. */
export function joinCss(map: Map<string, string>): string {
  if (map.size === 0) return '';
  const parts: string[] = [];
  for (const [name, css] of map) {
    parts.push(`/* ${name} */\n${css}`);
  }
  return parts.join('\n');
}

/** Produce a `<style>` block for inlining into the rendered HTML. Returns empty string when there
 * is no CSS to emit. Accepts an optional CSP nonce. */
export function renderInlineStyleBlock(
  map: Map<string, string>,
  nonce?: string,
): string {
  const body = joinCss(map);
  if (!body) return '';
  const nonceAttr = nonce ? ` nonce="${nonce.replace(/"/g, '&quot;')}"` : '';
  return `<style data-wompo-css${nonceAttr}>${body}</style>`;
}
