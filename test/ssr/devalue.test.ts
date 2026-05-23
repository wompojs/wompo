/* devalue.ts: round-trip serialization of complex JS values. */
import { describe, expect, it } from 'vitest';
// @ts-ignore — dist
import { devalue } from '../../dist/ssr/index.js';

const round = <T>(v: T): unknown => devalue.parse(devalue.stringify(v));

describe('devalue', () => {
  it('roundtrips primitives', () => {
    expect(round(42)).toBe(42);
    expect(round('hello')).toBe('hello');
    expect(round(true)).toBe(true);
    expect(round(false)).toBe(false);
    expect(round(null)).toBe(null);
    expect(round(undefined)).toBe(undefined);
  });

  it('roundtrips special numbers', () => {
    expect(Number.isNaN(round(NaN) as number)).toBe(true);
    expect(round(Infinity)).toBe(Infinity);
    expect(round(-Infinity)).toBe(-Infinity);
    expect(Object.is(round(-0), -0)).toBe(true);
  });

  it('roundtrips objects + arrays', () => {
    const v = { a: 1, b: [2, 3, { c: 'x' }], d: null };
    expect(round(v)).toEqual(v);
  });

  it('roundtrips Date', () => {
    const d = new Date('2026-05-21T12:00:00.000Z');
    const r = round(d) as Date;
    expect(r instanceof Date).toBe(true);
    expect(r.toISOString()).toBe(d.toISOString());
  });

  it('roundtrips Map and Set', () => {
    const m = new Map([['a', 1], ['b', 2]]);
    const s = new Set([1, 2, 3]);
    const rm = round(m) as Map<string, number>;
    const rs = round(s) as Set<number>;
    expect(rm.get('a')).toBe(1);
    expect(rm.get('b')).toBe(2);
    expect(rs.has(2)).toBe(true);
    expect(rs.size).toBe(3);
  });

  it('roundtrips BigInt', () => {
    expect(round(123n)).toBe(123n);
  });

  it('handles cyclic references', () => {
    const a: any = { name: 'a' };
    const b: any = { name: 'b', a };
    a.b = b;
    const r = round(a) as any;
    expect(r.name).toBe('a');
    expect(r.b.name).toBe('b');
    expect(r.b.a).toBe(r); // cycle preserved
  });

  it('handles RegExp', () => {
    const re = /foo+/gi;
    const r = round(re) as RegExp;
    expect(r.source).toBe('foo+');
    expect(r.flags).toBe('gi');
  });

  it('functions become null (server-only)', () => {
    const v = { f: () => 42, x: 1 };
    expect(round(v)).toEqual({ f: null, x: 1 });
  });
});
