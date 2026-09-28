import { describe, expect, it } from 'vitest';
import { canScore, changedScores, lessonStarted, scoredCount } from './lessonScores';

describe('canScore', () => {
  it('takes present, late and not-yet-marked students', () => {
    expect(canScore('attended')).toBe(true);
    expect(canScore('late')).toBe(true);
    expect(canScore('registered')).toBe(true);
    expect(canScore(undefined)).toBe(true);
  });
  it('never an absence or a cancelled lesson', () => {
    expect(canScore('missed')).toBe(false);
    expect(canScore('cancelled')).toBe(false);
  });
});

describe('lessonStarted', () => {
  it('reads naive lesson times as UTC', () => {
    const now = new Date('2026-09-28T13:00:00Z');
    expect(lessonStarted('2026-09-28T13:00:00', now)).toBe(true);
    expect(lessonStarted('2026-09-28T13:00:01', now)).toBe(false);
    expect(lessonStarted('2026-09-28T12:00:00Z', now)).toBe(true);
  });
});

describe('changedScores', () => {
  it('sends only new or changed scores, sorted', () => {
    const loaded = new Map<number, number | null>([[1, 5], [2, null], [3, 7]]);
    const current = new Map<number, number | null>([[3, 8], [1, 5], [2, 0], [4, null]]);
    expect(changedScores(loaded, current)).toEqual([
      { student_id: 2, activity_score: 0 },
      { student_id: 3, activity_score: 8 },
    ]);
  });
  it('0 is a score, not nothing', () => {
    expect(changedScores(new Map(), new Map([[9, 0]]))).toEqual([{ student_id: 9, activity_score: 0 }]);
  });
});

describe('scoredCount', () => {
  it('counts among the students who can take a score', () => {
    const students = [
      { student_id: 1, attendance_status: 'attended' },
      { student_id: 2, attendance_status: 'missed' },
      { student_id: 3, attendance_status: 'registered' },
    ];
    expect(scoredCount(students, new Map([[1, 6], [2, 4]]))).toEqual({ scored: 1, of: 2 });
  });
});
