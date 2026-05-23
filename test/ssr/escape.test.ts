/* escape.ts: text + attribute escaping. */
import { describe, expect, it } from 'vitest';
import { escapeAttr, escapeText, safeJsonForTemplate } from '../../ts/ssr/escape.js';

describe('escape', () => {
  it('escapeText covers &, <, >', () => {
    expect(escapeText('a&b<c>d')).toBe('a&amp;b&lt;c&gt;d');
  });
  it('escapeText passes safe strings through unchanged', () => {
    const s = 'no special characters here 123';
    expect(escapeText(s)).toBe(s);
  });
  it('escapeAttr covers &, ", \', <', () => {
    expect(escapeAttr('a&"b\'<c')).toBe('a&amp;&quot;b&#39;&lt;c');
  });
  it('safeJsonForTemplate escapes only <', () => {
    const json = '{"x":"<script>"}';
    expect(safeJsonForTemplate(json)).toBe('{"x":"\\u003cscript>"}');
  });
});
