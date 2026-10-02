import { describe, expect, it } from "vitest";

import { toStatsRequest } from "./stats.js";

const now = new Date(2026, 9, 1, 12);

describe("toStatsRequest", () => {
  it("defaults to this year with only the summary", () => {
    expect(toStatsRequest({ options: {}, now })).toMatchObject({
      range: { label: "2026 so far" },
      provider: undefined,
      cost: false,
      models: false,
      json: false,
    });
  });

  it("turns on every section with --full", () => {
    expect(toStatsRequest({ options: { full: true }, now })).toMatchObject({
      cost: true,
      models: true,
    });
  });

  it("parses the range, provider and limit", () => {
    expect(
      toStatsRequest({ options: { days: "7", provider: "gemini", limit: "3" }, now }),
    ).toMatchObject({ range: { label: "last 7 days" }, provider: "gemini", limit: 3 });
  });

  it("rejects combined range flags", () => {
    expect(() => toStatsRequest({ options: { days: "7", all: true }, now })).toThrowError(
      /cannot be combined/,
    );
  });

  it("rejects bad numbers and providers", () => {
    expect(() => toStatsRequest({ options: { days: "-1" }, now })).toThrowError(/--days/);
    expect(() => toStatsRequest({ options: { limit: "0" }, now })).toThrowError(/--limit/);
    expect(() => toStatsRequest({ options: { year: "20x" }, now })).toThrowError(/--year/);
    expect(() => toStatsRequest({ options: { provider: "bing" }, now })).toThrowError(/provider/);
  });
});
