import { activeLocale, t, type Locale, type MessageKey } from './i18n';
import type { MeetFlagCode, MeetLessonSummary } from '../services/api/meetAttendance';
import type { RegisterCounts, StudentRegister } from '../services/api/meetRegister';
import '@/lib/i18n/catalogs/meet';

/**
 * Meet takes the register (owner, 2026-09-23) — what the journal and the Meet page need to know about
 * it, kept apart from the components so it can be tested.
 */

/** Rows Meet decided while live: its own mark, or a teacher's it agreed with. */
export const MEET_DECIDED = new Set(['written', 'kept']);
const ATTENDED = new Set(['present', 'late']);
const ATTENDED_UI = new Set(['attended', 'late', 'present']);

/** "eventId:studentId" → what the register says, from the list the journal already loads. */
export function registerIndex(items: Pick<MeetLessonSummary, 'event_id' | 'verdicts'>[]): Map<string, StudentRegister> {
  const index = new Map<string, StudentRegister>();
  for (const item of items) {
    for (const v of item.verdicts ?? []) if (v.register) index.set(`${item.event_id}:${v.user_id}`, v.register);
  }
  return index;
}

/** event id → the lesson's Meet state (waiting, ready, …). */
export function lessonStateIndex(items: Pick<MeetLessonSummary, 'event_id' | 'state'>[]): Map<number, string> {
  return new Map(items.map((item) => [item.event_id, item.state]));
}

/** The flag a teacher's mark raises against a mark Meet decided — null when they agree about attending. */
export function overrideFlag(reg: StudentRegister | undefined, uiStatus: string): MeetFlagCode | null {
  if (!reg || reg.mode !== 'live' || !MEET_DECIDED.has(reg.state) || !reg.verdict) return null;
  const meetAttended = ATTENDED.has(reg.verdict);
  if (meetAttended === ATTENDED_UI.has(uiStatus)) return null;
  if (meetAttended) return 'marked_absent_was_in_room';
  return (reg.minutes ?? 0) > 0 ? 'marked_present_too_short' : 'marked_present_not_joined';
}

export interface OverrideReason { code: string; text: string | null }
export interface OverrideAsk { key: string; studentName: string; lessonLabel: string; flag: MeetFlagCode }

interface JournalLesson { attendance_status: string; event_id?: number | null }
interface JournalStudent { student_id: number; student_name: string; lessons: Record<string, JournalLesson> }

/** The marks this save contradicts Meet on and has no reason for yet — what the dialog asks. */
export function overridesToAsk(
  students: JournalStudent[], changed: Set<number>, register: Map<string, StudentRegister>,
  reasons: Map<string, OverrideReason>, lessonLabel: (lessonKey: string) => string,
): OverrideAsk[] {
  const ask: OverrideAsk[] = [];
  for (const s of students) {
    if (!changed.has(s.student_id)) continue;
    for (const [lessonKey, lesson] of Object.entries(s.lessons)) {
      if (lesson.event_id == null) continue;
      const flag = overrideFlag(register.get(`${lesson.event_id}:${s.student_id}`), lesson.attendance_status);
      const key = `${s.student_id}:${lessonKey}`;
      if (flag && !reasons.has(key)) ask.push({ key, studentName: s.student_name, lessonLabel: lessonLabel(lessonKey), flag });
    }
  }
  return ask;
}

/** What a save sends beside a cell: the reason given for it, if any. */
export function reasonPayload(reason: OverrideReason | undefined): { override_reason_code?: string; override_reason_text?: string | null } {
  return reason ? { override_reason_code: reason.code, override_reason_text: reason.text } : {};
}

/** A reason is complete with a preset — and words, for «Other». */
export function reasonComplete(reason: OverrideReason | undefined): boolean {
  if (!reason?.code) return false;
  return reason.code !== 'other' || Boolean(reason.text?.trim());
}

/** Lessons where Meet decided the register (any live row written, kept or overridden) — the badge's rule. */
export function decidedLessons(index: Map<string, StudentRegister>): Set<number> {
  const out = new Set<number>();
  for (const [key, reg] of index) {
    if (reg.mode === 'live' && (MEET_DECIDED.has(reg.state) || reg.state === 'override')) out.add(Number(key.split(':')[0]));
  }
  return out;
}

