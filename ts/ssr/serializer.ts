/* Core SSR serializer.
 *
 * Walks `RenderHtml` (parts + values) and produces an HTML string. The HTML parser is a small
 * state machine (no regex on the output) that tracks whether each interpolation slot is a
 * node, an attribute value, a composed attribute fragment, an attrs() spread, a dynamic tag,
 * or a dynamic close tag.
 *
 * Dynamic component tags (`<${Comp}>…</${Comp}>`) push a frame onto a stack. Children content is
 * buffered into the frame; on the matching close, the component function is called with the
 * collected props (plus `children` as a pre-rendered HTML string) and its return value is
 * recursively serialized. The resulting HTML wraps as `<componentName attrs>…</componentName>`,
 * with declarative shadow DOM if `options.shadow` is true.
 *
 * In IS_SERVER mode `html`` does NOT compact closing-tag values, so `parts.length === values.length + 1`.
 */
import type {
  AttrsBag,
  RenderHtml,
  WompoComponent,
  WompoProps,
} from '../wompo.js';
import { registeredComponents } from '../wompo.js';
import {
  formatBooleanAttr,
  formatPlainAttr,
  styleObjectToString,
  toKebab,
} from './attribute.js';
import * as devalue from './devalue.js';
import { escapeAttr, escapeText, safeJsonForTemplate } from './escape.js';
import type { IslandMode } from './types.js';
import {
  createServerInstance,
  drainAsyncCalls,
  popContextValue,
  pushContextValue,
  runComponentOnce,
} from './server-runtime.js';
import type { SsrContext } from './types.js';

/* ============================== Tokenizer state ============================== */

const enum S {
  TEXT = 0,
  TAG_OPEN_NAME = 1,
  TAG_ATTR_SPACE = 2,
  ATTR_NAME = 3,
  ATTR_EQ = 4,
  ATTR_VALUE_UNQUOTED = 5,
  ATTR_VALUE_DQ = 6,
  ATTR_VALUE_SQ = 7,
  TAG_CLOSE_NAME = 8,
  TAG_CLOSE_HANDLED = 9, // dynamic close already popped; swallow the next '>'
  RAWTEXT = 10,
  COMMENT = 11,
}

const RAWTEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

interface Walker {
  state: S;
  tagName: string;
  attrName: string;
  attrPrefix: '' | '@' | '.' | '?';
  attrAcc: string;
  attrHasInterp: boolean;
  /** True once the current attribute value received emittable content (a static char or a
   * serializable interp). When an interpolated attribute reaches its closing quote with NO
   * content (every interp was null/undefined/false/ref/function/object), the whole attribute
   * is dropped from the output — mirroring the client, where `attr="${null}"` removes the
   * attribute instead of writing `attr=""`. */
  attrHadContent: boolean;
  selfClosing: boolean;
  rawtextCloseMatch: number;
  rawtextCloseTarget: string;
}

function freshWalker(): Walker {
  return {
    state: S.TEXT,
    tagName: '',
    attrName: '',
    attrPrefix: '',
    attrAcc: '',
    attrHasInterp: false,
    attrHadContent: false,
    selfClosing: false,
    rawtextCloseMatch: 0,
    rawtextCloseTarget: '',
  };
}

/** Drop the trailing `tail` single-char entries from the buffer. The walker emits attribute
 * name/`=`/quote chars one entry per char, so popping N entries removes exactly those chars.
 * Bails when an entry isn't a single char (a marker or interp output was pushed in between). */
function backtrackChars(buf: string[], tail: number): void {
  if (buf.length < tail) return;
  for (let n = 0; n < tail; n++) {
    const last = buf[buf.length - 1];
    if (last.length !== 1) return; // safety: walker emits one char per push; bail if not
    buf.pop();
  }
}

/** Drop the trailing `name=` (one entry per char) and the preceding `=` from the buffer.
 * Called when an interp at the `name=${value}` position evaluates to a value that must not
 * serialize on a native open tag — otherwise the dangling `=` would steal the next attribute
 * as a value. */
function backtrackAttrName(buf: string[], name: string): void {
  backtrackChars(buf, name.length + 1); // chars + '='
}

/* ============================== Component frame ============================== */

interface Frame {
  Component: WompoComponent;
  tagName: string;
  pendingProps: WompoProps;
  parentBuf: string[];
  childrenBuf: string[];
  openClosed: boolean;
  shadow: boolean;
  providedContextName?: string;
  /** True for `<wompo-suspense>` frames in streaming mode. */
  isSuspense?: boolean;
  /** Descendants that registered useAsync; resolved out-of-order after the shell flushes. */
  suspendedChildren?: import('./types.js').SuspendedChild[];
}

/* ============================== Serializer ============================== */

export class Serializer {
  private ctx: SsrContext;
  private rootBuf: string[] = [];
  private frames: Frame[] = [];

  constructor(ctx: SsrContext) {
    this.ctx = ctx;
  }

  /** Top-level entry: render a root component and return its HTML. */
  async renderRoot(Component: WompoComponent, props: WompoProps): Promise<string> {
    await this.emitComponent(Component, props, '', this.rootBuf);
    return this.rootBuf.join('');
  }

  /** Where output is currently being written. Inside an open-tag of a component frame, output
   * goes to the parent buffer (the opening `<componentName ...>` text); inside the children of a
   * frame, output goes to that frame's children buffer. */
  private currentBuf(): string[] {
    if (this.frames.length === 0) return this.rootBuf;
    const top = this.frames[this.frames.length - 1];
    return top.openClosed ? top.childrenBuf : top.parentBuf;
  }

