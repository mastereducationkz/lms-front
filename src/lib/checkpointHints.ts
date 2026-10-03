import type { StudentCheckpointItem } from '../services/api/checkpoints';

// Small pure helpers shared by LessonPage and CourseOverviewPage to render
// "this unit feeds Checkpoint N" cues from a /checkpoints/me response.
//
// Checkpoints are optional and never lock anything (owner decision 2026-10-03): an open
// checkpoint is something to invite the student to, never a reason a unit is closed.

export interface CheckpointHints {
  /** unit lesson_id -> the checkpoint it is required by */
  unitToCheckpoint: Map<number, StudentCheckpointItem>;
  /** checkpoint quiz lesson_id -> the checkpoint itself */
  byQuizLesson: Map<number, StudentCheckpointItem>;
  /** every item, in number order */
  items: StudentCheckpointItem[];
}

export function buildCheckpointHints(items: StudentCheckpointItem[] | undefined | null): CheckpointHints {
  const unitToCheckpoint = new Map<number, StudentCheckpointItem>();
  const byQuizLesson = new Map<number, StudentCheckpointItem>();

  for (const item of items || []) {
    for (const unit of item.covers || []) {
      unitToCheckpoint.set(unit.lesson_id, item);
    }
    if (item.quiz) {
      byQuizLesson.set(item.quiz.lesson_id, item);
    }
  }

  const sorted = [...(items || [])].sort((a, b) => a.number - b.number);
  return { unitToCheckpoint, byQuizLesson, items: sorted };
}

/** A checkpoint the student can take right now. The deadline is soft, so an overdue
 *  checkpoint is still answerable (the submission is marked late). */
export function isOpen(item: Pick<StudentCheckpointItem, 'status'>): boolean {
  return item.status === 'available' || item.status === 'reopened' || item.status === 'overdue';
}

/** The lowest-numbered open checkpoint, to invite the student to; null when none is open. */
export function firstOpenCheckpoint(items: StudentCheckpointItem[]): StudentCheckpointItem | null {
  return [...items].filter(isOpen).sort((a, b) => a.number - b.number)[0] ?? null;
}

/**
 * Why the server refused a lesson, as far as `/checkpoints/me` can explain it.
 *
 * `checkpoint-shut` — this lesson IS a checkpoint quiz that is not open for this student. That is
 * the only refusal checkpoints still cause; a course unit is never held back by one. `null` from
 * `lockKindFor` means the checkpoint data explains nothing about this refusal (a plain
 * sequential-access lock, a trial lock, or the `/checkpoints/me` request itself failed) — the
 * caller falls back to the server's own reason.
 */
export type CheckpointLock = { kind: 'checkpoint-shut'; item: StudentCheckpointItem };

/**
 * Explain a refusal the server already made. This never decides access — the server stays the
 * authority — it only picks the words. Returning `null` is normal and must be handled.
 */
export function lockKindFor(hints: CheckpointHints, lessonId: number): CheckpointLock | null {
  const quizItem = hints.byQuizLesson.get(lessonId);
  if (!quizItem) return null;
  // The quiz of a checkpoint the student may act on shouldn't have been refused; if it was,
  // checkpoint state doesn't explain it, so let the caller fall back to the server's reason.
  //
  // `checkpoint-shut` is DEFENSIVE and unreachable against the current server: the quiz gate
  // refuses exactly the rows that are not open (locked or skipped), and the serializer nulls
  // `quiz` for exactly those rows — so a refused quiz lesson is never in `byQuizLesson`. It is
  // kept because it costs a few lines and is the correct rendering should the server ever expose
  // the quiz link before a checkpoint opens.
  return isOpen(quizItem) ? null : { kind: 'checkpoint-shut', item: quizItem };
}
