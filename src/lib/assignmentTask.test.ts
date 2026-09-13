import { describe, expect, it } from 'vitest';
import { formatAssignmentTaskLabel } from './assignmentTask';

describe('formatAssignmentTaskLabel', () => {
  it('keeps a teacher-provided title', () => {
    expect(formatAssignmentTaskLabel('Article annotation', 0)).toBe('Article annotation');
  });

  it.each([null, undefined, '', '   '])('falls back to a readable task number for %j', (title) => {
    expect(formatAssignmentTaskLabel(title, 0)).toBe('Task 1');
  });
});
