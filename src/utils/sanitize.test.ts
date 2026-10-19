import { describe, expect, it } from "vitest";

import { stripControlChars } from "./sanitize.js";

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
});
