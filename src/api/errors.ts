type RequestFailure = {
  message?: unknown;
  response?: { status?: number; data?: { reason?: unknown; message?: unknown } };
};

/**
 * A request failure as text for the console: its status and the API's reason and message — never the error object
 * itself, whose `config` carries the request's headers (Authorization, the court and match QR tokens, the court
 * password).
 */
export const describeRequestError = (error: unknown): string => {
  if (typeof error === "string") return error;
  const failure = error as RequestFailure | null | undefined;
  const response = failure?.response;
  if (response?.status) {
    const reason = typeof response.data?.reason === "string" && response.data.reason ? ` ${response.data.reason}` : "";
    const message = typeof response.data?.message === "string" && response.data.message ? `: ${response.data.message}` : "";
    return `HTTP ${response.status}${reason}${message}`;
  }
  return typeof failure?.message === "string" && failure.message ? failure.message : "Unknown error";
};
