import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/e2e/**/*.spec.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    watch: false,
    // E2E tests spawn the CLI as a child process and use real network sockets
    // (against a local mock server); run them serially for stable ports/output.
    maxWorkers: 1,
    fileParallelism: false,
  },
});
