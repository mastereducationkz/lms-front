/**
 * Links from the LMS into the CRM curator workspace.
 *
 * Onboarding, the client list, groups and the student card now live in the CRM. The LMS
 * keeps the advanced curator tools (homework review, tasks, leaderboard, exams, chat,
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
export const CRM_ONBOARDING_URL = `${CRM_WEB_URL}/curator/onboarding`;
export const CRM_CLIENTS_URL = `${CRM_WEB_URL}/curator/clients`;

/** The CRM card for a student, by their LMS id. Resolves or offers reconciliation there. */
export const crmStudentUrl = (lmsStudentId: number) =>
  `${CRM_WEB_URL}/students/lms/${lmsStudentId}`;
