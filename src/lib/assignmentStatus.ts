const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  submitted: 'Submitted',
  graded: 'Graded',
  overdue: 'Overdue',
  needs_revision: 'Needs revision',
  draft: 'Draft',
  in_progress: 'In progress',
};

/** Convert API status values into readable student-facing labels. */
export function formatAssignmentStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  return ASSIGNMENT_STATUS_LABELS[normalized]
    ?? normalized.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
