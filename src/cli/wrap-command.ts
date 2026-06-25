/**
 * Wraps a commander action so every command shares the same error handling:
 * a logger is created, the handler runs, and any thrown value is formatted to
 * stderr and mapped to a process exit code.
 */

import { errorExitCode, formatError } from "../utils/error.js";
import { createConsoleLogger, type Logger } from "../utils/logger.js";

export type CommandHandler<Args extends unknown[]> = (
  params: { logger: Logger },
  ...args: Args
) => Promise<void> | void;

/**
 * Returns a commander-compatible action. Commander invokes actions with the
 * command's positionals/options followed by the Command instance, all of which
 * are forwarded to the handler.
 */
export function wrapCommand<Args extends unknown[]>(
  handler: CommandHandler<Args>,
): (...args: Args) => Promise<void> {
  return async (...args: Args): Promise<void> => {
    const logger = createConsoleLogger();
    try {
      await handler({ logger }, ...args);
    } catch (error) {
      logger.error(formatError(error));
      process.exitCode = errorExitCode(error);
    }
  };
}
