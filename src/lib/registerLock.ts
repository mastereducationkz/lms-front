import { parseAsUTC } from './datetime';
import { displaysAsAbsence } from './excusedAbsence';
import { activeLocale, t, type Locale, type MessageKey } from './i18n';
import { reasonComplete, type OverrideReason } from './meetRegister';
import type { MeetFlagCode, MeetLessonSummary, MeetReviewOptions } from '../services/api/meetAttendance';
import type { RegisterLock, StudentRegister } from '../services/api/meetRegister';
import '@/lib/i18n/catalogs/attendance';

/**
 * The register lock (owner, 2026-10-17): Meet takes the register, so a person changes a mark only where
 * Meet could not take it — or says why. The server decides (`register_lock` on every lesson payload);
 * this is what the screens do with that answer, kept apart from the components so it can be tested.
 * A server without the field means nothing is locked: the journal behaves as it always did.
 */

/** Rows Meet decided, or a person's answer to Meet: the cells the lock keeps. */
export const LOCKED_STATES = new Set<string>(['written', 'kept', 'override']);

/** Why Meet gave a student back (besides the `held` state itself): these cells stay open and ask for a hand. */
const HANDED_BACK = new Set(['held_back', 'lesson_not_proven', 'nobody_joined', 'partial']);

/** What one student's mark cell is: `pending` (Meet has not decided), `meet` (Meet decided), `open` (a person's). */
export type CellLock = 'open' | 'pending' | 'meet';

/** The three marks a person can pick: the journal and the lesson page both spell them this way. */
export type PickMark = 'attended' | 'late' | 'missed';

/** event id → the lesson's lock, from the list the journal already loads for Meet. */
export function lockIndex(items: Pick<MeetLessonSummary, 'event_id' | 'register_lock'>[]): Map<number, RegisterLock> {
  const index = new Map<number, RegisterLock>();
  for (const item of items) if (item.register_lock) index.set(item.event_id, item.register_lock);
  return index;
}

/**
 * The journal's locks: the weekly lessons carry one for every lesson of the week (also one later today, which
 * the Meet list does not have yet); the Meet list is read again after each save, so where it has the
 * lesson its answer is the newer one.
 */
export function mergeLocks(weekly: Map<number, RegisterLock>, meet: Map<number, RegisterLock>): Map<number, RegisterLock> {
  return new Map([...weekly, ...meet]);
}

/** event id → the lesson's scheduled length in whole minutes, for «52 из 60 мин». */
export function lengthIndex(items: Pick<MeetLessonSummary, 'event_id' | 'start' | 'end'>[]): Map<number, number> {
  const index = new Map<number, number>();
  for (const item of items) {
    const minutes = lessonMinutes(item.start, item.end);
    if (minutes != null) index.set(item.event_id, minutes);
  }
  return index;
}

export function lessonMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const span = parseAsUTC(end).getTime() - parseAsUTC(start).getTime();
  return Number.isFinite(span) && span > 0 ? Math.round(span / 60_000) : null;
}

/** The lock of a lesson page's register: in the register block, or beside it. */
export function lessonLock(view: { register?: { register_lock?: RegisterLock | null } | null; register_lock?: RegisterLock | null }): RegisterLock | null {
  return view.register?.register_lock ?? view.register_lock ?? null;
}

export function cellLock(lock: RegisterLock | null | undefined, reg: Pick<StudentRegister, 'state'> | null | undefined): CellLock {
  if (!lock) return 'open';
  if (lock.state === 'pending') return 'pending';
  return lock.state === 'decided' && reg && LOCKED_STATES.has(reg.state) ? 'meet' : 'open';
}

/**
 * Meet looked at this student and could not decide (an unconfirmed account in the room, a teacher not
 * proven in the call, nobody joined, a call Google has not handed over): the teacher's to mark, and the
 * cell says so. Not for students Meet leaves alone on purpose (excused, frozen, removed…).
 */
export function handedBack(lock: RegisterLock | null | undefined, reg: Pick<StudentRegister, 'state' | 'skip_reason'> | null | undefined): boolean {
  if (lock?.state !== 'decided' || !reg || cellLock(lock, reg) !== 'open') return false;
  return reg.state === 'held' || (reg.state === 'skipped' && HANDED_BACK.has(reg.skip_reason ?? ''));
}

/** Held back by an account nobody has named yet: «Кто это?» can settle it. */
export function heldBack(reg: Pick<StudentRegister, 'state' | 'skip_reason'> | null | undefined): boolean {
  return Boolean(reg) && (reg!.state === 'held' || (reg!.state === 'skipped' && reg!.skip_reason === 'held_back'));
}

/** Whether a cell may be touched by the click-to-cycle and «Отметить всех»: only the open ones. */
export function cellIsOpen(lock: RegisterLock | null | undefined, reg: Pick<StudentRegister, 'state'> | null | undefined): boolean {
  return cellLock(lock, reg) === 'open';
}

