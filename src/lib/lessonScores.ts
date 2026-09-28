import { parseAsUTC } from './datetime';

/**
 * «Баллы за урок» (owner, 2026-09-28): scores for one lesson from its start, before Meet has marked
 * anyone — Meet writes the register 20–30 minutes after the end, and teachers score right at the end.
 * The rules the dialog needs, kept pure so they are tested.
 */

/** UI statuses (`/events/{id}/participants`) that can take a score: there, or not marked yet. An
 *  absence, an excused one or a cancelled lesson never has a score — the server refuses it too. */
export function canScore(uiStatus: string | null | undefined): boolean {
  return uiStatus === 'attended' || uiStatus === 'late' || uiStatus === 'registered' || !uiStatus;
}

/** Scores open when the lesson starts; lesson times are naive UTC. */
export function lessonStarted(start: string, now: Date = new Date()): boolean {
  return parseAsUTC(start).getTime() <= now.getTime();
}

export interface ScoreChange {
  student_id: number;
  activity_score: number;
}

/** What a save sends: the scores that differ from what was loaded. Clearing a score is not offered —
 *  a wrong score is corrected to the right one. */
export function changedScores(loaded: Map<number, number | null>, current: Map<number, number | null>): ScoreChange[] {
  const out: ScoreChange[] = [];
  current.forEach((score, studentId) => {
    if (score != null && score !== (loaded.get(studentId) ?? null)) out.push({ student_id: studentId, activity_score: score });
  });
  return out.sort((a, b) => a.student_id - b.student_id);
}

/** «Scored 5 of 8» — among the students who can take a score. */
export function scoredCount(students: { student_id: number; attendance_status: string }[], current: Map<number, number | null>): { scored: number; of: number } {
  const open = students.filter((s) => canScore(s.attendance_status));
  return { scored: open.filter((s) => current.get(s.student_id) != null).length, of: open.length };
}
