/**
 * Links to one lesson's own page, `/lessons/:id` (owner, 2026-09-28): the calendar card, the journal,
 * the Meet page, recordings, materials, homework, the dashboard and the Telegram invitation all open
 * the same page, at the section that brought the reader there.
 */

export type LessonSection = 'materials' | 'recording' | 'register' | 'homework' | 'notes' | 'meet' | 'requests';

/** The production site, as the backend's `lms_url` writes it — invitations are sent from any browser,
 *  including a teacher's localhost, and must always open the real LMS for students. A staging build
 *  (`.env.staging`) points them at staging instead. */
export const LMS_ORIGIN = (
  (import.meta.env.VITE_LMS_ORIGIN as string | undefined) || 'https://lms.mastereducation.kz'
).replace(/\/$/, '');

/** `/lessons/123`, or `/lessons/123#materials` to land on one section. */
export function lessonPath(id: number, section?: LessonSection): string {
  return `/lessons/${id}${section ? `#${section}` : ''}`;
}

/** The absolute address, for text that leaves the LMS (a group-chat invitation). */
export function lessonUrl(id: number, section?: LessonSection): string {
  return `${LMS_ORIGIN}${lessonPath(id, section)}`;
}
