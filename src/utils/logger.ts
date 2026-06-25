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

export interface CreateConsoleLoggerParams {
  /** Suppress info/warn diagnostics. Errors and results are always emitted. */
  silent?: boolean;
  /** When true, diagnostics are written to stderr only (used by the MCP server). */
  diagnosticsOnly?: boolean;
}

function writeErr(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function createConsoleLogger(params: CreateConsoleLoggerParams = {}): Logger {
  const silent = params.silent ?? process.env.NODE_ENV === "test";
  const diagnosticsOnly = params.diagnosticsOnly ?? false;

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
      if (diagnosticsOnly) {
        writeErr(text);
        return;
      }
      process.stdout.write(`${text}\n`);
    },
  };
}
