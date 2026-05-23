declare global {
    interface Window {
        __WOMPRO_ISLANDS?: Record<string, string>;
    }
}
/** Hydrate every island found under `root`. Idempotent: re-running on a tree that's already
 * hydrated is a no-op (the `data-wompo-island` attribute is removed once hydration completes). */
export declare function hydrate(root?: Document | Element): void;
export default hydrate;
