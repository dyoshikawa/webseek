/**
 * Maps a failed provider HTTP response to a `WebseekError`. Every provider
 * signals rate limiting with 429 and is otherwise a generic provider error;
 * only the statuses that mean "credentials rejected" differ between APIs.
 */

import { WebseekError } from "../utils/error.js";

export interface ToProviderHttpErrorParams {
  status: number;
  /** The provider's own error message, or a fallback naming the provider and status. */
  message: string;
  /** HTTP statuses this provider uses for rejected credentials. */
  authFailedStatuses: readonly number[];
}

export function toProviderHttpError(params: ToProviderHttpErrorParams): WebseekError {
  const { status, message } = params;
  if (params.authFailedStatuses.includes(status)) {
    return new WebseekError({ code: "auth_failed", message });
  }
  if (status === 429) {
    return new WebseekError({ code: "rate_limited", message });
  }
  return new WebseekError({ code: "provider_error", message });
}