/** A present student of a lesson Meet decided still owes a балл за активность — whoever marked them. */
export function scoreDue(lessonDecided: boolean, uiStatus: string, activityScore: number | null | undefined): boolean {
  return lessonDecided && ATTENDED_UI.has(uiStatus) && activityScore == null;
}

const SKIP: Record<string, MessageKey> = {
  held_back: 'meet.register.skipHeldBack',
  lesson_not_proven: 'meet.register.skipLessonNotProven',
  nobody_joined: 'meet.register.skipNobodyJoined',
  partial: 'meet.register.skipPartial',
  excused: 'meet.register.skipExcused',
  cancelled: 'meet.register.skipCancelled',
  removed: 'meet.register.skipRemoved',
  frozen: 'meet.register.skipFrozen',
  no_access: 'meet.register.skipNoAccess',
  person_changed_it: 'meet.register.skipPersonChangedIt',
  lesson_moved: 'meet.register.skipLessonMoved',
};
const MARK: Record<string, MessageKey> = {
  present: 'meet.register.markPresent',
  late: 'meet.register.markLate',
  absent: 'meet.register.markAbsent',
};

/** Hover lines: what Meet did with this student's mark, and a person's change after it. */
export function registerNote(reg: StudentRegister | undefined, locale: Locale = activeLocale()): string | null {
  if (!reg) return null;
  const word = (s: string | null) => (s ? (MARK[s] ? t(MARK[s], undefined, locale) : s) : '—');
  const minutes = reg.minutes != null && reg.required != null
    ? ` · ${t('meet.register.minutes', { minutes: reg.minutes, required: reg.required }, locale)}` : '';
  const late = reg.verdict === 'late' && reg.late_minutes
    ? ` · ${t('meet.register.lateBy', { minutes: reg.late_minutes }, locale)}` : '';
  let line: string;
  switch (reg.state) {
    case 'written': line = `${t('meet.register.written', { mark: word(reg.status) }, locale)}${minutes}${late}`; break;
    case 'kept': line = `${t('meet.register.kept', undefined, locale)}${minutes}`; break;
    case 'would_write': line = `${t('meet.register.wouldWrite', { mark: word(reg.verdict) }, locale)}${minutes}${late}`; break;
    case 'would_keep': line = `${t('meet.register.wouldKeep', undefined, locale)}${minutes}`; break;
    case 'override': line = `Meet: ${word(reg.verdict)}${minutes}${late}`; break;
    case 'held': case 'skipped': {
      const skip = SKIP[reg.skip_reason ?? ''];
      line = `Meet: ${skip ? t(skip, undefined, locale) : reg.skip_reason ?? ''}`;
      break;
    }
    case 'reverted': line = `Meet: ${t('meet.register.reverted', undefined, locale)}`; break;
    default: return null;
  }
  const o = reg.override;
  if (reg.state !== 'override' || !o) return line;
  const why = o.reason_code === 'other' && o.text ? o.text : o.reason_label ?? o.text ?? t('meet.register.noReason', undefined, locale);
  const who = o.via === 'external' ? t('meet.register.outsideLms', undefined, locale) : o.by;
  // Meet's verdict is already the line above this one (the verdict chip's own note), so only the change.
  return who
    ? t('meet.register.changedBy', { mark: word(o.status), why, who }, locale)
    : t('meet.register.changed', { mark: word(o.status), why }, locale);
}

/** The register report's one-line total (the Meet page's panel header). */
export function registerSummary(total: RegisterCounts, live: boolean, locale: Locale = activeLocale()): string {
  const say = (key: MessageKey, count: number) => t(key, { count }, locale);
  const missed = total.scores_missed ?? 0;
  const parts = live
    ? [say('common.lessons', total.lessons), say('meet.registerSummary.wrote', total.writes),
      say('meet.registerSummary.waited', total.held), say('meet.registerSummary.changed', total.overrides),
      missed ? say('meet.registerSummary.noScores', missed) : null]
    : [say('common.lessons', total.lessons), say('meet.registerSummary.wouldWrite', total.writes),
      say('meet.registerSummary.wouldContradict', total.changes), say('meet.registerSummary.wouldWait', total.held)];
  return parts.filter(Boolean).join(' · ');
}
