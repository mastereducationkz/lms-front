import { describe, expect, it } from 'vitest';
import { formatAssignmentStatus } from './assignmentStatus';

describe('formatAssignmentStatus', () => {
  it.each([
    ['not_started', 'Not started'],
    ['submitted', 'Submitted'],
    ['graded', 'Graded'],
    ['overdue', 'Overdue'],
    ['needs_revision', 'Needs revision'],
    ['draft', 'Draft'],
    ['in_progress', 'In progress'],
  ])('formats %s as %s', (status, label) => {
    expect(formatAssignmentStatus(status)).toBe(label);
  });

  it('formats an unknown API status without exposing underscores', () => {
    expect(formatAssignmentStatus('awaiting_teacher_review')).toBe('Awaiting Teacher Review');
  });
});