const MARK_LABEL: Record<PickMark, MessageKey> = {
  attended: 'attendance.status.present',
  late: 'attendance.status.late',
  missed: 'attendance.status.absent',
};

/** A stored/displayed status as one of the three picks (`registered` and `absent` read as «Не был»). */
export function pickMark(status: string): PickMark {
  if (status === 'attended' || status === 'late') return status;
  return displaysAsAbsence(status) ? 'missed' : 'attended';
}

export function markLabel(status: string, locale: Locale = activeLocale()): string {
  return t(MARK_LABEL[pickMark(status)], undefined, locale);
}

/** «в уроке 38 из 60 мин, нужно 45» (+ «, опоздание 7 мин»): the proof behind Meet's mark; null without minutes. */
export function evidenceLine(
  reg: Pick<StudentRegister, 'minutes' | 'required' | 'late_minutes' | 'verdict'> | null | undefined,
  total: number | null | undefined, locale: Locale = activeLocale(),
): string | null {
  if (!reg || reg.minutes == null) return null;
  const base = reg.required == null
    ? t('attendance.lock.evidenceMinutes', { minutes: reg.minutes }, locale)
    : total
      ? t('attendance.lock.evidence', { minutes: reg.minutes, total, required: reg.required }, locale)
      : t('attendance.lock.evidenceNoTotal', { minutes: reg.minutes, required: reg.required }, locale);
  const late = reg.verdict === 'late' && reg.late_minutes
    ? `, ${t('attendance.lock.lateBy', { minutes: reg.late_minutes }, locale)}` : '';
  return `${base}${late}`;
}

/** The hover of a locked cell: «Отметил Meet: Был · 52 из 60 мин — нажмите, чтобы исправить». */
export function lockedTitle(
  status: string, reg: StudentRegister | null | undefined, total: number | null | undefined,
  mayOverride: boolean, locale: Locale = activeLocale(),
): string {
  const mark = markLabel(status, locale);
  const minutes = reg?.minutes != null
    ? ` · ${total ? t('attendance.lock.minutesOf', { minutes: reg.minutes, total }, locale) : t('attendance.lock.minutesOnly', { minutes: reg.minutes }, locale)}`
    : '';
  const params = { mark, evidence: minutes };
  if (!mayOverride) return t('attendance.lock.meetMarkedLocked', params, locale);
  return t(reg?.state === 'override' ? 'attendance.lock.changedAfterMeet' : 'attendance.lock.meetMarked', params, locale);
}

/** The flag a change would raise against Meet's verdict: it picks which presets «Почему?» offers. */
export function reasonFlag(reg: Pick<StudentRegister, 'verdict' | 'status' | 'minutes'> | null | undefined, next: PickMark): MeetFlagCode {
  const meetSaid = reg?.verdict ?? reg?.status ?? null;
  const meetAttended = meetSaid === 'present' || meetSaid === 'late' || meetSaid === 'attended';
  const nextAttended = next !== 'missed';
  if (meetAttended && !nextAttended) return 'marked_absent_was_in_room';
  if (!meetAttended && nextAttended) return (reg?.minutes ?? 0) > 0 ? 'marked_present_too_short' : 'marked_present_not_joined';
  // Present ↔ late, or a reason for an absence: the timing presets («Предупредил заранее», «Уважительная причина»).
  return 'late';
}

export interface ReasonPreset { key: string; label: string }

/** The server's presets for this change, ending with «Другое» (which needs words). */
export function reasonPresets(
  options: MeetReviewOptions | null | undefined, reg: Parameters<typeof reasonFlag>[0], next: PickMark,
  locale: Locale = activeLocale(),
): ReasonPreset[] {
  const presets = options?.[reasonFlag(reg, next)]?.reasons ?? [];
  return presets.some((p) => p.key === 'other')
    ? presets : [...presets, { key: 'other', label: t('attendance.popover.other', undefined, locale) }];
}

/** A cell as the form needs it: the mark and whether it is an excused absence. */
export interface CellMark { status: string; excused: boolean }

export interface MarkChange {
  status: PickMark;
  excused: boolean;
  note: string | null;
  reason: OverrideReason;
}

export interface MarkDraft {
  status: PickMark;
  excused: boolean;
  note: string;
  reason: OverrideReason | undefined;
}

/** A change of a locked cell is ready to send: it differs from the cell, an excuse has its note, the reason is complete. */
export function changeReady(current: CellMark, draft: MarkDraft): boolean {
  const excused = draft.status === 'missed' && draft.excused;
  const differs = draft.status !== pickMark(current.status) || excused !== Boolean(current.excused && pickMark(current.status) === 'missed');
  if (!differs) return false;
  if (excused && !draft.note.trim()) return false;
  return reasonComplete(draft.reason);
}

/** The change a ready draft makes (an excuse only on an absence, its note trimmed). */
export function toChange(draft: MarkDraft): MarkChange {
  const excused = draft.status === 'missed' && draft.excused;
  return { status: draft.status, excused, note: excused ? draft.note.trim() : null, reason: draft.reason as OverrideReason };
}
