import { APP_TIMEZONE } from './datetime';
import { formatDurationWords } from './recordings';
import type { LessonRecordingStatus } from '../services/api/recordings';
import type {
  MeetFlag,
  MeetFlagCode,
  MeetFlagReview,
  MeetLessonFlag,
  MeetLessonSummary,
  MeetMark,
  MeetPerson,
  MeetPresence,
  MeetRecord,
  MeetSpan,
  MeetStudentVerdict,
  MeetVerdict,
  MeetVerdictRules,
  MeetVerdictSummary,
} from '../services/api/meetAttendance';

const MINUTE = 60_000;
const MIN_BAR = 0.6; // percent

/** "18:54" on the Almaty clock, whatever the viewer's own time zone. */
export function clock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: APP_TIMEZONE });
}

export interface Axis {
  from: number;
  to: number;
  lessonStart: number;
  lessonEnd: number;
  ticks: { at: number; label: string }[];
}

/**
 * The timeline's time range: the lesson with a little air either side, stretched to whoever
 * came early or stayed late — but never further than the 30 minutes the record itself counts.
 */
export function buildAxis(record: Pick<MeetRecord, 'start' | 'end'>, rows: MeetPresence[]): Axis {
  const lessonStart = new Date(record.start).getTime();
  const lessonEnd = new Date(record.end).getTime();
  let from = lessonStart - 10 * MINUTE;
  let to = lessonEnd + 10 * MINUTE;
  for (const row of rows) {
    for (const span of row.sessions) {
      from = Math.min(from, new Date(span.joined_at).getTime());
      if (span.left_at) to = Math.max(to, new Date(span.left_at).getTime());
    }
  }
  from = Math.max(from, lessonStart - 30 * MINUTE);
  to = Math.min(to, lessonEnd + 30 * MINUTE);
  from = Math.floor(from / (5 * MINUTE)) * 5 * MINUTE;
  to = Math.ceil(to / (5 * MINUTE)) * 5 * MINUTE;

  // Almaty is a whole number of hours from UTC, so quarter hours line up in both.
  const step = (to - from) > 150 * MINUTE ? 30 * MINUTE : 15 * MINUTE;
  const ticks = [];
  for (let at = Math.ceil(from / step) * step; at <= to; at += step) {
    ticks.push({ at, label: clock(new Date(at).toISOString()) });
  }
  return { from, to, lessonStart, lessonEnd, ticks };
}

/** Where a moment sits on the axis, 0–100, clamped. */
export function position(axis: Axis, at: number): number {
  const span = axis.to - axis.from;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((at - axis.from) / span) * 100));
}

/** A session as a bar: left and width in percent. An open session runs to `now` (or the axis end). */
export function barFor(axis: Axis, span: MeetSpan, now: number = Date.now()): { left: number; width: number } | null {
  const a = new Date(span.joined_at).getTime();
  const b = span.left_at ? new Date(span.left_at).getTime() : Math.min(now, axis.to);
  if (!(b > a)) return null;
  // A few seconds in the room still shows as a sliver rather than vanishing.
  const width = Math.max(MIN_BAR, position(axis, b) - position(axis, a));
  return { left: Math.min(position(axis, a), 100 - MIN_BAR), width };
}

const MISMATCH: ReadonlySet<MeetFlagCode> = new Set([
  'marked_present_not_joined',
  'marked_present_too_short',
  'marked_absent_was_in_room',
  'teacher_not_joined',
]);

export function isMismatch(code: MeetFlagCode): boolean {
  return MISMATCH.has(code);
}

export type FlagTone = 'mismatch' | 'timing';

export function flagTone(code: MeetFlagCode): FlagTone {
  return isMismatch(code) ? 'mismatch' : 'timing';
}

