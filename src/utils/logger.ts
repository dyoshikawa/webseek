/**
 * Minimal logger abstraction shared by the CLI.
 *
 * Diagnostics (info/warn/error) go to stderr so they never corrupt the primary
 * result on stdout — this also keeps stdout clean for the MCP stdio transport,
 * which speaks JSON-RPC over stdout.
 */

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** The primary, user-facing result. Goes to stdout for the CLI. */
  result(text: string): void;
}

function writeErr(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function createConsoleLogger(): Logger {
  // Info/warn diagnostics are suppressed under tests; errors and results are always emitted.
  const silent = process.env.NODE_ENV === "test";

  return {
    info: (message) => {
      if (!silent) {
        writeErr(message);
      }
    },
    warn: (message) => {
      if (!silent) {
        writeErr(`warning: ${message}`);
      }
    },
    error: (message) => {
      writeErr(message);
    },
    result: (text) => {
      process.stdout.write(`${text}\n`);
    },
  };
}
