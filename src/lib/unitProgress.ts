import type { Lesson } from '../types';

// Shared by LessonPage's sidebar and CourseOverviewPage's lesson list: how far a
// student has gotten through a unit's steps, for the progress fill behind each row.

export interface UnitProgress {
  /** 0..1 share of required (non-optional) steps completed. */
  ratio: number;
  /** Human-readable summary for a `title` tooltip — the numbers behind `ratio`. */
  title: string;
}

export function unitStepProgress(lesson: Pick<Lesson, 'steps' | 'is_completed'>): UnitProgress {
  const steps = (lesson.steps || []).filter((s) => !s.is_optional);
  if (steps.length === 0) {
    return lesson.is_completed ? { ratio: 1, title: 'Completed' } : { ratio: 0, title: 'Not started' };
  }
  const completed = steps.filter((s) => s.is_completed).length;
  return { ratio: completed / steps.length, title: `${completed} of ${steps.length} steps done` };
}