/** A flag in words, the way the lesson card and the review list both say it. */
export function flagText(flag: MeetFlag): string {
  const m = flag.minutes ?? 0;
  switch (flag.code) {
    case 'late': return `Late ${m} min`;
    case 'left_early': return `Left ${m} min early`;
    case 'marked_present_not_joined': return 'Marked present, never joined';
    case 'marked_present_too_short': return `Marked present, in the lesson ${m} of ${flag.required ?? '?'} min`;
    case 'marked_absent_was_in_room': return `Marked absent, in the lesson ${m} min`;
    case 'teacher_late': return `Started ${m} min late`;
    case 'ended_early': return `Ended ${m} min early`;
    case 'teacher_not_joined': return 'Teacher never joined';
    default: return flag.code;
  }
}

// ── reviewing a flag (owner, 2026-09-11) ─────────────────────────────────────────────────

const TEACHER_FLAGS: ReadonlySet<MeetFlagCode> = new Set(['teacher_late', 'ended_early', 'teacher_not_joined']);
const RECORD_READERS = new Set(['admin', 'head_curator', 'head_teacher', 'teacher', 'curator']);
const TEACHER_FLAG_REVIEWERS = new Set(['admin', 'head_curator', 'head_teacher']);
// The journal's own rule: curators read marks but never write them.
const MARKERS = new Set(['admin', 'head_curator', 'head_teacher', 'teacher']);
const OTHER_LABEL = 'Другое';

export const isTeacherFlag = (code: MeetFlagCode) => TEACHER_FLAGS.has(code);

/** Teachers and curators answer their students' flags; a teacher's own are for admins and heads. */
export function canReviewFlag(role: string | undefined, code: MeetFlagCode): boolean {
  return (isTeacherFlag(code) ? TEACHER_FLAG_REVIEWERS : RECORD_READERS).has(role ?? '');
}

/** Who writes marks: the journal's rule (curators read them only). */
export function canMark(role: string | undefined): boolean {
  return MARKERS.has(role ?? '');
}

/** Only a mark that contradicts the room can be corrected, and only by someone who marks. */
export function canFixMark(role: string | undefined, code: MeetFlagCode): boolean {
  return (code === 'marked_present_not_joined' || code === 'marked_present_too_short' || code === 'marked_absent_was_in_room')
    && canMark(role);
}

// ── Meet's verdict (owner, 2026-09-16) ───────────────────────────────────────────────────

type VerdictLocale = 'en' | 'ru';

const VERDICT_WORD: Record<VerdictLocale, Record<NonNullable<MeetVerdict['verdict']>, string>> = {
  en: { present: 'Present', late: 'Late', absent: 'Absent' },
  ru: { present: 'Был', late: 'Опоздал', absent: 'Не был' },
};

type VerdictFields = Pick<MeetVerdict, 'verdict' | 'minutes' | 'required' | 'late_minutes'> & Partial<Pick<MeetVerdict, 'provisional'>>;

function verdictWords(value: NonNullable<MeetVerdict['verdict']>, v: VerdictFields, locale: VerdictLocale): string {
  const ru = locale === 'ru';
  const word = VERDICT_WORD[locale][value];
  if (value === 'late') return ru ? `${word} на ${v.late_minutes} мин` : `${word} ${v.late_minutes} min`;
  if (value === 'absent') {
    if (v.minutes <= 0) return ru ? `${word} на уроке` : `${word} · not in the lesson`;
    return ru ? `${word}: ${v.minutes} из ${v.required} мин` : `${word} · ${v.minutes} of ${v.required} min`;
  }
  return word;
}

/**
 * "Present", "Late 12 min", "Absent · 30 of 45 min" — the verdict with its reason. Held back, it is the
 * verdict on the confirmed accounts with a «?» ("Late 9 min?"): a bare «not known yet» beside the
 * student's own confirmed account read as if that account were the unconfirmed one (2026-09-17).
 */
export function verdictText(v: VerdictFields, locale: VerdictLocale = 'en'): string {
  if (v.verdict) return verdictWords(v.verdict, v, locale);
  if (v.provisional) return `${verdictWords(v.provisional, v, locale)}?`;
  return locale === 'ru' ? 'Пока неизвестно' : 'Not known yet';
}

