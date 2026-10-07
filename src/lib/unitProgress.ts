import type { Lesson } from '../types';
import { activeLocale, t, type Locale } from './i18n';
import '@/lib/i18n/catalogs/lessonPlayer';

// Shared by LessonPage's sidebar and CourseOverviewPage's lesson list: how far a
// student has gotten through a unit's steps, for the progress fill behind each row.

export interface UnitProgress {
  /** 0..1 share of required (non-optional) steps completed. */
  ratio: number;
  /** Human-readable summary for a `title` tooltip — the numbers behind `ratio`. */
  title: string;
  /**
   * Whether a progress fill should be painted for this unit at all. Only true
   * for partial progress (0 < ratio < 1) — a not-started unit has nothing to
   * show, and a finished one (per the authoritative `lesson.is_completed`
   * flag) is already signalled by its own completed treatment (green row /
   * check icon), so painting a fill on top would double up on that meaning.
   */
  showFill: boolean;
}

export function unitStepProgress(lesson: Pick<Lesson, 'steps' | 'is_completed'>, locale: Locale = activeLocale()): UnitProgress {
  if (lesson.is_completed) {
    return { ratio: 1, title: t('lessonPlayer.unitProgress.completed', undefined, locale), showFill: false };
  }
  const steps = (lesson.steps || []).filter((s) => !s.is_optional);
  if (steps.length === 0) {
    return { ratio: 0, title: t('lessonPlayer.unitProgress.notStarted', undefined, locale), showFill: false };
  }
  const completed = steps.filter((s) => s.is_completed).length;
  const ratio = completed / steps.length;
  return {
    ratio,
    title: t('lessonPlayer.unitProgress.stepsDone', { done: completed, count: steps.length }, locale),
    showFill: ratio > 0 && ratio < 1,
  };
}
