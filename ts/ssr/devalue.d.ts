export declare function stringify(value: unknown): string;
interface ParseOptions {
    /** Called to resolve [Action, id] entries to a callable client proxy. */
    resolveAction?: (id: string) => unknown;
}
export declare function parse(s: string, opts?: ParseOptions): unknown;
/** Marker key the serializer uses to recognize a server-action proxy. */
export declare const ACTION_KEY = "@@wompoAction";
export {};
