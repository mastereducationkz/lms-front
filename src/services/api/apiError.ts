/**
 * What an API wrapper throws for a failed call: an `Error` whose message is the server's `detail`
 * (or `fallback`), with the AxiosError kept as its `cause`.
 *
 * Throwing a bare `new Error(...)` hid which request failed, so the Sentry rules for a dropped
 * connection, a 401 or a 5xx (src/lib/sentryFilters.ts) never applied and a student's flaky
 * Safari connection was reported as a defect (LMS-FRONT-C).
 */
export function apiError(error: any, fallback: string): Error {
  return Object.assign(new Error(error?.response?.data?.detail || fallback), { cause: error });
}

/** The backend's stable `reason_code` behind an error thrown by `apiError`, or null (a refusal's wording is localized; its code is not). */
export function reasonCodeOf(error: unknown): string | null {
  const code = (error as { cause?: { response?: { data?: { reason_code?: unknown } } } } | null)?.cause?.response?.data?.reason_code;
  return typeof code === 'string' ? code : null;
}
