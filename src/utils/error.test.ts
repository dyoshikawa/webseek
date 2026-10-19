import { describe, expect, it } from "vitest";

import { formatError, WebseekError } from "./error.js";

describe("formatError", () => {
  it("strips control characters from provider error messages", () => {
    const error = new WebseekError({
      code: "provider_error",
      message: "boom\u001b]52;c;ZXZpbA==\u0007",
    });
    expect(formatError(error)).toBe("[provider_error] boom]52;c;ZXZpbA==");
  });

  it("strips control characters from plain errors and strings", () => {
    expect(formatError(new Error("a\u001b[2Jb"))).toBe("a[2Jb");
    expect(formatError("a\u009bb")).toBe("ab");
  });

  it("renders values JSON cannot serialize", () => {
    expect(formatError(undefined)).toBe("undefined");
    expect(formatError({ a: 1 })).toBe('{"a":1}');
  });
});
