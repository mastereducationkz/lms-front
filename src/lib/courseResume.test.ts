import { describe, expect, it } from 'vitest';
import { resumeLessonPath, resumeStepIndex } from './courseResume';

const steps = [{ id: 10 }, { id: 11 }, { id: 12 }];

describe('resumeStepIndex', () => {
  it('is null when nothing was opened', () => {
    expect(resumeStepIndex(steps, [])).toBeNull();
    expect(resumeStepIndex(steps, null)).toBeNull();
  });

  it('picks the most recently opened step, not the furthest', () => {
    expect(
      resumeStepIndex(steps, [
        { step_id: 12, visited_at: '2026-10-28T09:05:00Z' },
        { step_id: 10, visited_at: '2026-10-28T09:30:00Z' },
      ]),
    ).toBe(0);
  });

  it('ignores rows without a visit time and steps no longer in the lesson', () => {
    expect(
      resumeStepIndex(steps, [
        { step_id: 11, visited_at: null },
        { step_id: 99, visited_at: '2026-10-28T10:00:00Z' },
        { step_id: 12, visited_at: '2026-10-28T09:00:00' },
      ]),
    ).toBe(2);
  });

  it('matches string and number ids', () => {
    expect(resumeStepIndex([{ id: '10' }, { id: '11' }], [{ step_id: 11, visited_at: '2026-10-28T09:00:00Z' }])).toBe(1);
  });
});

describe('resumeLessonPath', () => {
  it('opens the lesson at the step', () => {
    expect(resumeLessonPath(1, { lesson_id: 66, lesson_title: 'Unit 0', step_id: 6618 })).toBe(
      '/course/1/lesson/66?stepId=6618',
    );
  });
});
