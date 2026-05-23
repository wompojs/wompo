/* Client-side hydration runtime.
 *
 * Scans the document for `[data-wompo-island]` markers emitted by the SSR serializer and
 * schedules each island's hydration based on its `data-wompo-mode`:
 *   - `load`     → immediately
 *   - `idle`     → requestIdleCallback (fallback setTimeout 1ms)
 *   - `visible`  → IntersectionObserver with a 200px rootMargin
 *
 * The component class for each island must already be registered via `defineWompo` (i.e. the
 * JS chunk that defines the component has been loaded). For lazy island chunks the framework
 * registers a global `__WOMPRO_ISLANDS` map of `tagName -> moduleUrl` which we dynamic-import
 * on demand. Without that map (plain library usage), an unknown island is logged and skipped.
 */
import { registeredComponents } from './public-api.js';
import { parse as devalueParse } from '../ssr/devalue.js';
import type { WompoElement, WompoProps } from './types.js';

type IslandMode = 'load' | 'idle' | 'visible';

declare global {
  interface Window {
    __WOMPRO_ISLANDS?: Record<string, string>;
  }
}

/** Hydrate every island found under `root`. Idempotent: re-running on a tree that's already
 * hydrated is a no-op (the `data-wompo-island` attribute is removed once hydration completes). */
export function hydrate(root: Document | Element = document): void {
  const els = (root as Document | Element).querySelectorAll('[data-wompo-island]');
  for (const el of Array.from(els)) {
    const tagName = el.tagName.toLowerCase();
    const mode = (el.getAttribute('data-wompo-mode') as IslandMode | null) || 'load';
    scheduleHydrate(el as HTMLElement, tagName, mode);
  }
}

function scheduleHydrate(el: HTMLElement, tagName: string, mode: IslandMode): void {
  const run = () => hydrateOne(el, tagName);
  if (mode === 'load') {
    run();
  } else if (mode === 'idle') {
    if (typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 1);
    }
  } else if (mode === 'visible') {
    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              io.disconnect();
              run();
              break;
            }
          }
        },
        { rootMargin: '200px' },
      );
      io.observe(el);
    } else {
      run();
    }
  } else {
    run();
  }
}

function hydrateOne(el: HTMLElement, tagName: string): void {
  // Read props payload from the first <template data-wompo-props> child (light DOM).
  let propsTpl: Element | null = null;
  for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
    if (
      child.tagName.toLowerCase() === 'template' &&
      child.hasAttribute('data-wompo-props')
    ) {
      propsTpl = child;
      break;
    }
  }
  let props: WompoProps = {};
  if (propsTpl) {
    const tpl = propsTpl as HTMLTemplateElement;
    // <template> elements expose content as a DocumentFragment; serialized text content lives
    // inside `content`. Browsers move it there during HTML parsing, but the textContent of the
    // outer element is empty. Fall back to innerHTML when content is unavailable.
    let text = '';
    if (tpl.content) {
      text = tpl.content.textContent || '';
    }
    if (!text) text = tpl.textContent || '';
    if (!text) text = tpl.innerHTML || '';
    try {
      props = (devalueParse(text) as WompoProps) ?? {};
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('[wompo] island payload parse failed:', err);
      props = {};
    }
  }

  // Ensure the component class is defined. If it isn't but the framework provides a lazy
  // manifest entry, dynamic-import it and retry.
  if (!registeredComponents[tagName]) {
    const manifest = (typeof window !== 'undefined' && window.__WOMPRO_ISLANDS) || null;
    const moduleUrl = manifest ? manifest[tagName] : null;
    if (moduleUrl) {
      import(/* @vite-ignore */ moduleUrl)
        .then(() => attachAndCleanup(el, tagName, props))
        .catch((err) => console.error('[wompo] failed to load island module', tagName, err));
      return;
    }
    if (typeof console !== 'undefined')
      console.warn(
        `[wompo] island <${tagName}> is not registered. Did you import the component module?`,
      );
    return;
  }
  attachAndCleanup(el, tagName, props);
}

function attachAndCleanup(el: HTMLElement, tagName: string, props: WompoProps): void {
  if (!customElements.get(tagName)) {
    // defineWompo runs customElements.define; if it's missing, the component module wasn't
    // properly loaded for the client side.
    if (typeof console !== 'undefined')
      console.warn(`[wompo] customElements.define missing for <${tagName}>`);
    return;
  }
  // The element should already be upgraded (the class was defined before this code ran). If not,
  // upgrading is automatic — but we need to invoke our hydration hook AFTER the upgrade.
  customElements.upgrade(el);
  const wompoEl = el as WompoElement;
  if (typeof (wompoEl as any)._$hydrate === 'function') {
    (wompoEl as any)._$hydrate(el, props);
  }
  el.removeAttribute('data-wompo-island');
  el.removeAttribute('data-wompo-mode');
  el.removeAttribute('data-wompo-ssr');
}

export default hydrate;
