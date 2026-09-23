import type { MeetFlagCode, MeetLessonSummary } from '../services/api/meetAttendance';
import type { StudentRegister } from '../services/api/meetRegister';

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

/** A reason is complete with a preset — and words, for «Другое». */
export function reasonComplete(reason: OverrideReason | undefined): boolean {
  if (!reason?.code) return false;
  return reason.code !== 'other' || Boolean(reason.text?.trim());
}

/** A present student of a lesson Meet marked still owes a балл за активность. */
export function scoreDue(reg: StudentRegister | undefined, uiStatus: string, activityScore: number | null | undefined): boolean {
  if (!reg || reg.mode !== 'live' || !(MEET_DECIDED.has(reg.state) || reg.state === 'override')) return false;
  return ATTENDED_UI.has(uiStatus) && activityScore == null;
}

const SKIP: Record<'ru' | 'en', Record<string, string>> = {
  ru: {
    held_back: 'ждёт — в комнате был неподтверждённый аккаунт',
    lesson_not_proven: 'не отмечено — учителя не было в уроке',
    nobody_joined: 'не отмечено — никто из учеников не заходил',
    partial: 'не отмечено — Google передал не все звонки',
    excused: 'уважительный пропуск, не трогает',
    cancelled: 'урок отменён',
    removed: 'ученик снят с урока',
    frozen: 'заморозка',
    no_access: 'нет доступа',
    person_changed_it: 'отметку поставил человек',
    lesson_moved: 'урок перенесён после отметки',
  },
  en: {
    held_back: 'waiting — an unconfirmed account was in the room',
    lesson_not_proven: 'not marked — the teacher was not in the lesson',
    nobody_joined: 'not marked — no student joined',
    partial: 'not marked — Google has not handed over every call',
    excused: 'excused absence, left alone',
    cancelled: 'lesson cancelled',
    removed: 'student taken off the lesson',
    frozen: 'frozen',
    no_access: 'no access',
    person_changed_it: 'marked by a person',
    lesson_moved: 'lesson moved after it was marked',
  },
};
const MARK: Record<'ru' | 'en', Record<string, string>> = {
  ru: { present: 'был', late: 'опоздал', absent: 'не был' },
  en: { present: 'present', late: 'late', absent: 'absent' },
};

/** Hover lines: what Meet did with this student's mark, and a person's change after it. */
export function registerNote(reg: StudentRegister | undefined, locale: 'ru' | 'en'): string | null {
  if (!reg) return null;
  const ru = locale === 'ru';
  const word = (s: string | null) => (s ? MARK[locale][s] ?? s : '—');
  const minutes = reg.minutes != null && reg.required != null
    ? (ru ? ` · ${reg.minutes} из ${reg.required} мин` : ` · ${reg.minutes} of ${reg.required} min`) : '';
  const late = reg.verdict === 'late' && reg.late_minutes
    ? (ru ? ` · опоздание ${reg.late_minutes} мин` : ` · ${reg.late_minutes} min late`) : '';
  let line: string;
  switch (reg.state) {
    case 'written': line = `${ru ? 'Meet отметил' : 'Marked by Meet'}: ${word(reg.status)}${minutes}${late}`; break;
    case 'kept': line = `${ru ? 'Meet согласен с отметкой' : 'Meet agrees with this mark'}${minutes}`; break;
    case 'would_write': line = `${ru ? 'Meet отметил бы' : 'Meet would mark'}: ${word(reg.verdict)}${minutes}${late}`; break;
    case 'would_keep': line = `${ru ? 'Meet оставил бы отметку' : 'Meet would keep this mark'}${minutes}`; break;
    case 'override': line = `Meet: ${word(reg.verdict)}${minutes}${late}`; break;
    case 'held': case 'skipped': line = `Meet: ${SKIP[locale][reg.skip_reason ?? ''] ?? reg.skip_reason ?? ''}`; break;
    default: return null;
  }
  const o = reg.override;
  if (reg.state !== 'override' || !o) return line;
  const why = o.reason_code === 'other' && o.text ? o.text : o.reason_label ?? o.text ?? (ru ? 'без причины' : 'no reason given');
  const who = o.via === 'external' ? (ru ? 'вне LMS' : 'outside the LMS') : o.by;
  return `${line}\n${ru ? 'Изменено' : 'Changed'}: ${word(o.status)} — ${why}${who ? ` (${who})` : ''}`;
}
