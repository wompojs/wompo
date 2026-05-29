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
  it('safeJsonForTemplate escapes < and &', () => {
    const json = '{"x":"<script>","y":"a&amp;b"}';
    expect(safeJsonForTemplate(json)).toBe('{"x":"\\u003cscript>","y":"a\\u0026amp;b"}');
  });
  it('safeJsonForTemplate output round-trips through HTML entity decoding', () => {
    // Inside <template> the parser decodes entities when textContent is read; if a serialized
    // string contains `&quot;`/`&lt;`, an unescaped `&` would corrupt the JSON. Escaping `&`
    // (and `<`) to \uXXXX keeps the bytes inert to the parser, so the decoded text === input.
    const json = JSON.stringify({ code: '<div class="x">&quot; & &#39; &lt;b&gt;</div>' });
    const safe = safeJsonForTemplate(json);
    // Simulate the HTML parser decoding entities in the template's text content.
    const decoded = safe
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    expect(decoded).toBe(safe); // nothing for the parser to decode
    expect(JSON.parse(decoded)).toEqual({ code: '<div class="x">&quot; & &#39; &lt;b&gt;</div>' });
  });
});
