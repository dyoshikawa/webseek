import { describe, expect, it } from "vitest";

import { stringifyJson, stripControlChars, toSingleLine } from "./sanitize.js";

describe("stripControlChars", () => {
  it("drops C0, DEL and C1 control characters but keeps newline and tab", () => {
    expect(stripControlChars("a\u001b[31mb\u0007c\r\u007f\u009b\nd\te")).toBe("a[31mbc\nd\te");
  });

  it("drops bidi embedding, override and isolate controls", () => {
    expect(stripControlChars("left\u202Eright\u202C \u2066x\u2069")).toBe("leftright x");
  });

  it("leaves ordinary text untouched", () => {
    expect(stripControlChars("Café — 日本語 🎉")).toBe("Café — 日本語 🎉");
  });

  it("drops bidi marks", () => {
    expect(stripControlChars("a\u200Eb\u200Fc\u061Cd")).toBe("abcd");
  });
});

describe("toSingleLine", () => {
  it("collapses newlines and tabs into spaces after stripping controls", () => {
    expect(toSingleLine("a\n\nb\tc\u001b[0m")).toBe("a b c[0m");
  });
});

describe("stringifyJson", () => {
  it("escapes DEL, C1 and bidi controls so they never reach a terminal", () => {
    const value = { t: "a\u009b31mb\u202ec\u007fd\u001be\u200f" };
    const text = stringifyJson(value, 2);
    expect(text).not.toMatch(/[\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u);
    expect(text).toContain("\\u009b");
    expect(JSON.parse(text)).toEqual(value);
  });

  it("matches JSON.stringify for ordinary text", () => {
    const value = { a: "Café — 日本語 🎉\n\t", b: [1, null] };
    expect(stringifyJson(value, 2)).toBe(JSON.stringify(value, null, 2));
  });
});