  /* ============================== Walk a template ============================== */

  async walkTemplate(tpl: RenderHtml): Promise<void> {
    if (!tpl) return;
    const parts = tpl.parts;
    const values = tpl.values;
    const walker = freshWalker();
    const partsLength = parts.length;

    for (let i = 0; i < partsLength; i++) {
      await this.processPart(parts[i], walker);
      if (i < partsLength - 1) {
        await this.processInterp(values[i], walker);
      }
    }
  }

  /* ============================== Character processor ============================== */

  private async processPart(part: string, w: Walker): Promise<void> {
    const len = part.length;
    let i = 0;
    while (i < len) {
      const c = part.charCodeAt(i);
      const compOpen = this.openTagFrame() !== null;
      const buf = this.currentBuf();
      // Native + `@`/`.`/`?` prefixed attrs are server-only: skip all character emission for
      // their name, `=`, and value chars. `compOpen` similarly suppresses emission (the open
      // tag is rebuilt from pendingProps on close).
      const inAttrLifecycle =
        w.state === S.ATTR_NAME ||
        w.state === S.ATTR_EQ ||
        w.state === S.ATTR_VALUE_DQ ||
        w.state === S.ATTR_VALUE_SQ ||
        w.state === S.ATTR_VALUE_UNQUOTED;
      const skipNativePrefixed = !compOpen && w.attrPrefix !== '' && inAttrLifecycle;
      const emit = (s: string) => {
        if (compOpen) return;
        if (skipNativePrefixed) return;
        buf.push(s);
      };

      switch (w.state) {
        case S.TEXT: {
          if (c === 60 /* < */) {
            const next = i + 1 < len ? part.charCodeAt(i + 1) : 0;
            if (next === 33 /* ! */) {
              w.state = S.COMMENT;
              buf.push('<');
              i++;
              break;
            }
            if (next === 47 /* / */) {
              w.state = S.TAG_CLOSE_NAME;
              w.tagName = '';
              // Don't emit '</' yet — may pop a frame instead.
              i += 2;
              break;
            }
            w.state = S.TAG_OPEN_NAME;
            w.tagName = '';
            buf.push('<');
            i++;
            break;
          }
          buf.push(part[i]);
          i++;
          break;
        }

        case S.TAG_OPEN_NAME: {
          if (c === 32 || c === 9 || c === 10 || c === 13) {
            w.state = S.TAG_ATTR_SPACE;
            emit(part[i]);
            i++;
            break;
          }
          if (c === 47 /* / */) {
            // `<tag/>` → mark self-closing; the actual `/>` (or `>`) is emitted by closeOpenTag.
            w.selfClosing = true;
            i++;
            break;
          }
          if (c === 62 /* > */) {
            await this.closeOpenTag(w);
            i++;
            break;
          }
          w.tagName += part[i].toLowerCase();
          buf.push(part[i]);
          i++;
          break;
        }

        case S.TAG_ATTR_SPACE: {
          if (c === 62 /* > */) {
            await this.closeOpenTag(w);
            i++;
            break;
          }
          if (c === 47 /* / */) {
            w.selfClosing = true;
            i++;
            break;
          }
          if (c === 32 || c === 9 || c === 10 || c === 13) {
            emit(part[i]);
            i++;
            break;
          }
          w.state = S.ATTR_NAME;
          w.attrName = '';
          w.attrPrefix = '';
          w.attrAcc = '';
          w.attrHasInterp = false;
          w.attrHadContent = false;
          if (c === 64 /* @ */) {
            w.attrPrefix = '@';
            i++;
            break;
          }
          if (c === 46 /* . */) {
            w.attrPrefix = '.';
            i++;
            break;
          }
          if (c === 63 /* ? */) {
            w.attrPrefix = '?';
            i++;
            break;
          }
          w.attrName = part[i];
          emit(part[i]);
          i++;
          break;
        }

        case S.ATTR_NAME: {
          if (c === 61 /* = */) {
            w.state = S.ATTR_EQ;
            emit('=');
            i++;
            break;
          }
          if (c === 32 || c === 9 || c === 10 || c === 13) {
            this.flushBareAttrIfNeeded(w);
            w.state = S.TAG_ATTR_SPACE;
            w.attrName = '';
            w.attrPrefix = '';
            emit(part[i]);
            i++;
            break;
          }
          if (c === 62 /* > */) {
            this.flushBareAttrIfNeeded(w);
            await this.closeOpenTag(w);
            w.attrName = '';
            w.attrPrefix = '';
            i++;
            break;
          }
          if (c === 47 /* / */) {
            this.flushBareAttrIfNeeded(w);
            w.attrName = '';
            w.attrPrefix = '';
            w.selfClosing = true;
            i++;
            break;
          }
          w.attrName += part[i];
          emit(part[i]);
          i++;
          break;
        }

        case S.ATTR_EQ: {
          if (c === 34 /* " */) {
            w.state = S.ATTR_VALUE_DQ;
            w.attrAcc = '';
            w.attrHasInterp = false;
            w.attrHadContent = false;
            emit('"');
            i++;
            break;
          }
          if (c === 39 /* ' */) {
            w.state = S.ATTR_VALUE_SQ;
            w.attrAcc = '';
            w.attrHasInterp = false;
            w.attrHadContent = false;
            emit("'");
            i++;
            break;
          }
          if (c === 32 || c === 9 || c === 10 || c === 13) {
            i++;
            break;
          }
          w.state = S.ATTR_VALUE_UNQUOTED;
          w.attrAcc = part[i];
          w.attrHasInterp = false;
          emit(part[i]);
          i++;
          break;
        }

        case S.ATTR_VALUE_UNQUOTED: {
          if (c === 32 || c === 9 || c === 10 || c === 13) {
            this.flushAccumulatedAttr(w);
            w.state = S.TAG_ATTR_SPACE;
            emit(part[i]);
            i++;
            break;
          }
          if (c === 62 /* > */) {
            this.flushAccumulatedAttr(w);
            await this.closeOpenTag(w);
            i++;
            break;
          }
          w.attrAcc += part[i];
          emit(part[i]);
          i++;
          break;
        }

        case S.ATTR_VALUE_DQ: {
          if (c === 34 /* " */) {
            const omitted = this.flushAccumulatedAttr(w);
            w.state = S.TAG_ATTR_SPACE;
            if (!omitted) emit('"');
            i++;
            break;
          }
          w.attrAcc += part[i];
          w.attrHadContent = true;
          emit(part[i]);
          i++;
          break;
        }

        case S.ATTR_VALUE_SQ: {
          if (c === 39 /* ' */) {
            const omitted = this.flushAccumulatedAttr(w);
            w.state = S.TAG_ATTR_SPACE;
            if (!omitted) emit("'");
            i++;
            break;
          }
          w.attrAcc += part[i];
          w.attrHadContent = true;
          emit(part[i]);
          i++;
          break;
        }

        case S.TAG_CLOSE_NAME: {
          if (c === 62 /* > */) {
            const name = w.tagName.toLowerCase();
            const top = this.frames[this.frames.length - 1];
            if (top && top.tagName.toLowerCase() === name) {
              await this.renderAndPop(top);
            } else {
              buf.push('</', w.tagName, '>');
            }
            w.state = S.TEXT;
            w.tagName = '';
            i++;
            break;
          }
          if (c === 32 || c === 9 || c === 10 || c === 13) {
            i++;
            break;
          }
          w.tagName += part[i].toLowerCase();
          i++;
          break;
        }

        case S.TAG_CLOSE_HANDLED: {
          if (c === 62 /* > */) {
            w.state = S.TEXT;
            w.tagName = '';
            i++;
            break;
          }
          i++;
          break;
        }

        case S.COMMENT: {
          buf.push(part[i]);
          if (
            c === 62 /* > */ &&
            i >= 2 &&
            part.charCodeAt(i - 1) === 45 /* - */ &&
            part.charCodeAt(i - 2) === 45 /* - */
          ) {
            w.state = S.TEXT;
          }
          i++;
          break;
        }

        case S.RAWTEXT: {
          const target = w.rawtextCloseTarget;
          const idx = w.rawtextCloseMatch;
          let expected: string;
          if (idx === 0) expected = '<';
          else if (idx === 1) expected = '/';
          else expected = target[idx - 2];
          if (part[i].toLowerCase() === expected) {
            // Potential close-tag match: do NOT emit yet, advance counter.
            w.rawtextCloseMatch++;
            if (w.rawtextCloseMatch === target.length + 2) {
              w.state = S.TAG_CLOSE_NAME;
              w.tagName = target;
              w.rawtextCloseMatch = 0;
            }
            i++;
            break;
          }
          // Match failed — flush the partial-match chars we held back, then emit current char.
          if (idx > 0) buf.push('<');
          if (idx > 1) buf.push('/');
          if (idx > 2) buf.push(target.substring(0, idx - 2));
          w.rawtextCloseMatch = 0;
          if (c === 60 /* < */) {
            w.rawtextCloseMatch = 1;
            i++;
            break;
          }
          buf.push(part[i]);
          i++;
          break;
        }
      }
    }
  }

