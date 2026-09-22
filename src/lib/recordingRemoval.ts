/**
 * Removing a lesson recording from circulation.
 *
 * Mirrors `src/services/recording_removal.py` on the backend, which is the authority — this
 * only decides whether to offer the button.
 */

/**
 * Head curators can watch every recording (`ALL_RECORDINGS_ROLES`) but cannot remove one:
 * watching and pulling are different permissions, and removal is an editorial and payroll act.
 */
const REMOVAL_ROLES = new Set(['admin', 'head_teacher']);

export function canRemoveRecording(role: string | undefined | null): boolean {
  return REMOVAL_ROLES.has(role ?? '');
}

/**
 * What to tell staff about a recording that is gone, or null when it is fine.
 *
 * A recording can read `removed` for two unrelated reasons — a human pulled it, or the
 * 12-month video retention purged it — and only the first has a reason attached. Saying
 * "removed by staff" about a retention purge would invent an accusation, so the reason is
 * what distinguishes them.
 */
export function removalNotice(
  recording: { status?: string; hidden_reason?: string | null } | null | undefined,
): string | null {
  if (!recording || recording.status !== 'removed') return null;
  const reason = recording.hidden_reason?.trim();
  return reason ? `Removed by staff — ${reason}` : 'No longer available';
}
