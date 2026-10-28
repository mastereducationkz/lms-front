// Continue where you left off. Every step open stamps StepProgress.visited_at on the server
// (POST /progress/step/{id}/start); the latest one is the resume point — for a whole course via
// GET /progress/course/{id}/resume, for one lesson from its own steps progress.
// The mobile app has the same rules in lms/mobile utils/courseResume.ts.

export interface CourseResume {
  lesson_id: number;
  lesson_title: string;
  step_id: number;
  visited_at?: string | null;
}

interface StepLike {
  id: number | string;
}

interface StepProgressLike {
  step_id: number | string;
  visited_at?: string | null;
}

/**
 * Index of the step the student opened last in this lesson, or null when none was opened
 * (then the lesson starts at step 1). Most recent, not furthest: going back to re-read an
 * earlier step resumes there.
 */
export function resumeStepIndex(
  steps: StepLike[],
  progress: StepProgressLike[] | null | undefined,
): number | null {
  if (!progress?.length) return null;
  let best: { idx: number; at: number } | null = null;
  for (const p of progress) {
    const at = p.visited_at ? Date.parse(p.visited_at) : NaN;
    if (Number.isNaN(at)) continue;
    const idx = steps.findIndex((s) => Number(s.id) === Number(p.step_id));
    if (idx < 0) continue;
    if (!best || at > best.at) best = { idx, at };
  }
  return best ? best.idx : null;
}

/** The lesson page at the resume step. */
export function resumeLessonPath(courseId: string | number, resume: CourseResume): string {
  return `/course/${courseId}/lesson/${resume.lesson_id}?stepId=${resume.step_id}`;
}