  /** When the parser sees `>` that ends an open tag, push the tag-close to the correct buffer
   * (parent for a component frame, current for native), inject island markers if applicable,
   * mark the frame's open tag closed, and switch to raw-text mode for raw-text elements. If
   * self-closing (`<${Comp} />`), immediately render+pop the frame. */
  private async closeOpenTag(w: Walker): Promise<void> {
    const name = w.tagName.toLowerCase();
    const selfClosing = w.selfClosing;
    w.selfClosing = false;
    const top = this.frames[this.frames.length - 1];
    if (top && !top.openClosed && top.tagName.toLowerCase() === name) {
      // Streaming-mode Suspense: arm the frame so descendants in `emitComponentInto` defer their
      // async work and record themselves on this frame instead of blocking the shell render.
      if (this.ctx.streaming && top.tagName === 'wompo-suspense') {
        top.isSuspense = true;
        top.suspendedChildren = [];
      }
      this.injectIslandMarkers(top);
      this.injectSsrMarker(top);
      top.parentBuf.push('>');
      top.openClosed = true;
      this.emitIslandPropsTemplate(top);
      if (selfClosing) {
        await this.renderAndPop(top);
        w.state = S.TEXT;
        return;
      }
    } else {
      this.currentBuf().push(selfClosing ? '/>' : '>');
    }
    if (RAWTEXT_TAGS.has(name)) {
      w.state = S.RAWTEXT;
      w.rawtextCloseTarget = name;
      w.rawtextCloseMatch = 0;
    } else {
      w.state = S.TEXT;
    }
  }

