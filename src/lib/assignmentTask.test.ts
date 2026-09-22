import { describe, expect, it } from 'vitest';
import { formatAssignmentTaskLabel, gatedLessonIds } from './assignmentTask';

describe('formatAssignmentTaskLabel', () => {
  it('keeps a teacher-provided title', () => {
    expect(formatAssignmentTaskLabel('Article annotation', 0)).toBe('Article annotation');
  });

  it.each([null, undefined, '', '   '])('falls back to a readable task number for %j', (title) => {
    expect(formatAssignmentTaskLabel(title, 0)).toBe('Task 1');
  });
});

describe('gatedLessonIds', () => {
  it('keeps only the lessons the server gates on', () => {
    // "Checkpoint 1" (id 99) was ticked into the task but the server does not gate on it.
    expect(gatedLessonIds([12, 99], { ready: true, missing: [], lesson_ids: [12] })).toEqual([12]);
  });

  it('falls back to every task lesson when the server sent no lesson_ids', () => {
    expect(gatedLessonIds([12, 99], { ready: false, missing: [] })).toEqual([12, 99]);
  });

  it('falls back to every task lesson when there is no gate at all', () => {
    expect(gatedLessonIds([12, 99])).toEqual([12, 99]);
    expect(gatedLessonIds([12, 99], null)).toEqual([12, 99]);
  });

  it('returns an empty list when every linked lesson is excluded', () => {
    expect(gatedLessonIds([99], { ready: true, missing: [], lesson_ids: [] })).toEqual([]);
  });

  it('tolerates a missing lesson id list', () => {
    expect(gatedLessonIds(undefined, { ready: true, missing: [], lesson_ids: [12] })).toEqual([]);
  });
});
