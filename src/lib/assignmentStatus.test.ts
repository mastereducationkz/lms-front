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

  it('follows the reader’s language', () => {
    expect(formatAssignmentStatus('needs_revision', 'ru')).toBe('Нужна доработка');
    expect(formatAssignmentStatus('graded', 'ru')).toBe('Проверено');
  });

  it('formats an unknown API status without exposing underscores', () => {
    expect(formatAssignmentStatus('awaiting_teacher_review')).toBe('Awaiting Teacher Review');
  });
});
