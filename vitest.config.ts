import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["src/**/*.spec.ts"], // E2E tests run via vitest.e2e.config.ts
  },
});
