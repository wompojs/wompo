/* Minimal "devalue"-style serializer / parser. Supports cycles, undefined, NaN, Infinity, Date,
 * Map, Set, BigInt. Output is a JSON array; the first element is the "root" value, all subsequent
 * elements are referenced objects. Functions and symbols are not supported (they become null or
 * are encoded with a marker for actions).
 *
 * Wire format:
 *   - Primitive root: `42`, `"hi"`, `true`, `null` — single JSON value
 *   - Negative sentinels for special primitives:
 *       -1: undefined
 *       -2: NaN
 *       -3: Infinity
 *       -4: -Infinity
 *       -5: -0
 *   - Composite root: index into a positions array. Each position is one of:
 *       JSON primitive
 *       ["Object", { k: idx, ... }]
 *       ["Array", [idx, ...]]
 *       ["Date", "iso-string"]
 *       ["Map", [[kIdx, vIdx], ...]]
 *       ["Set", [idx, ...]]
 *       ["BigInt", "decimal"]
 *       ["RegExp", "pattern", "flags"]
 *       ["Action", "id"]
 *
 * Designed to be small, dependency-free, and deterministic. The format borrows ideas from
 * Rich Harris' devalue but is purpose-built (no eval, no quote escape rules).
 */

const UNDEFINED = -1;
const NAN = -2;
const POSITIVE_INFINITY = -3;
const NEGATIVE_INFINITY = -4;
const NEGATIVE_ZERO = -5;

const ACTION_TAG = '@@wompoAction';

function primitiveSentinel(v: unknown): number | null {
  if (v === undefined) return UNDEFINED;
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return NAN;
    if (v === Infinity) return POSITIVE_INFINITY;
    if (v === -Infinity) return NEGATIVE_INFINITY;
    if (v === 0 && 1 / v < 0) return NEGATIVE_ZERO;
  }
  return null;
}

export function stringify(value: unknown): string {
  // Fast path: simple primitives that round-trip through JSON.
  const sentinel = primitiveSentinel(value);
  if (sentinel !== null) return String(sentinel);
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(value);
  // BigInt and other tagged primitives go through the positions-array path so that the parser
  // sees the same shape (no special-case top-level tag-tuple).

  const positions: string[] = [];
  const indexOf = new Map<unknown, number>();

  const flatten = (v: unknown): number => {
    const s = primitiveSentinel(v);
    if (s !== null) return s;
    if (v === null) {
      const idx = positions.length;
      positions.push('null');
      return idx;
    }
    if (typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number') {
      const idx = positions.length;
      positions.push(JSON.stringify(v));
      return idx;
    }
    if (typeof v === 'bigint') {
      const idx = positions.length;
      positions.push(JSON.stringify(['BigInt', v.toString()]));
      return idx;
    }
    if (indexOf.has(v)) return indexOf.get(v)!;

    const idx = positions.length;
    indexOf.set(v, idx);
    positions.push('null'); // placeholder so cycles can resolve to a valid index

    let entry: string;
    if (v instanceof Date) {
      entry = JSON.stringify(['Date', v.toISOString()]);
    } else if (v instanceof RegExp) {
      entry = JSON.stringify(['RegExp', v.source, v.flags]);
    } else if (v instanceof Map) {
      const pairs: [number, number][] = [];
      v.forEach((val, key) => pairs.push([flatten(key), flatten(val)]));
      entry = JSON.stringify(['Map', pairs]);
    } else if (v instanceof Set) {
      const items: number[] = [];
      v.forEach((item) => items.push(flatten(item)));
      entry = JSON.stringify(['Set', items]);
    } else if (Array.isArray(v)) {
      const items = v.map((item) => flatten(item));
      entry = JSON.stringify(['Array', items]);
    } else if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      // Server Action marker
      if (obj && obj[ACTION_TAG]) {
        entry = JSON.stringify(['Action', String(obj[ACTION_TAG])]);
      } else {
        const out: Record<string, number> = {};
        for (const k of Object.keys(obj)) {
          out[k] = flatten(obj[k]);
        }
        entry = JSON.stringify(['Object', out]);
      }
    } else if (typeof v === 'function') {
      // Functions cannot be serialized to the client; emit null. Use defineAction() to wrap a
      // server function explicitly.
      entry = 'null';
    } else {
      entry = 'null';
    }
    positions[idx] = entry;
    return idx;
  };

  const root = flatten(value);
  // For composite roots, emit a 2-tuple: [rootIndex, positions]. Sentinel roots are encoded
  // as the sentinel value directly (a negative number) wrapped as [n].
  if (root < 0) return `[${root}]`;
  return `[${root},[${positions.join(',')}]]`;
}

