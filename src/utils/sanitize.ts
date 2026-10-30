/**
 * Sanitizes strings that come from a remote endpoint (search results, model
 * names, error messages) before they reach a terminal.
 */

// Control characters (C0, DEL, C1) except newline and tab, plus the Unicode
// bidirectional marks and embedding/override/isolate controls that can visually
// reorder text (e.g. make a URL read as a different domain).
// JSON output keeps every character but writes these ones as \uXXXX escapes (see `stringifyJson`).
const UNSAFE_CHARS = /[^\P{Cc}\n\t]|[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/**
 * Drops control characters (keeping newline and tab) and bidi controls, so a
 * hostile endpoint cannot smuggle terminal escape sequences or spoof text in
 * the CLI output.
 */
export function stripControlChars(value: string): string {
  return value.replace(UNSAFE_CHARS, "");
}

/**
 * Like `stripControlChars`, but also collapses newlines and tabs into single
 * spaces, for values that must stay on one line (error messages, table cells).
 */
export function toSingleLine(value: string): string {
  return stripControlChars(value).replace(/[\n\t]+/g, " ");
}

/**
 * `JSON.stringify` for output that may end up on a terminal. JSON.stringify
 * already escapes the C0 controls, but leaves DEL, the C1 controls and the bidi
 * controls literal; this writes them as `\uXXXX` escapes too, so the document
 * parses to the same value and a hostile endpoint cannot reach the terminal.
 */
export function stringifyJson(value: unknown, space?: number): string {
  return JSON.stringify(value, null, space).replace(
    UNSAFE_CHARS,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