  /** Resolve the island hydration mode for a (Component, props) pair. A `client:*` directive on
   * the call site overrides the component's default `options.island`. Returns null when the
   * component should not be hydrated. */
  private resolveIslandMode(Component: WompoComponent, props: any): IslandMode | null {
    if (this.ctx.options.hydration === 'none') return null;
    if (props['client:none']) return null;
    if (props['client:load']) return 'load';
    if (props['client:idle']) return 'idle';
    if (props['client:visible']) return 'visible';
    const def = Component.options?.island;
    return def ?? null;
  }

  /** Push ` data-wompo-island="N" data-wompo-mode="M"` to parentBuf BEFORE the open-tag '>'
   * is emitted. Stores the island in the SSR context registry. */
  private injectIslandMarkers(frame: Frame): void {
    const mode = this.resolveIslandMode(frame.Component, frame.pendingProps as any);
    if (!mode) return;
    const index = this.ctx.islands.length;
    this.ctx.islands.push({ name: frame.tagName, mode, index });
    (frame as any).__islandIndex = index;
    (frame as any).__islandMode = mode;
    frame.parentBuf.push(' data-wompo-island="', String(index), '" data-wompo-mode="', mode, '"');
  }

  /** Mark every wompo component emitted server-side with `data-wompo-ssr`. The client-side
   * `connectedCallback` reads this marker and skips its destructive `__initElement` re-render —
   * the SSR'd DOM IS the rendered output for non-island components, and islands handle their
   * own hydration via `_$hydrate()`. */
  private injectSsrMarker(frame: Frame): void {
    frame.parentBuf.push(' data-wompo-ssr');
  }

  /** After the open-tag '>' has been emitted, emit the JSON props payload as the first child
   * of the component (read by the hydration runtime). */
  private emitIslandPropsTemplate(frame: Frame): void {
    const idx = (frame as any).__islandIndex;
    if (idx === undefined) return;
    const payload = this.sanitizePropsForIsland(frame.pendingProps);
    const json = devalue.stringify(payload);
    frame.parentBuf.push(
      '<template data-wompo-props type="application/json">',
      safeJsonForTemplate(json),
      '</template>',
    );
  }

