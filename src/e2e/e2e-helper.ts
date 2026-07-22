/**
 * Shared helpers for end-to-end tests.
 *
 * E2E tests drive the real CLI the way a user would: by spawning it as a child
 * process. By default the CLI source is run via `tsx`; set `WEBSEEK_CMD` to a
 * built binary path to test the compiled output instead.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const originalCwd = process.cwd();

export const execFileAsync = promisify(execFile);

const tsxPath = join(originalCwd, "node_modules", ".bin", "tsx");
const cliPath = join(originalCwd, "src", "cli", "index.ts");

export const webseekCmd = process.env.WEBSEEK_CMD
  ? join(originalCwd, process.env.WEBSEEK_CMD)
  : tsxPath;
export const webseekArgs = process.env.WEBSEEK_CMD ? [] : [cliPath];

/** A process environment without inherited provider credentials or `undefined` values. */
const providerCredentialEnvNames = new Set([
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_CSE_CX",
  "GEMINI_API_KEY",
  "VERTEX_API_KEY",
]);

export function cleanEnv(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !providerCredentialEnvNames.has(key)) {
      base[key] = value;
    }
  }
  return { ...base, ...overrides };
}

export interface RunCliResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number;
}

/** Run the CLI with the given args, capturing stdout/stderr and the exit code. */
export async function runCli(params: {
  args: string[];
  env?: Record<string, string>;
}): Promise<RunCliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(webseekCmd, [...webseekArgs, ...params.args], {
      env: cleanEnv(params.env),
    });
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const execError = error as ExecError;
    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
      code: typeof execError.code === "number" ? execError.code : 1,
    };
  }
}
