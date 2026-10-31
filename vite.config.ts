import { defineConfig } from "vite-plus";

// One file configures the whole Vite+ toolchain: the library build
// (`vp pack`), the formatter (`fmt`), the linter (`lint`) and the pre-commit
// checks (`staged`). The unit and e2e tests have their own
// `vitest.config.ts` / `vitest.e2e.config.ts`.
export default defineConfig({
  // `vp pack` (tsdown). Dual-format build: an ESM + CJS library entry
  // (`src/index.ts`) plus the CLI binary (`src/cli/index.ts`). tsdown emits
  // matching `.d.mts`/`.d.cts` declarations and externalizes `dependencies`
  // automatically, so commander, zod, and the MCP SDK are not bundled into the
  // output. The build target follows `engines.node` in package.json.
  pack: {
    entry: ["src/index.ts", "src/cli/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: false,
    outDir: "dist",
  },

  // `vp fmt` (Oxfmt).
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    arrowParens: "always",
    experimentalSortImports: {},
    ignorePatterns: [
      "package.json",
      "node_modules/**",
      "dist/**",
      "dist*/**",
      "CLAUDE.md",
      "AGENTS.md",
      "opencode.jsonc",
      ".claude/**",
      ".opencode/**",
    ],
    overrides: [
      {
        files: ["**/*.json", "**/*.jsonc"],
        options: { trailingComma: "none" },
      },
    ],
  },

  // `vp lint` (Oxlint). Type checking stays with `tsc` (`pnpm typecheck`):
  // Oxlint's type-aware mode would add rules this project does not use.
  lint: {
    plugins: ["typescript", "import", "unicorn"],
    // Vite+'s own rule, which reports `vite` / `vitest` imports that should
    // come from `vite-plus`.
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    categories: {
      correctness: "error",
      suspicious: "warn",
      style: "off",
      pedantic: "off",
    },
    rules: {
      complexity: ["error", { max: 20 }],
      eqeqeq: "error",
      "import/no-cycle": "error",
      "no-console": "error",
      "no-new": "off",
      "no-underscore-dangle": "off",
      "typescript/no-explicit-any": "warn",
      "unicorn/prefer-node-protocol": "error",
      "unicorn/no-array-reduce": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    env: {
      browser: false,
      node: true,
      es2024: true,
    },
    ignorePatterns: ["dist/**", "coverage/**", "*.d.ts", "node_modules/**"],
    overrides: [
      {
        files: ["**/*.test.ts"],
        rules: {
          "typescript/no-explicit-any": "off",
          "no-console": "error",
        },
      },
    ],
  },

  // `vp staged`, run by the pre-commit hook (`.vite-hooks/pre-commit`).
  staged: {
    "*": "npx secretlint",
  },
});