/** Why a held-back verdict may still change — for the hover; null when it is final. */
export function verdictHint(v: Pick<MeetVerdict, 'held_back'>, locale: VerdictLocale = 'en'): string | null {
  if (!v.held_back) return null;
  return locale === 'ru'
    ? 'В комнате был ещё один неподтверждённый аккаунт. Если это тот же ученик с другого устройства (или преподаватель), вердикт может измениться — подтвердите аккаунт в «Who is this?».'
    : 'Someone else in the room isn’t confirmed yet. If it’s this student on another device (or the teacher), this can change — name them under «Who is this?».';
}

/** The mark and the verdict say different things — about attending, or only present versus late. */
export function verdictDiffers(mark: MeetMark | undefined, v: Pick<MeetVerdict, 'verdict'> | null | undefined): boolean {
  if (!v?.verdict || !mark || mark === 'removed') return false;
  return mark !== v.verdict;
}

/** The rules in one line, for the pages' legends; null from a server without verdicts. */
export function rulesText(rules: MeetVerdictRules | undefined, locale: VerdictLocale = 'en'): string | null {
  if (!rules) return null;
  const share = Math.round(rules.present_share * 100);
  const hour = Math.floor(60 * rules.present_share);
  return locale === 'ru'
    ? `Вердикт Meet: опоздание — позже ${rules.late_after_minutes} мин, «не был» — меньше ${share}% урока (${hour} из 60 мин); время — от прихода до ухода преподавателя.`
    : `Meet’s verdict: late after ${rules.late_after_minutes} min, absent under ${share}% of the lesson (${hour} of 60 min), timed from when the teacher came to when the teacher left.`;
}

/** "Meet: 12 present · 2 late · 1 absent · 3 not marked" for a list row; null without verdicts. */
export function verdictLine(summary: MeetVerdictSummary | null | undefined): string | null {
  if (!summary) return null;
  const parts = [
    summary.present && `${summary.present} present`,
    summary.late && `${summary.late} late`,
    summary.absent && `${summary.absent} absent`,
    summary.held_back && `${summary.held_back} not known yet`,
  ].filter(Boolean);
  if (!parts.length) return null;
  const unmarked = summary.unmarked ? ` · ${summary.unmarked} not marked` : '';
  return `Meet: ${parts.join(' · ')}${unmarked}`;
}

/** "eventId:userId" → the student's verdict, for the attendance journal. */
export function verdictIndex(items: Pick<MeetLessonSummary, 'event_id' | 'verdicts'>[]): Map<string, MeetStudentVerdict> {
  const index = new Map<string, MeetStudentVerdict>();
  for (const item of items) for (const v of item.verdicts ?? []) index.set(`${item.event_id}:${v.user_id}`, v);
  return index;
}

/** The reason in words: the preset, the comment, or — for «Другое» — just what was written. */
export function reasonText(review: MeetFlagReview | null | undefined): string | null {
  if (!review) return null;
  const label = review.reason_code === 'other' || review.reason_label === OTHER_LABEL ? null : review.reason_label;
  return [label, review.text?.trim()].filter(Boolean).join(' — ') || null;
}

export const MARK_LABEL: Record<Exclude<MeetMark, null>, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  removed: 'Removed',
};

/** The review list's one-line reading of a lesson, most serious first; answered flags last. */
export function lessonHeadline(item: Pick<MeetLessonSummary, 'mismatches' | 'unknown' | 'flags'>): string {
  const open = item.flags.filter((f) => !f.review);
  const parts: string[] = [];
  const disagree = open.filter((f) => isMismatch(f.code) && !isTeacherFlag(f.code)).length;
  if (disagree) parts.push(`${disagree} mark${disagree === 1 ? '' : 's'} disagree`);
  open.filter((f) => isTeacherFlag(f.code)).forEach((f) => parts.push(flagText(f)));
  const late = open.filter((f) => f.code === 'late').length;
  if (late) parts.push(`${late} late`);
  if (item.unknown) parts.push(`${item.unknown} to confirm`);
  const reviewed = item.flags.length - open.length;
  if (reviewed) parts.push(`${reviewed} reviewed`);
  return parts.length ? parts.join(' · ') : 'All clear';
}

