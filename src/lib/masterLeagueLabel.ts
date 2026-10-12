/**
 * «В ML до 04.11»: a student attending Master League in addition to their home group.
 *
 * The backend decides who and until when (`GET /student-journal/*`, `master_league`); this is only
 * how the date is written, as day.month without the year, because the label is about this month.
 */
export interface MasterLeagueMembership {
  group_id: number
  group_name: string
  /** The ML group's last lesson day in Almaty, `YYYY-MM-DD`. */
  until: string
}

/** `2026-11-04` -> `04.11`. A value that is not an ISO date is returned as it came. */
export function masterLeagueUntilShort(until: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until.slice(8, 10)}.${until.slice(5, 7)}` : until
}
