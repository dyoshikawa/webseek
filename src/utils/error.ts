/**
 * Consistent error formatting for the CLI.
 *
 * Provider calls fail in predictable ways (missing credentials, auth rejected,
 * quota exhausted, malformed responses). `WebsearchError` carries a stable
 * `code` so the CLI can map failures to exit codes and a clear message, while
 * `formatError` renders any thrown value into a single human-readable string.
 */

export type WebsearchErrorCode =
  | "missing_config"
  | "auth_failed"
  | "rate_limited"
  | "provider_error"
  | "invalid_response"
  | "invalid_usage";

export interface WebsearchErrorOptions {
  code: WebsearchErrorCode;
  message: string;
  cause?: unknown;
}

export class WebsearchError extends Error {
  readonly code: WebsearchErrorCode;

  constructor(options: WebsearchErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "WebsearchError";
    this.code = options.code;
  }
}

/**
 * Map a thrown value to a process exit code: `2` for usage mistakes, `1` for
 * any other failure.
 */
export function errorExitCode(error: unknown): number {
  if (error instanceof WebsearchError) {
    return error.code === "invalid_usage" ? 2 : 1;
  }
  return 1;
}

/** Render any thrown value into a single-line, user-facing message. */
export function formatError(error: unknown): string {
  if (error instanceof WebsearchError) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(error);
}
