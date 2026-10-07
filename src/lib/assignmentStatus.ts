import { activeLocale, t, type Locale, type MessageKey } from './i18n';
import '@/lib/i18n/catalogs/homework';

const ASSIGNMENT_STATUS_LABELS: Record<string, MessageKey> = {
  not_started: 'homework.status.notStarted',
  submitted: 'homework.status.submitted',
  graded: 'homework.status.graded',
  overdue: 'homework.status.overdue',
  needs_revision: 'homework.status.needsRevision',
  draft: 'homework.status.draft',
  in_progress: 'homework.status.inProgress',
};

/** Convert API status values into readable student-facing labels (an unknown status shows its own words). */
export function formatAssignmentStatus(status: string, locale: Locale = activeLocale()): string {
  const normalized = status.trim().toLowerCase();
  const key = ASSIGNMENT_STATUS_LABELS[normalized];
  return key
    ? t(key, undefined, locale)
    : normalized.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
