/* Attribute / property / event / boolean dispatch.
 *
 * The Wompo template syntax distinguishes four prefixes on an attribute name:
 *   - plain (`name=`)          → HTML attribute
 *   - boolean (`?name=`)       → present iff truthy
 *   - property (`.name=`)      → IDL property; server-side this only matters when the target is a
 *                                Wompo custom element (it becomes part of `_$initialProps`),
 *                                otherwise it's a no-op
 *   - event (`@name=`)         → DOM listener; server-side, no-op for native elements; on islands
 *                                it would be wired up by hydration
 *
 * `attrs()` spreads are unwrapped by the caller; each entry routes through this same helper.
 */
import { escapeAttr } from './escape.js';

/** Result of evaluating an attribute interpolation against a native element. */
export type AttrEmit = string | null;

/** Format a plain `name=value` for emission on a native element. Returns null when it should be
 * omitted (falsy non-zero values, or non-primitive values).
 */
export function formatPlainAttr(name: string, value: unknown): AttrEmit {
  if (value === false || value === null || value === undefined) return null;
  if (value === true) return ` ${name}`;
  // ref is a hook reference, not a real attribute
  if (name === 'ref') return null;
  if (name === 'wc-perf' || name === 'wcPerf') return null;
  // 'title' is preserved on the component when needed via the same pathway, but on native
  // elements it's a real attribute — we still emit it. The client runtime treats it specially
  // (`DynamicAttribute.updateValue` removes 'title' from custom elements after setting the
  // prop), but on SSR for a native element this just becomes an HTML attribute.
  if (typeof value === 'object') {
    if (name === 'style' && value && !Array.isArray(value)) {
      return ` style="${escapeAttr(styleObjectToString(value as Record<string, unknown>))}"`;
    }
    return null;
  }
  return ` ${name}="${escapeAttr(String(value))}"`;
}

/** Format a `?name=value` boolean attribute. */
export function formatBooleanAttr(name: string, value: unknown): AttrEmit {
  if (value) return ` ${name}`;
  return null;
}

/** style="…" string from an object {key: value}, kebab-casing keys and adding px to numbers. */
export function styleObjectToString(value: Record<string, unknown>): string {
  let out = '';
  for (const key in value) {
    let v = value[key];
    if (v === undefined || v === null || v === false || v === '') continue;
    const kebab = key.replace(/[A-Z]/g, (l) => '-' + l.toLowerCase());
    if (typeof v === 'number') v = `${v}px`;
    out += `${kebab}:${v};`;
  }
  return out;
}

/** Convert a camelCase attribute name to kebab-case (matches client behavior on custom elements). */
export function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (l) => '-' + l.toLowerCase());
}

/** Convert a kebab-case attribute name to camelCase (used when assembling component props). */
export function toCamel(name: string): string {
  return name.replace(/-(.)/g, (_, l) => l.toUpperCase());
}

/** True if a value can be safely serialized as an HTML attribute (primitive, non-null). */
export function isAttrSerializable(v: unknown): boolean {
  return v !== null && v !== undefined && v !== Object(v);
}
