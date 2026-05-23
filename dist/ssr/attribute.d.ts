/** Result of evaluating an attribute interpolation against a native element. */
export type AttrEmit = string | null;
/** Format a plain `name=value` for emission on a native element. Returns null when it should be
 * omitted (falsy non-zero values, or non-primitive values).
 */
export declare function formatPlainAttr(name: string, value: unknown): AttrEmit;
/** Format a `?name=value` boolean attribute. */
export declare function formatBooleanAttr(name: string, value: unknown): AttrEmit;
/** style="…" string from an object {key: value}, kebab-casing keys and adding px to numbers. */
export declare function styleObjectToString(value: Record<string, unknown>): string;
/** Convert a camelCase attribute name to kebab-case (matches client behavior on custom elements). */
export declare function toKebab(name: string): string;
/** Convert a kebab-case attribute name to camelCase (used when assembling component props). */
export declare function toCamel(name: string): string;
/** True if a value can be safely serialized as an HTML attribute (primitive, non-null). */
export declare function isAttrSerializable(v: unknown): boolean;