interface ParseOptions {
  /** Called to resolve [Action, id] entries to a callable client proxy. */
  resolveAction?: (id: string) => unknown;
}

export function parse(s: string, opts: ParseOptions = {}): unknown {
  if (s === '' || s === undefined) return undefined;
  const data = JSON.parse(s);
  if (typeof data === 'number' && data < 0) return resolveSentinel(data);
  if (data === null || typeof data !== 'object') return data;

  // Sentinel-only root: [n]
  if (Array.isArray(data) && data.length === 1 && typeof data[0] === 'number' && data[0] < 0) {
    return resolveSentinel(data[0]);
  }

  const [rootIndex, positions] = data as [number, unknown[]];
  if (rootIndex < 0) return resolveSentinel(rootIndex);

  const built: unknown[] = new Array(positions.length);
  const resolved: boolean[] = new Array(positions.length).fill(false);

  const resolve = (idx: number): unknown => {
    if (idx < 0) return resolveSentinel(idx);
    if (resolved[idx]) return built[idx];
    const entry = positions[idx];
    if (entry === null || typeof entry !== 'object' || !Array.isArray(entry)) {
      built[idx] = entry;
      resolved[idx] = true;
      return entry;
    }
    const tag = entry[0] as string;
    if (tag === 'Date') {
      built[idx] = new Date(entry[1] as string);
      resolved[idx] = true;
      return built[idx];
    }
    if (tag === 'RegExp') {
      built[idx] = new RegExp(entry[1] as string, entry[2] as string);
      resolved[idx] = true;
      return built[idx];
    }
    if (tag === 'BigInt') {
      built[idx] = BigInt(entry[1] as string);
      resolved[idx] = true;
      return built[idx];
    }
    if (tag === 'Action') {
      built[idx] = opts.resolveAction ? opts.resolveAction(entry[1] as string) : null;
      resolved[idx] = true;
      return built[idx];
    }
    if (tag === 'Array') {
      const arr: unknown[] = [];
      built[idx] = arr;
      resolved[idx] = true;
      const items = entry[1] as number[];
      for (let i = 0; i < items.length; i++) arr.push(resolve(items[i]));
      return arr;
    }
    if (tag === 'Object') {
      const obj: Record<string, unknown> = {};
      built[idx] = obj;
      resolved[idx] = true;
      const kv = entry[1] as Record<string, number>;
      for (const k in kv) obj[k] = resolve(kv[k]);
      return obj;
    }
    if (tag === 'Map') {
      const map = new Map<unknown, unknown>();
      built[idx] = map;
      resolved[idx] = true;
      const pairs = entry[1] as [number, number][];
      for (const [k, v] of pairs) map.set(resolve(k), resolve(v));
      return map;
    }
    if (tag === 'Set') {
      const set = new Set<unknown>();
      built[idx] = set;
      resolved[idx] = true;
      const items = entry[1] as number[];
      for (const i of items) set.add(resolve(i));
      return set;
    }
    built[idx] = entry;
    resolved[idx] = true;
    return entry;
  };

  return resolve(rootIndex);
}

function resolveSentinel(s: number): unknown {
  switch (s) {
    case UNDEFINED:
      return undefined;
    case NAN:
      return NaN;
    case POSITIVE_INFINITY:
      return Infinity;
    case NEGATIVE_INFINITY:
      return -Infinity;
    case NEGATIVE_ZERO:
      return -0;
    default:
      return undefined;
  }
}

/** Marker key the serializer uses to recognize a server-action proxy. */
export const ACTION_KEY = ACTION_TAG;
