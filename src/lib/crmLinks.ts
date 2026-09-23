/**
 * Links from the LMS into the CRM curator workspace.
 *
 * Curator tasks («Задачи»), the client list, groups and the student card live in the CRM.
 * The LMS keeps the advanced curator tools (homework review, leaderboard, exams, chat,
 * calendar, deep analytics), so curators move between the two during a normal day — these
 * are the way back.
 *
 * Same identity and the same SSO session on both sides, so these are ordinary links; no
 * handoff or token exchange is involved.
 */

export const CRM_WEB_URL = (
  (import.meta.env.VITE_CRM_WEB_URL as string | undefined) ||
  'https://crm.mastereducation.kz'
).replace(/\/$/, '');

export const CRM_WORKSPACE_URL = `${CRM_WEB_URL}/curator`;
export const CRM_TASKS_URL = `${CRM_WEB_URL}/curator/tasks`;
export const CRM_CLIENTS_URL = `${CRM_WEB_URL}/curator/clients`;

/** The CRM card for a student, by their LMS id. Resolves or offers reconciliation there. */
export const crmStudentUrl = (lmsStudentId: number) =>
  `${CRM_WEB_URL}/students/lms/${lmsStudentId}`;

/**
 * Where an old LMS tasks or onboarding link lands: the CRM's «Задачи».
 *
 * Only parameters the CRM list understands are carried across (a head's curator filter, a
 * category, one task to open); anything else would be noise in a screen that never asked
 * for it.
 */
export function buildCrmTasksUrl(search: string): string {
  const incoming = new URLSearchParams(search);
  const outgoing = new URLSearchParams();
  for (const key of ['curator_id', 'category', 'task'] as const) {
    const value = incoming.get(key);
    if (value) outgoing.set(key, value);
  }
  const query = outgoing.toString();
  return `${CRM_TASKS_URL}${query ? `?${query}` : ''}`;
}
