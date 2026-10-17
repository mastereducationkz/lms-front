import { describe, expect, it } from 'vitest';
import { activityRows, activityTotals, owedLessonPath } from './activityGaps';
import type { OwedLesson } from '../services/api/head-teacher';

const lesson = (event_id: number, kind: OwedLesson['kind'], missing = 1): OwedLesson => ({
  event_id, title: `Lesson ${event_id}`, group_id: 2, group_name: 'July 8 SAT - Gulzada', start: '2026-10-16T14:00:00Z', kind, missing,
});

describe('activityRows', () => {
  it('reads an empty or absent answer as nobody owing anything', () => {
    expect(activityRows(undefined)).toEqual([]);
    expect(activityRows(null)).toEqual([]);
    expect(activityRows([])).toEqual([]);
  });

  it('keeps the server’s counts and drops teachers who owe nothing', () => {
    const rows = activityRows([
      { teacher_id: 1, teacher_name: 'Aisha', scores_lessons: 0, register_lessons: 0, items: [] },
      { teacher_id: 2, teacher_name: 'Gulzada', scores_lessons: 3, register_lessons: 1, items: [lesson(10, 'scores'), lesson(11, 'register')] },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ teacher_id: 2, scores: 3, register: 1 });
    expect(rows[0].items.map((i) => i.event_id)).toEqual([10, 11]);
  });

  it('counts from the items when the server leaves a count out', () => {
    const [row] = activityRows([{ teacher_id: 2, teacher_name: 'Gulzada', items: [lesson(10, 'scores'), lesson(12, 'scores'), lesson(11, 'register')] }]);
    expect(row).toMatchObject({ scores: 2, register: 1 });
  });

  it('survives a half-written answer', () => {
    const rows = activityRows([
      { teacher_id: 3, teacher_name: 'Dana', scores_lessons: -2, register_lessons: Number.NaN, items: [{ kind: 'scores' } as OwedLesson, lesson(5, 'scores')] },
    ]);
    // Both counts are junk, so they come from the one well-formed item; the item without an id is gone.
    expect(rows).toEqual([expect.objectContaining({ scores: 1, register: 0 })]);
    expect(rows[0].items).toHaveLength(1);
  });

  it('puts the teacher with most scores outstanding first, then most hand-backs, then by name', () => {
    const rows = activityRows([
      { teacher_id: 1, teacher_name: 'Zhanar', scores_lessons: 2, register_lessons: 0 },
      { teacher_id: 2, teacher_name: 'Aisha', scores_lessons: 2, register_lessons: 0 },
      { teacher_id: 3, teacher_name: 'Bota', scores_lessons: 2, register_lessons: 4 },
      { teacher_id: 4, teacher_name: 'Dana', scores_lessons: 0, register_lessons: 9 },
      { teacher_id: 5, teacher_name: 'Eldana', scores_lessons: 7, register_lessons: 0 },
    ]);
    expect(rows.map((r) => r.teacher_name)).toEqual(['Eldana', 'Bota', 'Aisha', 'Zhanar', 'Dana']);
  });
});

describe('activityTotals', () => {
  it('adds up both kinds of debt across teachers', () => {
    const rows = activityRows([
      { teacher_id: 1, teacher_name: 'A', scores_lessons: 2, register_lessons: 1 },
      { teacher_id: 2, teacher_name: 'B', scores_lessons: 5, register_lessons: 0 },
    ]);
    expect(activityTotals(rows)).toEqual({ scores: 7, register: 1 });
    expect(activityTotals([])).toEqual({ scores: 0, register: 0 });
  });
});

describe('owedLessonPath', () => {
  it('opens the lesson’s own page', () => {
    expect(owedLessonPath(lesson(18947, 'scores'))).toBe('/lessons/18947');
  });
});
