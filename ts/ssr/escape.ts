/* HTML entity escaping. No regex on the output — fixed-time char scan. */

const AMP = '&amp;';
const LT = '&lt;';
const GT = '&gt;';
const QUOT = '&quot;';
const APOS = '&#39;';

/** Escape a string to be safe inside text content (between tags). */
export function escapeText(s: string): string {
  let out = '';
  let lastFlush = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let repl: string | null = null;
    if (c === 38 /* & */) repl = AMP;
    else if (c === 60 /* < */) repl = LT;
    else if (c === 62 /* > */) repl = GT;
    if (repl !== null) {
      if (i !== lastFlush) out += s.slice(lastFlush, i);
      out += repl;
      lastFlush = i + 1;
    }
  }
  return lastFlush === 0 ? s : out + s.slice(lastFlush);
}

/** Escape a string to be safe inside a double-quoted attribute value. Also escapes `<` since
 * it is occasionally consumed by tools that don't strictly follow HTML5 attribute parsing. */
export function escapeAttr(s: string): string {
  let out = '';
  let lastFlush = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let repl: string | null = null;
    if (c === 38 /* & */) repl = AMP;
    else if (c === 34 /* " */) repl = QUOT;
    else if (c === 39 /* ' */) repl = APOS;
    else if (c === 60 /* < */) repl = LT;
    if (repl !== null) {
      if (i !== lastFlush) out += s.slice(lastFlush, i);
      out += repl;
      lastFlush = i + 1;
    }
  }
  return lastFlush === 0 ? s : out + s.slice(lastFlush);
}

/** True if the string has no characters that would break inside a script JSON template. */
export function isJsonSafe(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 60 /* < */ || c === 62 /* > */ || c === 38 /* & */) return false;
  }
  return true;
}

/** Make a JSON string safe to embed inside `<template data-wompo-props>...</template>`. */
export function safeJsonForTemplate(s: string): string {
  // The browser parses <template> as raw markup, so `</template>` inside the JSON would close
  // the tag. Escape `<` to its unicode escape.
  let out = '';
  let lastFlush = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 60 /* < */) {
      if (i !== lastFlush) out += s.slice(lastFlush, i);
      out += '\\u003c';
      lastFlush = i + 1;
    }
  }
  return lastFlush === 0 ? s : out + s.slice(lastFlush);
}
