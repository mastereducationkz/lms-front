/**
 * The Master League progress digest in the bell (lms-backend `src/master_league/digest.py`): a
 * student's own movement from their starting point, after a new full test and as a Sunday summary.
 * The backend writes plain text with line breaks; a notice is read in full in the popover (not
 * clamped to two lines like the others) and opens the dashboard, where the season banner is.
 */
export const ML_PROGRESS_NOTIFICATION_TYPES = ['ml_progress_score', 'ml_progress_weekly'];

export function isMlProgressNotice(type: string): boolean {
  return ML_PROGRESS_NOTIFICATION_TYPES.includes(type);
}