/**
 * "eventId:userId" → the disagreeing flags, for the attendance journal's warning dots. Reviewed
 * ones stay in, carrying their reason: the journal shows them answered rather than hiding them.
 */
export function mismatchIndex(items: Pick<MeetLessonSummary, 'event_id' | 'flags'>[]): Map<string, MeetLessonFlag[]> {
  const index = new Map<string, MeetLessonFlag[]>();
  for (const item of items) {
    for (const flag of item.flags) {
      if (!isMismatch(flag.code) || flag.role === 'teacher') continue;
      const key = `${item.event_id}:${flag.user_id}`;
      index.set(key, [...(index.get(key) ?? []), flag]);
    }
  }
  return index;
}

// ── reporting: filters by issue, tallies by teacher, CSV ─────────────────────────────────

export type IssueKey =
  | 'teacher_late'
  | 'ended_early'
  | 'teacher_not_joined'
  | 'marks_disagree'
  | 'students_late'
  | 'left_early'
  | 'not_marked'
  | 'to_confirm'
  | 'silent_students'
  | 'overrides';

/** The issues a head can filter by, in the order they matter for a report. */
export const ISSUES: { key: IssueKey; label: string; hint: string }[] = [
  { key: 'teacher_late', label: 'Teacher late', hint: 'The teacher joined more than 2 min after the start' },
  { key: 'ended_early', label: 'Ended early', hint: 'The teacher left more than 5 min before the end' },
  { key: 'teacher_not_joined', label: 'Teacher never joined', hint: 'No confirmed account of the teacher was in the room' },
  { key: 'marks_disagree', label: 'Marks disagree', hint: 'Marked present but in under 75% of the lesson (or never joined), or marked absent but in for 75% or more' },
  { key: 'students_late', label: 'Students late', hint: 'A student joined more than 5 min after the lesson began (the teacher’s start, when later)' },
  { key: 'left_early', label: 'Students left early', hint: 'A student left more than 10 min before the lesson ended (the teacher’s end, when earlier)' },
  { key: 'not_marked', label: 'Not marked', hint: 'Students the teacher hasn’t marked yet; Meet’s verdict can be applied in the lesson' },
  { key: 'overrides', label: 'Changed after Meet', hint: 'A person changed a mark Meet had decided (with or without a reason)' },
  { key: 'to_confirm', label: 'To confirm', hint: 'Google accounts nobody has named yet' },
  // A filter for reports only: a quiet test lesson is normal, so it never asks for attention.
  { key: 'silent_students', label: 'Silent students', hint: 'A student was in the room and never spoke (talk time)' },
];

type Reportable = Pick<MeetLessonSummary, 'flags' | 'unknown' | 'mismatches'> & Partial<Pick<MeetLessonSummary, 'talk' | 'verdict_summary' | 'verdicts'>>;

const hasCode = (item: Reportable, ...codes: MeetFlagCode[]) => item.flags.some((f) => codes.includes(f.code));

export function hasIssue(item: Reportable, key: IssueKey): boolean {
  switch (key) {
    case 'teacher_late': return hasCode(item, 'teacher_late');
    case 'ended_early': return hasCode(item, 'ended_early');
    case 'teacher_not_joined': return hasCode(item, 'teacher_not_joined');
    case 'marks_disagree': return hasCode(item, 'marked_present_not_joined', 'marked_present_too_short', 'marked_absent_was_in_room');
    case 'not_marked': return (item.verdict_summary?.unmarked ?? 0) > 0;
    case 'students_late': return hasCode(item, 'late');
    case 'left_early': return hasCode(item, 'left_early');
    case 'to_confirm': return item.unknown > 0;
    case 'silent_students': return (item.talk?.silent.length ?? 0) > 0;
    case 'overrides': return (item.verdicts ?? []).some((v) => v.register?.state === 'override');
    default: return false;
  }
}

