/** Escape a string to be safe inside text content (between tags). */
export declare function escapeText(s: string): string;
/** Escape a string to be safe inside a double-quoted attribute value. Also escapes `<` since
 * it is occasionally consumed by tools that don't strictly follow HTML5 attribute parsing. */
export declare function escapeAttr(s: string): string;
/** True if the string has no characters that would break inside a script JSON template. */
export declare function isJsonSafe(s: string): boolean;
/** Make a JSON string safe to embed inside `<template data-wompo-props>...</template>`. */
export declare function safeJsonForTemplate(s: string): string;
