import { parseAsUTC } from './datetime';
import { lessonPath } from './lessonLinks';
import type { SubstitutionLesson } from '../types';

/**
 * The Substitutions tab (owner, 2026-10-17): the list stays, its marking dialog is gone — a lesson the
 * teacher covers is dealt with on its own page, where `can_score` follows the lesson's actual teacher.
 * «Нужно отметить» holds only lessons that still owe something: a register Meet could not take, or scores.
 */

export interface SubstitutionSections {
  /** Lessons that owe a register or scores (oldest debt last — newest first, as the tab always listed them). */
  needsMarking: SubstitutionLesson[];
  /** Lessons on a later day, and lessons that ended but wait for Meet to decide (nothing to do yet). */
  upcoming: SubstitutionLesson[];
  /** Everything else: nothing owed. */
  marked: SubstitutionLesson[];
}

export type SubstitutionStatus = 'upcoming' | 'waiting' | 'owed' | 'marked';

/** What a lesson still owes; an older server sends no `owed`, so it falls back to «attendance not recorded». */
export function substitutionStatus(lesson: SubstitutionLesson, isLater: (start: string) => boolean): SubstitutionStatus {
  if (isLater(lesson.start_datetime)) return 'upcoming';
  if (!lesson.owed) return lesson.marked ? 'marked' : 'owed';
  if (lesson.owed.register > 0 || lesson.owed.scores > 0) return 'owed';
  return lesson.marked === false ? 'waiting' : 'marked';
}

export function splitSubstitutions(lessons: SubstitutionLesson[], isLater: (start: string) => boolean): SubstitutionSections {
  const time = (l: SubstitutionLesson) => parseAsUTC(l.start_datetime).getTime();
  const out: SubstitutionSections = { needsMarking: [], upcoming: [], marked: [] };
  for (const lesson of lessons) {
    const status = substitutionStatus(lesson, isLater);
    if (status === 'owed') out.needsMarking.push(lesson);
    else if (status === 'marked') out.marked.push(lesson);
    else out.upcoming.push(lesson);
  }
  out.needsMarking.sort((a, b) => time(b) - time(a));
  out.upcoming.sort((a, b) => time(a) - time(b)); // soonest first
  out.marked.sort((a, b) => time(b) - time(a));
  return out;
}

/** The lesson's page: at its register once it has started, plain before. */
export function substitutionLink(lesson: SubstitutionLesson, status: SubstitutionStatus): string {
  return status === 'upcoming' ? lessonPath(lesson.event_id) : lessonPath(lesson.event_id, 'register');
}