/**
 * Google hasn't handed over the lesson's own call yet, so nothing about the room can be read:
 * the lesson is loading, not empty. How long that takes varies, so no time is promised.
 */
export function stillLoading(item: Pick<MeetLessonSummary, 'state'>): boolean {
  return item.state === 'waiting' || item.state === 'not_started';
}

/** "Needs attention": something a person has to act on — not every late student, nothing reviewed. */
export function needsAttention(item: Reportable): boolean {
  return item.unknown > 0 || item.flags.some((f) => !f.review && (isMismatch(f.code) || f.role === 'teacher'));
}

/** Out of «Needs attention» only because someone answered what put it there: what «Show reviewed» brings back. */
export function clearedByReview(item: Reportable): boolean {
  return !needsAttention(item) && item.flags.some((f) => f.review && (isMismatch(f.code) || f.role === 'teacher'));
}

/** The lesson without its reviewed flags — how the list reads until «Show reviewed» is on. */
export function withoutReviewed<T extends Reportable>(item: T): T {
  return item.flags.some((f) => f.review) ? { ...item, flags: item.flags.filter((f) => !f.review) } : item;
}

export function reviewedCount(items: Reportable[]): number {
  return items.reduce((n, item) => n + item.flags.filter((f) => f.review).length, 0);
}

export function issueCounts(items: Reportable[]): Record<IssueKey, number> {
  const counts = Object.fromEntries(ISSUES.map((i) => [i.key, 0])) as Record<IssueKey, number>;
  for (const item of items) for (const { key } of ISSUES) if (hasIssue(item, key)) counts[key] += 1;
  return counts;
}

export interface TeacherTally {
  teacherId: number;
  name: string;
  lessons: number;
  teacher_late: number;
  /** Minutes late summed over the late starts — "late 4 times" reads differently at 3 vs 40. */
  late_minutes: number;
  ended_early: number;
  teacher_not_joined: number;
  marks_disagree: number;
  to_confirm: number;
  /** Lessons with talk time, and the teacher's average share of the speech in them. */
  talk_lessons: number;
  avg_teacher_share: number | null;
  /** Marked students Meet could judge, and how many of those marks agree with it about attending. */
  verdict_compared: number;
  verdict_agree: number;
}

/** One row per teacher, the ones with most to talk about first. */
export function tallyByTeacher(items: MeetLessonSummary[]): TeacherTally[] {
  const rows = new Map<number, TeacherTally>();
  for (const item of items) {
    if (!item.teacher) continue;
    const row = rows.get(item.teacher.id) ?? {
      teacherId: item.teacher.id, name: item.teacher.name, lessons: 0, teacher_late: 0, late_minutes: 0,
      ended_early: 0, teacher_not_joined: 0, marks_disagree: 0, to_confirm: 0, talk_lessons: 0, avg_teacher_share: null,
      verdict_compared: 0, verdict_agree: 0,
    };
    row.lessons += 1;
    const late = item.flags.find((f) => f.code === 'teacher_late');
    if (late) { row.teacher_late += 1; row.late_minutes += late.minutes ?? 0; }
    if (hasIssue(item, 'ended_early')) row.ended_early += 1;
    if (hasIssue(item, 'teacher_not_joined')) row.teacher_not_joined += 1;
    if (hasIssue(item, 'marks_disagree')) row.marks_disagree += 1;
    if (hasIssue(item, 'to_confirm')) row.to_confirm += 1;
    row.verdict_compared += item.verdict_summary?.compared ?? 0;
    row.verdict_agree += item.verdict_summary?.agree ?? 0;
    const share = item.talk?.teacher_share;
    if (share != null) {
      // A running average, so the row never has to carry a separate sum.
      row.avg_teacher_share = ((row.avg_teacher_share ?? 0) * row.talk_lessons + share) / (row.talk_lessons + 1);
      row.talk_lessons += 1;
    }
    rows.set(item.teacher.id, row);
  }
  const weight = (r: TeacherTally) => r.teacher_late + r.ended_early + r.teacher_not_joined + r.marks_disagree;
  return [...rows.values()].sort((a, b) => weight(b) - weight(a) || a.name.localeCompare(b.name));
}

function almatyDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: APP_TIMEZONE });
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

/** A flag for the spreadsheet: what happened and, once reviewed, the answer. */
function flagCell(flag: MeetFlag): string {
  if (!flag.review) return flagText(flag);
  return `${flagText(flag)}; reviewed: ${reasonText(flag.review) ?? 'no reason given'}`;
}

const who = (item: MeetLessonSummary, ...codes: MeetFlagCode[]) =>
  item.flags.filter((f) => codes.includes(f.code)).map((f) => `${f.name} (${flagCell(f)})`).join('; ');

const RECORDING_CSV: Record<LessonRecordingStatus, string> = {
  ready: 'Ready', pending: 'Processing', waiting: 'Waiting for Google Meet', failed: 'Failed', removed: 'Removed', missing: 'None',
};

/** "Ready · 58 min", "Processing", "None" — empty when the server said nothing about it. */
function recordingCell(item: MeetLessonSummary): string {
  const recording = item.recording;
  if (!recording) return '';
  const length = recording.status === 'ready' ? formatDurationWords(recording.duration_seconds) : null;
  return length ? `${RECORDING_CSV.ready} · ${length}` : RECORDING_CSV[recording.status] ?? recording.status;
}

/** Counts by verdict, not marked, and "agree of compared" — blank for a lesson without verdicts. */
function verdictCells(summary: MeetVerdictSummary | null | undefined): (string | number)[] {
  if (!summary) return ['', '', '', '', '', ''];
  return [summary.present, summary.late, summary.absent, summary.held_back, summary.unmarked,
    summary.compared ? `${summary.agree} of ${summary.compared}` : ''];
}

/**
 * The review list as a spreadsheet, for reporting. Opens correctly in Excel (UTF-8 with BOM, so
 * Cyrillic names survive); dates and times are Almaty.
 */
