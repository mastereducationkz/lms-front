import type { MessageTable } from '../types';

/**
 * Refusals the backend names with a `reason_code` (lms-backend src/utils/coded_errors.py). The
 * key is `serverErrors.<reason_code>`; placeholders come from the response's `reason_details`.
 * The English text matches what the server sends; the Russian is what curators read.
 */
export const serverErrors = {
  'serverErrors.password_policy': 'Password must be at least 8 characters long and include a digit',
  'serverErrors.password_too_long': 'Password must be at most {max} characters long',
  'serverErrors.password_whitespace': 'Password can’t be only spaces',
  'serverErrors.password_too_common': 'This password is too common; choose another one',
  'serverErrors.reset_link_invalid': 'This link is invalid or has expired',
  'serverErrors.reset_link_used': 'This link is invalid or has already been used',
  'serverErrors.wrong_current_password': 'Current password is incorrect',
  'serverErrors.class_lesson_not_found': 'Lesson not found',
  'serverErrors.class_lesson_forbidden': 'You don’t have access to this lesson',
  'serverErrors.lesson_notes_teacher_only': 'Lesson notes are written by the teacher who teaches the lesson',
  'serverErrors.lesson_note_too_long': 'No more than {max} characters',
  'serverErrors.attendance_teacher_only': 'Attendance is marked by the teacher who teaches this lesson',
  'serverErrors.scores_teacher_only': 'Scores are given by the teacher who teaches this lesson',
  'serverErrors.excused_requires_note': 'An excused absence needs a reason',
  'serverErrors.excused_only_absence': 'Only an absence can be excused',
  'serverErrors.lesson_already_taught': 'The lesson on {date} has already been taught (marks given: {marks}). Moving it would carry those marks to the new date, as if the lesson happened then. To teach it again, add a new lesson; if the marks are a mistake, remove them first.',
  'serverErrors.no_free_slot': 'No free slot for an extra lesson for “{group}” in the next {weeks} weeks. Check the group’s schedule or choose “cancel only”.',
  'serverErrors.cancelled_lesson_not_scheduled': 'The lesson being cancelled isn’t in the schedule, so a lesson can’t be added at the end of the course. Choose “cancel only”.',
  'serverErrors.webinar_series_needs_end': 'Set an end date for the repeats: without it the next webinars aren’t created, so they get no Meet room, no recording and no pay for the host.',
  'serverErrors.lesson_not_found': 'Lesson not found. It may have been deleted, or the link is out of date.',
  'serverErrors.course_access_denied': 'You don’t have access to this course. If that’s a mistake, message your curator.',
  'serverErrors.role_denied': 'Your role doesn’t have access to lesson materials.',
  'serverErrors.recording_not_found': 'This lesson has no recording, so there is nothing to remove.',
  'serverErrors.module_not_released': 'This module opens in week {module_week} of the program; it’s week {current_week} now.',
} as const satisfies MessageTable;
