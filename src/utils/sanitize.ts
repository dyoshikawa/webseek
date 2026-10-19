/**
 * Sanitizes strings that come from a remote endpoint (search results, model
 * names, error messages) before they reach a terminal.
 */

// Control characters (C0, DEL, C1) except newline and tab, plus the Unicode
// bidirectional embedding/override/isolate controls that can visually reorder
// text (e.g. make a URL read as a different domain).
const UNSAFE_CHARS = /[^\P{Cc}\n\t]|[\u202A-\u202E\u2066-\u2069]/gu;

/**
 * Drops control characters (keeping newline and tab) and bidi controls, so a
 * hostile endpoint cannot smuggle terminal escape sequences or spoof text in
 * the CLI output.
 */
export function stripControlChars(value: string): string {
  return value.replace(UNSAFE_CHARS, "");
}