export function reportCsv(items: MeetLessonSummary[]): string {
  const header = ['Date', 'Start', 'End', 'Lesson', 'Groups', 'Teacher', 'Teacher joined', 'Teacher left',
    'Teacher issues', 'Students joined', 'Students', 'Marks disagree', 'Students late', 'Students left early',
    'Accounts to confirm', 'Meet: present', 'Meet: late', 'Meet: absent', 'Meet: not known yet', 'Not marked',
    'Marks agree with Meet', 'Teacher talk share', 'Students who didn’t speak', 'Meet wrote', 'Changed after Meet', 'Recording'];
  const rows = items.map((item) => {
    const lesson = [almatyDate(item.start), clock(item.start), clock(item.end), item.title,
      item.groups.map((g) => g.name).join(', '), item.teacher?.name ?? ''];
    // Zeros here would read as "nobody came"; the lesson's call simply hasn't come through yet.
    // The recording is its own news and is known either way.
    if (stillLoading(item)) return [...lesson, 'Loading', ...Array(header.length - lesson.length - 2).fill(''), recordingCell(item)];
    return [...lesson,
      item.teacher?.first_join ? clock(item.teacher.first_join) : '', item.teacher?.last_leave ? clock(item.teacher.last_leave) : '',
      item.flags.filter((f) => f.role === 'teacher').map(flagCell).join('; '),
      item.joined, item.students,
      who(item, 'marked_present_not_joined', 'marked_present_too_short', 'marked_absent_was_in_room'), who(item, 'late'), who(item, 'left_early'),
      item.unknown,
      ...verdictCells(item.verdict_summary),
      item.talk?.teacher_share != null ? `${Math.round(item.talk.teacher_share * 100)}%` : '',
      item.talk ? item.talk.silent.length : '',
      // Marks Meet wrote, even if a person changed one since — the backend report's rule.
      (item.verdicts ?? []).filter((v) => v.register?.written === true).length,
      (item.verdicts ?? []).filter((v) => v.register?.state === 'override').length,
      recordingCell(item),
    ];
  });
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// ── the class beside a recording (watch pages) ───────────────────────────────────────────

export interface ParticipantRow {
  name: string;
  mark: MeetMark;
  first_join: string | null;
  last_leave: string | null;
  minutes_in_lesson: number;
  joins: number;
  flags: MeetFlag[];
  role?: string | null;
  /** Staff pages only; the watch-link page never gets one. */
  verdict?: MeetVerdict | null;
}

export interface UnconfirmedRow {
  display_name: string | null;
  kind: 'signed_in' | 'guest' | 'phone';
  first_join: string | null;
  last_leave: string | null;
  minutes_in_lesson: number;
  joins: number;
}

/**
 * Who was there, for a page beside a recording: the lesson's whole class with marks, and — when
 * the lesson has a Meet record — each one's time in the room. The watch-link page gets exactly
 * this from the server (`public_participants`); the Recordings player builds it from the record.
 */
export interface ParticipantsView {
  state: MeetRecord['state'];
  /** Present while the lesson waits on Google Meet: its stage and times. */
  waiting?: MeetRecord['waiting'] | null;
  teacher: ParticipantRow | null;
  students: ParticipantRow[];
  unknown: UnconfirmedRow[];
  others: ParticipantRow[];
  held_back: boolean;
  partial: boolean;
}

export function toParticipantsView(record: MeetRecord): ParticipantsView {
  const row = (p: MeetPerson): ParticipantRow => ({
    name: p.name, mark: p.mark, first_join: p.first_join, last_leave: p.last_leave,
    minutes_in_lesson: p.minutes_in_lesson, joins: p.joins, flags: p.flags, role: p.role, verdict: p.verdict ?? null,
  });
  if (record.state !== 'ready') {
    return {
      state: record.state, waiting: record.waiting ?? null, teacher: null, unknown: [], others: [], held_back: false, partial: false,
      students: (record.roster ?? []).map((r) => ({
        name: r.name, mark: r.mark, first_join: null, last_leave: null, minutes_in_lesson: 0, joins: 0, flags: [],
      })),
    };
  }
  return {
    state: 'ready',
    teacher: record.teacher ? row(record.teacher) : null,
    students: (record.students ?? []).map(row),
    unknown: (record.unknown ?? []).map((u) => ({
      display_name: u.display_name, kind: u.kind, first_join: u.first_join, last_leave: u.last_leave,
      minutes_in_lesson: u.minutes_in_lesson, joins: u.joins,
    })),
    others: (record.others ?? []).map(row),
    held_back: Boolean(record.held_back),
    partial: Boolean(record.partial),
  };
}

/** In the room first, then everyone who was not — each part alphabetical. */
export function classOrder(rows: ParticipantRow[]): ParticipantRow[] {
  const byName = (a: ParticipantRow, b: ParticipantRow) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
  return [...rows.filter((r) => r.first_join).sort(byName), ...rows.filter((r) => !r.first_join).sort(byName)];
}

export const MARK_LABEL_RU: Record<Exclude<MeetMark, null>, string> = {
  present: 'Был',
  late: 'Опоздал',
  absent: 'Не был',
  removed: 'Снят с урока',
};

/** A flag in Russian, for pages read by accountants and curators. */
export function flagTextRu(flag: MeetFlag): string {
  const m = flag.minutes ?? 0;
  switch (flag.code) {
    case 'late': return `Опоздал на ${m} мин`;
    case 'left_early': return `Ушёл на ${m} мин раньше`;
    case 'marked_present_not_joined': return 'Отмечен, но не заходил';
    case 'marked_present_too_short': return `Отмечен, но на уроке ${m} из ${flag.required ?? '?'} мин`;
    case 'marked_absent_was_in_room': return `Отмечен «не был», но был на уроке ${m} мин`;
    case 'teacher_late': return `Начал на ${m} мин позже`;
    case 'ended_early': return `Закончил на ${m} мин раньше`;
    case 'teacher_not_joined': return 'Преподаватель не заходил';
    default: return flag.code;
  }
}
