import { describe, expect, it } from "vitest";

import { resolveGeminiConfig, resolveGoogleCseConfig, resolveOpenAIConfig } from "./env.js";

describe("env config resolution", () => {
  it("resolves OpenAI key with the default base URL", () => {
    expect(resolveOpenAIConfig({ env: { OPENAI_API_KEY: "sk" } })).toEqual({
      apiKey: "sk",
      baseUrl: "https://api.openai.com",
    });
  });

  it("throws missing_config when OpenAI key is absent", () => {
    expect(() => resolveOpenAIConfig({ env: {} })).toThrowError(/OPENAI_API_KEY/);
  });

  it("allows overriding a provider base URL via env", () => {
    expect(
      resolveOpenAIConfig({
        env: { OPENAI_API_KEY: "sk", WEBSEEK_OPENAI_BASE_URL: "http://localhost:1234/" },
      }).baseUrl,
    ).toBe("http://localhost:1234");
  });

  it("requires both key and cx for Google CSE", () => {
    expect(resolveGoogleCseConfig({ env: { GOOGLE_API_KEY: "k", GOOGLE_CSE_CX: "cx" } })).toEqual({
      apiKey: "k",
      cx: "cx",
      baseUrl: "https://www.googleapis.com",
    });
    expect(() => resolveGoogleCseConfig({ env: { GOOGLE_API_KEY: "k" } })).toThrowError(/CX/);
  });

  it("selects the credential per Gemini backend", () => {
    expect(resolveGeminiConfig({ env: { GEMINI_API_KEY: "g" }, backend: "gemini-api" })).toEqual({
      apiKey: "g",
      backend: "gemini-api",
      baseUrl: "https://generativelanguage.googleapis.com",
    });
    expect(
      resolveGeminiConfig({ env: { VERTEX_API_KEY: "v" }, backend: "vertex-express" }),
    ).toEqual({
      apiKey: "v",
      backend: "vertex-express",
      baseUrl: "https://aiplatform.googleapis.com",
    });
  });
});
