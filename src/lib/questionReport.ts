const FALLBACK = 'Failed to submit report. Please try again.';

/**
 * What to tell a student whose error report was refused.
 *
 * The server refuses a report for reasons the student can act on — the message was too short
 * to be useful, or they have hit the daily ceiling — and says so in `detail`. Showing
 * "please try again" instead is worse than useless: it invites exactly the retry that will
 * fail the same way.
 *
 * `detail` is only trusted when it is a string; FastAPI's validation errors put an array
 * there, which would otherwise render as "[object Object]".
 */
export function reportErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : FALLBACK;
}