  /** Strip server-only / non-serializable keys from the props payload before islanding. */
  private sanitizePropsForIsland(props: WompoProps): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k in props) {
      // skip directive keys
      if (k.startsWith('client:')) continue;
      // skip event keys — restored by hydration
      if (k.startsWith('@')) continue;
      // skip the children string (the DOM IS the children) and styles map (re-derived)
      if (k === 'children' || k === 'styles') continue;
      // skip ref hooks
      if (k === 'ref') continue;
      // skip function-valued props (callbacks): they can't be serialized and devalue would emit
      // `null`, which on hydration would clobber the live function a PARENT island assigns onto
      // this element via updateProp(). Leaving the key out lets that parent-provided value survive
      // the `_$initialProps` merge. Top-level islands never receive callbacks as props anyway.
      if (typeof (props as any)[k] === 'function') continue;
      out[k] = (props as any)[k];
    }
    return out;
  }

  /** Bare attribute (no `=`). For native open tags the chars are already in the buf via the
   * char walker; for an open component frame the walker suppressed them, so record the
   * boolean prop AND rebuild the bare attribute into parentBuf. The client upgrade reads
   * host attributes back as props (`'' → true`), so dropping the attribute here would flip
   * the prop to `undefined` after hydration. */
  private flushBareAttrIfNeeded(w: Walker): void {
    const frame = this.openTagFrame();
    if (!frame || !w.attrName) return;
    const key = w.attrPrefix + w.attrName;
    (frame.pendingProps as any)[key] = true;
    if (w.attrPrefix === '' && w.attrName !== 'ref' && w.attrName !== 'title') {
      frame.parentBuf.push(' ', toKebab(w.attrName));
    }
  }

  /** Flush an attribute at its end (closing quote / whitespace / `>`). For component frames,
   * the attr chars were suppressed during emission; rebuild the full ` name="value"` (or
   * boolean form) into parentBuf. For native elements the chars streamed through already —
   * here we only handle the two interp-driven cases: `?bool="${v}"` (name suppressed → emit
   * the bare name iff truthy) and a fully-empty interpolated value (drop the attribute,
   * mirroring the client's removeAttribute for nullish values). Returns true when the
   * attribute was dropped and the caller must not emit the closing quote. */
  private flushAccumulatedAttr(w: Walker): boolean {
    const frame = this.openTagFrame();
    if (!frame) {
      if (!w.attrName) return false;
      if (w.attrPrefix === '?') {
        // Chars were suppressed (skipNativePrefixed); emit the bare name iff the accumulated
        // value is truthy. The whitespace BEFORE `?name` was already emitted (that's how the
        // walker entered TAG_ATTR_SPACE), so push the name without a leading space. The
        // closing quote is suppressed by the same skip.
        if (w.attrAcc) this.currentBuf().push(toKebab(w.attrName));
        return false;
      }
      if (w.attrPrefix === '' && w.attrHasInterp && !w.attrHadContent) {
        // Every part of the value was nullish/ref/function/object: the client would remove
        // the attribute, so drop the already-emitted ` name="` chars from the output.
        backtrackChars(this.currentBuf(), w.attrName.length + 2); // name + '=' + quote
        return true;
      }
      return false;
    }
    if (!w.attrName) return false;
    if (w.attrHasInterp) {
      // The composed value was handled by emitAttrValue (interp). The accumulator is the final
      // string; rebuild the full ` name="value"` in parentBuf.
      if (w.attrPrefix === '' && w.attrName !== 'ref') {
        (frame.pendingProps as any)[w.attrName] = w.attrAcc;
        if (w.attrName !== 'title') {
          frame.parentBuf.push(' ', toKebab(w.attrName), '="', escapeAttr(w.attrAcc), '"');
        }
      } else if (w.attrPrefix === '?' && w.attrAcc) {
        (frame.pendingProps as any)['?' + w.attrName] = w.attrAcc;
        frame.parentBuf.push(' ', toKebab(w.attrName));
      }
      return false;
    }
    // Plain static value.
    const key = w.attrPrefix + w.attrName;
    (frame.pendingProps as any)[key] = w.attrAcc;
    this.maybePushProviderValue(frame, w.attrPrefix, w.attrName, w.attrAcc);
    if (w.attrPrefix === '' && w.attrName !== 'ref' && w.attrName !== 'title') {
      // `title` is held only as a prop; see emitAttrValue for the rationale.
      frame.parentBuf.push(' ', toKebab(w.attrName), '="', escapeAttr(w.attrAcc), '"');
    } else if (w.attrPrefix === '?' && w.attrAcc) {
      frame.parentBuf.push(' ', toKebab(w.attrName));
    }
    return false;
  }

  /* ============================== Interpolation ============================== */

  private async processInterp(value: unknown, w: Walker): Promise<void> {
    switch (w.state) {
      case S.TEXT: {
        // Wrap the interp output in marker comments so the hydration runtime can locate the
        // dynamic-node region in the SSR'd DOM and bind a DynamicNode to it. A `_$wompoChildren`
        // value (a component rendering `${children}`) gets a *distinct* `<!--wc-->` marker: those
        // children were re-homed from a parent's `<${Comp}>…</${Comp}>` dynamic tag, and the
        // parent's adopt() needs to tell its dynamic-tag children region apart from the component's
        // own node interpolations to bind deps that live across the re-homing boundary.
        const isChildren = !!(value && (value as any)._$wompoChildren);
        this.currentBuf().push(isChildren ? '<!--wc-->' : '<!--w-->');
        await this.emitNode(value);
        this.currentBuf().push(isChildren ? '<!--/wc-->' : '<!--/w-->');
        return;
      }

      case S.TAG_OPEN_NAME: {
        // Dynamic open tag: `<${Comp}>` or `<${'div'}>`. Components are FUNCTIONS (with extra
        // fields), so we test the marker directly rather than typeof.
        const buf = this.currentBuf();
        if (value && (value as WompoComponent)._$wompoF) {
          const Comp = value as WompoComponent;
          const tag = Comp.componentName!;
          buf.push(tag);
          this.ctx.usedComponents.set(tag, Comp);
          const frame: Frame = {
            Component: Comp,
            tagName: tag,
            pendingProps: {},
            parentBuf: buf,
            childrenBuf: [],
            openClosed: false,
            shadow: !!Comp.options?.shadow,
          };
          this.frames.push(frame);
          w.tagName = tag;
          w.state = S.TAG_ATTR_SPACE;
          return;
        }
        if (typeof value === 'string') {
          buf.push(value);
          w.tagName = value.toLowerCase();
          w.state = S.TAG_ATTR_SPACE;
          return;
        }
        if (typeof value === 'function' && (value as any)._$wompoLazy) {
          try {
            const Resolved = (await (value as () => Promise<WompoComponent>)()) as WompoComponent;
            if (Resolved && Resolved._$wompoF) {
              await this.processInterp(Resolved, w);
            }
          } catch (err) {
            console.error('[wompo ssr] lazy() in dynamic tag failed:', err);
          }
          return;
        }
        // Anything else silently produces a broken `< >` tag — surface the mistake (the most
        // common one: a plain function that was never passed through defineWompo).
        if (typeof value === 'function') {
          console.error(
            `[wompo ssr] dynamic tag value is a plain function (${(value as any).name || 'anonymous'}) — did you forget defineWompo()?`,
          );
        } else if (value !== null && value !== undefined) {
          console.error(`[wompo ssr] dynamic tag value must be a component or a string, got ${typeof value}`);
        }
        return;
      }

      case S.TAG_CLOSE_NAME: {
        // </${Comp}>
        if (value && (value as WompoComponent)._$wompoF) {
          const Comp = value as WompoComponent;
          const top = this.frames[this.frames.length - 1];
          if (top && top.Component === Comp) {
            await this.renderAndPop(top);
          }
          w.state = S.TAG_CLOSE_HANDLED;
          w.tagName = '';
          return;
        }
        if (typeof value === 'string') {
          w.tagName += value.toLowerCase();
          return;
        }
        return;
      }

      case S.TAG_ATTR_SPACE: {
        // attrs() spread
        if (value && typeof value === 'object' && (value as AttrsBag)._$wompoAttrs) {
          const bag = value as AttrsBag;
          this.emitSpread(bag.entries);
        }
        return;
      }

      case S.ATTR_EQ:
      case S.ATTR_VALUE_UNQUOTED: {
        // Full attribute value via interp (no surrounding quotes). The interp consumes the
        // entire value; we transition to TAG_ATTR_SPACE.
        this.emitAttrValue(w.attrName, w.attrPrefix, value);
        w.state = S.TAG_ATTR_SPACE;
        w.attrName = '';
        w.attrPrefix = '';
        w.attrAcc = '';
        w.attrHasInterp = false;
        return;
      }

      case S.ATTR_VALUE_DQ:
      case S.ATTR_VALUE_SQ: {
        // Composed attribute: contribute a stringified value to the accumulator. For native
        // elements we also emit the escaped value into the buffer (so the literal attr is
        // complete); component frames rebuild via pendingProps from attrAcc on flush.
        const isNullish = value === null || value === undefined || value === false;
        const s = isNullish ? '' : String(value);
        w.attrHasInterp = true;
        if (this.openTagFrame()) {
          w.attrAcc += s;
          return;
        }
        // Native element.
        if (w.attrPrefix !== '') {
          // `@load="${fn}"` / `.prop="${v}"` / `?bool="${v}"`: the name/`=`/quote chars were
          // suppressed by skipNativePrefixed — emitting the value here would inject it BARE
          // into the open tag (a serialized handler contains `=>`, whose `>` closes the tag
          // early and leaks the rest as visible text). Only accumulate: `?` reads the
          // accumulator at flush; `@`/`.` are dropped entirely.
          w.attrAcc += s;
          return;
        }
        if (isNullish) return; // contributes nothing; attr dropped at flush if still empty
        if (w.attrName === 'ref' || typeof value === 'function') return; // never serialized
        if (typeof value === 'object') {
          // Style objects serialize like the client does; other objects contribute nothing.
          if (w.attrName === 'style' && !Array.isArray(value)) {
            const styleStr = styleObjectToString(value as Record<string, unknown>);
            w.attrAcc += styleStr;
            w.attrHadContent = true;
            this.currentBuf().push(escapeAttr(styleStr));
          }
          return;
        }
        w.attrAcc += s;
        w.attrHadContent = true;
        this.currentBuf().push(escapeAttr(s));
        return;
      }

      default:
        return;
    }
  }

  /** Emit a single attribute value.
   *
   * `inlineName=true` means the attribute name + `=` are already in the buffer (an interp at the
   * `name=` position). `inlineName=false` means we must emit ` name="value"` ourselves (used by
   * attrs() spread and component-frame open-tag rebuilds).
   */
  private emitAttrValue(
    name: string,
    prefix: '' | '@' | '.' | '?',
    value: unknown,
    inlineName: boolean = true,
  ): void {
    const frame = this.openTagFrame();
    if (frame) {
      // Map prefix → pendingProps key. The component receives props by their unprefixed name
      // (except events which keep the `@` so the runtime can wire up listeners).
      const propKey = prefix === '@' ? '@' + name : name;
      // Store the prop server-side (used for nested-component invocation), unless this is an
      // event handler — those are dropped server-side.
      if (prefix !== '@') (frame.pendingProps as any)[propKey] = value;
      this.maybePushProviderValue(frame, prefix, name, value);
      if (prefix === '' && value !== null && value !== undefined && value !== false) {
        if (value !== Object(value) && name !== 'ref' && name !== 'title') {
          // `title` is intentionally NOT emitted onto custom-element open tags — wompo client
          // strips it on hydration to avoid the browser's native tooltip showing up on a
          // wrapper element. Mirror that so SSR + client produce consistent DOM.
          const emit = formatPlainAttr(toKebab(name), value);
          if (emit) frame.parentBuf.push(emit);
        }
      } else if (prefix === '?') {
        const emit = formatBooleanAttr(toKebab(name), value);
        if (emit) frame.parentBuf.push(emit);
      }
      return;
    }
    // Native element open tag.
    if (prefix === '@' || prefix === '.') return;
    const buf = this.currentBuf();
    if (prefix === '?') {
      // The literal `?name=` chars were suppressed by the char walker; emit the bare attr
      // name iff truthy.
      const emit = formatBooleanAttr(name, value);
      if (emit) buf.push(emit);
      return;
    }
    if (value === null || value === undefined || value === false) {
      // The walker already pushed `name=` (each char as a separate entry) into the buffer
      // before this interp was processed. Drop those entries so the next attribute isn't
      // glued to a dangling `name=`. inlineName=false means the spread path is responsible
      // for not emitting anything in the first place, so no backtracking is needed there.
      if (inlineName) backtrackAttrName(buf, name);
      return;
    }
    if (name === 'ref' || typeof value === 'function') {
      // Refs are hook handles and functions can never serialize — drop the dangling `name=`.
      if (inlineName) backtrackAttrName(buf, name);
      return;
    }
    if (typeof value === 'object') {
      if (name === 'style' && value && !Array.isArray(value)) {
        const styleStr = styleObjectToString(value as Record<string, unknown>);
        if (inlineName) buf.push('"', escapeAttr(styleStr), '"');
        else buf.push(' style="', escapeAttr(styleStr), '"');
        return;
      }
      // Other objects have no attribute representation; drop the dangling `name=`.
      if (inlineName) backtrackAttrName(buf, name);
      return;
    }
    if (inlineName) {
      buf.push('"', escapeAttr(String(value)), '"');
    } else {
      const emit = formatPlainAttr(name, value);
      if (emit) buf.push(emit);
    }
  }

  /** Push the context-provider's `value` prop onto the active SSR context stack. */
  private maybePushProviderValue(
    frame: Frame,
    prefix: '' | '@' | '.' | '?',
    name: string,
    value: unknown,
  ): void {
    if (prefix !== '' || name !== 'value') return;
    if (!frame.tagName.startsWith('wompo-context-provider-')) return;
    frame.providedContextName = frame.tagName;
    pushContextValue(frame.tagName, value);
  }

  private emitSpread(entries: Record<string, unknown>): void {
    for (const rawKey in entries) {
      const value = entries[rawKey];
      let prefix: '' | '@' | '.' | '?' = '';
      let name = rawKey;
      if (rawKey.startsWith('@')) {
        prefix = '@';
        name = rawKey.substring(1);
      } else if (rawKey.startsWith('.')) {
        prefix = '.';
        name = rawKey.substring(1);
      } else if (rawKey.startsWith('?')) {
        prefix = '?';
        name = rawKey.substring(1);
      }
      // Spread entries are NOT preceded by literal ` name=` in the buffer.
      this.emitAttrValue(name, prefix, value, /* inlineName */ false);
    }
  }

  /** The topmost frame whose open tag is still being collected, or null. */
  private openTagFrame(): Frame | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const f = this.frames[i];
      if (!f.openClosed) return f;
    }
    return null;
  }

  /** Innermost enclosing `<wompo-suspense>` frame (set on `closeOpenTag` in streaming mode). */
  private enclosingSuspenseFrame(): Frame | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      if (this.frames[i].isSuspense) return this.frames[i];
    }
    return null;
  }

  /* ============================== Frame lifecycle ============================== */

  private async renderAndPop(frame: Frame): Promise<void> {
    const idx = this.frames.lastIndexOf(frame);
    if (idx >= 0) this.frames.splice(idx, 1);
    const childrenHtml = frame.childrenBuf.join('');
    if (frame.isSuspense && frame.suspendedChildren && frame.suspendedChildren.length > 0) {
      (frame.pendingProps as any).__$suspended = frame.suspendedChildren;
    }
    await this.emitComponentInto(
      frame.Component,
      frame.pendingProps,
      childrenHtml,
      frame.parentBuf,
    );
    if (frame.providedContextName) popContextValue(frame.providedContextName);
  }

  /** Emit a component with its wrapping `<componentName attrs>` / `</componentName>` — used by
   * the root entry where no caller has emitted the open tag yet. */
  private async emitComponent(
    Component: WompoComponent,
    props: WompoProps,
    childrenHtml: string,
    targetBuf: string[],
  ): Promise<void> {
    const tag = Component.componentName!;
    this.ctx.usedComponents.set(tag, Component);
    targetBuf.push('<', tag);
    for (const k in props) {
      if (k === 'children' || k === 'styles' || k === 'ref' || k === 'wc-perf' || k === 'wcPerf')
        continue;
      if (k.startsWith('client:')) continue;
      const v = (props as any)[k];
      if (v !== null && v !== undefined && v !== false && v !== Object(v)) {
        const emit = formatPlainAttr(toKebab(k), v);
        if (emit) targetBuf.push(emit);
      } else if (k === 'style' && v && typeof v === 'object') {
        targetBuf.push(' style="', escapeAttr(styleObjectToString(v as Record<string, unknown>)), '"');
      }
    }
    const islandMode = this.resolveIslandMode(Component, props);
    let islandIndex = -1;
    if (islandMode) {
      islandIndex = this.ctx.islands.length;
      this.ctx.islands.push({ name: tag, mode: islandMode, index: islandIndex });
      targetBuf.push(' data-wompo-island="', String(islandIndex), '" data-wompo-mode="', islandMode, '"');
    }
    targetBuf.push(' data-wompo-ssr>');
    if (islandIndex >= 0) {
      const payload = this.sanitizePropsForIsland(props);
      const json = devalue.stringify(payload);
      targetBuf.push(
        '<template data-wompo-props type="application/json">',
        safeJsonForTemplate(json),
        '</template>',
      );
    }
    await this.emitComponentInto(Component, props, childrenHtml, targetBuf);
  }

  /** Render a component's own template into the given buffer, with optional shadow wrapping. */
  private async emitComponentInto(
    Component: WompoComponent,
    props: WompoProps,
    childrenHtml: string,
    targetBuf: string[],
  ): Promise<void> {
    const tag = Component.componentName!;
    const shadow = !!Component.options?.shadow;
    const styles = Component.options?.styles || {};

    const fullProps: any = { ...props, styles };
    fullProps.children = { _$wompoChildren: true, nodes: childrenHtml };

    // Streaming-Suspense special case: this component IS the Suspense and some descendant has
    // deferred work. Emit the fallback wrapped in a boundary and queue the descendants for
    // resolution after the shell flushes.
    if (
      this.ctx.streaming &&
      tag === 'wompo-suspense' &&
      Array.isArray((props as any).__$suspended) &&
      (props as any).__$suspended.length > 0
    ) {
      const suspended = (props as any).__$suspended as import('./types.js').SuspendedChild[];
      const boundaries = this.ctx.pendingBoundaries!;
      const id = `B${boundaries.length}`;
      // Open the boundary, emit fallback inline.
      targetBuf.push('<wompo-boundary id="', id, '">');
      const fallback = (props as any).fallback;
      if (fallback) await this.emitNodeInto(fallback, targetBuf);
      targetBuf.push('</wompo-boundary>');
      // Queue the deferred work: drain async on each instance, re-run the component, and walk
      // its resolved RenderHtml into a sub-buffer. The boundary chunk concatenates all children
      // in registration order.
      boundaries.push({
        id,
        resolve: async () => {
          const subBuf: string[] = [];
          for (const sc of suspended) {
            await drainAsyncCalls(sc.instance);
            const resolved = runComponentOnce(sc.instance, sc.Component, sc.props);
            const childTag = sc.Component.componentName!;
            subBuf.push('<', childTag);
            this.emitAttrsFromProps(sc.props, subBuf);
            subBuf.push('>');
            if (resolved) await this.walkTemplateInto(resolved, subBuf);
            subBuf.push('</', childTag, '>');
          }
          return subBuf.join('');
        },
      });
      targetBuf.push('</', tag, '>');
      return;
    }

    const instance = createServerInstance(Component, tag, fullProps, shadow);
    let renderHtml = runComponentOnce(instance, Component, fullProps);

    if (instance._$asyncCalls.length) {
      // If we're inside a streaming Suspense, defer the async work to the boundary phase and
      // skip emitting this subtree (the Suspense's emitComponentInto will emit fallback in its
      // place and replay this instance's resolution later).
      const enclosing = this.enclosingSuspenseFrame();
      if (this.ctx.streaming && enclosing && enclosing.suspendedChildren) {
        enclosing.suspendedChildren.push({
          instance,
          Component,
          props: fullProps,
          childrenHtml,
        });
        // Close the open tag emitted by the walker (or by the root emitComponent) to keep the
        // discarded suspense.childrenBuf at least syntactically balanced.
        if (shadow) targetBuf.push('</template>');
        targetBuf.push('</', tag, '>');
        return;
      }
      await drainAsyncCalls(instance);
      renderHtml = runComponentOnce(instance, Component, fullProps);
    }

    if (shadow) targetBuf.push('<template shadowrootmode="open">');

    if (renderHtml) {
      await this.walkTemplateInto(renderHtml, targetBuf);
    }

    if (shadow) targetBuf.push('</template>');
    targetBuf.push('</', tag, '>');
  }

  /** Walk a template, routing all output into `targetBuf`. Saves/restores serializer state. */
  private async walkTemplateInto(tpl: RenderHtml, targetBuf: string[]): Promise<void> {
    const savedFrames = this.frames;
    const savedRootBuf = this.rootBuf;
    this.frames = [];
    this.rootBuf = targetBuf;
    try {
      await this.walkTemplate(tpl);
    } finally {
      this.frames = savedFrames;
      this.rootBuf = savedRootBuf;
    }
  }

  /** Emit a single value (string, RenderHtml, component, ...) into `targetBuf`. */
  private async emitNodeInto(value: unknown, targetBuf: string[]): Promise<void> {
    const savedFrames = this.frames;
    const savedRootBuf = this.rootBuf;
    this.frames = [];
    this.rootBuf = targetBuf;
    try {
      await this.emitNode(value);
    } finally {
      this.frames = savedFrames;
      this.rootBuf = savedRootBuf;
    }
  }

  /** Push static-attr text (` k="v"`) into `targetBuf` for each serializable prop. */
  private emitAttrsFromProps(props: WompoProps, targetBuf: string[]): void {
    for (const k in props) {
      if (k === 'children' || k === 'styles' || k === 'ref' || k === 'wcPerf' || k === 'wc-perf')
        continue;
      if (k.startsWith('client:') || k.startsWith('@') || k.startsWith('.')) continue;
      if (k === '__$suspended') continue;
      const v = (props as any)[k];
      if (v === null || v === undefined || v === false) continue;
      if (v !== Object(v)) {
        const emit = formatPlainAttr(toKebab(k), v);
        if (emit) targetBuf.push(emit);
      }
    }
  }

  /* ============================== Node emit ============================== */

  private async emitNode(value: unknown): Promise<void> {
    if (value === null || value === undefined || value === false) return;
    if (typeof value === 'string') {
      this.currentBuf().push(escapeText(value));
      return;
    }
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
      this.currentBuf().push(String(value));
      return;
    }
    if ((value as any)._$wompoChildren) {
      const ch = (value as any).nodes;
      if (typeof ch === 'string') {
        this.currentBuf().push(ch);
      } else if (Array.isArray(ch)) {
        for (const n of ch) {
          if (n && typeof n === 'object' && 'outerHTML' in (n as object)) {
            this.currentBuf().push((n as { outerHTML: string }).outerHTML);
          } else if (n != null) {
            this.currentBuf().push(escapeText(String(n)));
          }
        }
      }
      return;
    }
    if ((value as any)._$wompoHtml) {
      await this.walkTemplate(value as RenderHtml);
      return;
    }
    if ((value as any)._$wompoF) {
      await this.emitComponent(value as WompoComponent, {}, '', this.currentBuf());
      return;
    }
    if (typeof value === 'function' && (value as any)._$wompoLazy) {
      try {
        const Resolved = (await (value as () => Promise<WompoComponent>)()) as WompoComponent;
        if (Resolved && Resolved._$wompoF) {
          await this.emitComponent(Resolved, {}, '', this.currentBuf());
        }
      } catch (err) {
        console.error('[wompo ssr] lazy() failed:', err);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) await this.emitNode(v);
      return;
    }
    this.currentBuf().push(escapeText(String(value)));
  }
}

export function lookupComponent(tag: string): WompoComponent | undefined {
  return registeredComponents[tag];
}
