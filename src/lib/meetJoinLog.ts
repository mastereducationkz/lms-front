import { activeLocale, t, type Locale } from './i18n';
import { clock, markLabel } from './meetAttendance';
import { skipText } from './meetRegister';
import type { MeetLessonClock, MeetMark, MeetPerson, MeetRecord } from '../services/api/meetAttendance';
import type { StudentRegister } from '../services/api/meetRegister';
import '@/lib/i18n/catalogs/meetJoinLog';
import '@/lib/i18n/catalogs/meet';

/**
 * One student's time in the room as plain text, and one sentence on why the mark is what it is
 * (2026-11-05): «Joined 19:04, left 19:12, rejoined 19:15, left 19:52 — 41 of 45 min, needs 34.
 * The mark (Present) is Meet's, set from this record.» Times are Almaty. For staff who read the
 * lesson's record; the accountants' watch page gets no verdicts and never calls this.
 */

/** «Joined 19:04, left 19:12, rejoined 19:15» — the merged stretches in order. */
export function joinTimes(person: Pick<MeetPerson, 'sessions'>, held: boolean, locale: Locale): string {
  if (person.sessions.length === 0) return t(held ? 'meetJoinLog.noJoinHeld' : 'meetJoinLog.noJoin', undefined, locale);
  const parts: string[] = [];
  person.sessions.forEach((span, i) => {
    parts.push(t(i === 0 ? 'meetJoinLog.joined' : 'meetJoinLog.rejoined', { time: clock(span.joined_at) }, locale));
    parts.push(span.left_at ? t('meetJoinLog.left', { time: clock(span.left_at) }, locale) : t('meetJoinLog.stillIn', undefined, locale));
  });
  return parts.join(', ');
}

function minutesText(person: Pick<MeetPerson, 'minutes_in_lesson' | 'verdict'>, lesson: MeetLessonClock | undefined, locale: Locale): string | null {
  const verdict = person.verdict;
  if (!verdict) return null;
  const params = { minutes: verdict.minutes, held: lesson?.held_minutes ?? 0, required: verdict.required };
  return t(lesson ? 'meetJoinLog.minutes' : 'meetJoinLog.minutesOnly', params, locale);
}

const word = (status: string | null | undefined, locale: Locale): string =>
  status === 'present' || status === 'late' || status === 'absent' ? markLabel(status, locale) : status ?? '—';

/** Why the mark is what it is: Meet's, the teacher's, or held back for an unconfirmed guest. */
export function whyMark(
  person: Pick<MeetPerson, 'mark' | 'verdict' | 'register'>,
  unconfirmed: 'guest' | 'account' | null,
  locale: Locale,
): string {
  const reg: StudentRegister | null | undefined = person.register;
  if (person.verdict?.held_back || reg?.state === 'held') {
    return t(unconfirmed === 'account' ? 'meetJoinLog.why.heldAccount' : 'meetJoinLog.why.heldGuest', undefined, locale);
  }
  switch (reg?.state) {
    case 'written': return t('meetJoinLog.why.meetMark', { mark: word(reg.status, locale) }, locale);
    case 'kept': return t('meetJoinLog.why.agrees', undefined, locale);
    case 'override': {
      const o = reg.override;
      const why = (o?.reason_code === 'other' && o.text ? o.text : o?.reason_label ?? o?.text) || t('meetJoinLog.why.noReason', undefined, locale);
      const params = { mark: word(o?.status, locale), why };
      return o?.by ? t('meetJoinLog.why.changedBy', { ...params, who: o.by }, locale) : t('meetJoinLog.why.changed', params, locale);
    }
    case 'would_write': case 'would_keep': return t('meetJoinLog.why.shadow', undefined, locale);
    case 'skipped': {
      const reason = skipText(reg.skip_reason, locale);
      if (reason) return t('meetJoinLog.why.skipped', { reason }, locale);
      break;
    }
    case 'reverted': return t('meetJoinLog.why.reverted', undefined, locale);
    default: break;
  }
  const mark: MeetMark | undefined = person.mark;
  if (mark) return t('meetJoinLog.why.teacher', undefined, locale);
  const judged = person.verdict?.verdict ?? person.verdict?.provisional;
  return judged ? t('meetJoinLog.why.unmarked', { verdict: word(judged, locale) }, locale) : t('meetJoinLog.why.teacher', undefined, locale);
}

/** The whole log line for a student of this lesson's record. */
export function joinLogLine(student: MeetPerson, record: Pick<MeetRecord, 'clock' | 'unknown' | 'held_back'>, locale: Locale = activeLocale()): string {
  const held = Boolean(record.held_back);
  const unknown = record.unknown ?? [];
  const unconfirmed = unknown.length === 0 ? null : unknown.some((u) => u.kind !== 'signed_in') ? 'guest' : 'account';
  const times = joinTimes(student, held && student.sessions.length === 0, locale);
  const minutes = minutesText(student, record.clock, locale);
  const first = `${times}${minutes ? ` — ${minutes}` : ''}.`;
  return `${first} ${whyMark(student, unconfirmed, locale)}`;
}
