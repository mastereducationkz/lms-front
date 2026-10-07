import { APP_TIMEZONE } from './datetime';
import { activeLocale, formatDate, LOCALES, t, type Locale, type MessageKey } from './i18n';
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
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

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

const FLAG_TEXT: Record<MeetFlagCode, MessageKey> = {
  late: 'meet.flag.late',
  left_early: 'meet.flag.leftEarly',
  marked_present_not_joined: 'meet.flag.markedPresentNotJoined',
  marked_present_too_short: 'meet.flag.markedPresentTooShort',
  marked_absent_was_in_room: 'meet.flag.markedAbsentWasInRoom',
  teacher_late: 'meet.flag.teacherLate',
  ended_early: 'meet.flag.endedEarly',
  teacher_not_joined: 'meet.flag.teacherNotJoined',
};

/** A flag in words, the way the lesson card, the review list and the accountants' pages all say it. */
export function flagText(flag: MeetFlag, locale: Locale = activeLocale()): string {
  const key = FLAG_TEXT[flag.code];
  if (!key) return flag.code;
  return t(key, { minutes: flag.minutes ?? 0, required: flag.required ?? '?' }, locale);
}

// ── reviewing a flag (owner, 2026-09-11) ─────────────────────────────────────────────────

const TEACHER_FLAGS: ReadonlySet<MeetFlagCode> = new Set(['teacher_late', 'ended_early', 'teacher_not_joined']);
const RECORD_READERS = new Set(['admin', 'head_curator', 'head_teacher', 'teacher', 'curator']);
const TEACHER_FLAG_REVIEWERS = new Set(['admin', 'head_curator', 'head_teacher']);
// The journal's own rule: curators read marks but never write them.
const MARKERS = new Set(['admin', 'head_curator', 'head_teacher', 'teacher']);

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

type VerdictFields = Pick<MeetVerdict, 'verdict' | 'minutes' | 'required' | 'late_minutes'> & Partial<Pick<MeetVerdict, 'provisional'>>;

function verdictWords(value: NonNullable<MeetVerdict['verdict']>, v: VerdictFields, locale: Locale): string {
  if (value === 'late') return t('meet.verdict.late', { minutes: v.late_minutes }, locale);
  if (value === 'absent') {
    if (v.minutes <= 0) return t('meet.verdict.notInLesson', undefined, locale);
    return t('meet.verdict.absentFor', { minutes: v.minutes, required: v.required }, locale);
  }
  return markLabel(value, locale);
}

/**
 * "Present", "Late 12 min", "Absent · 30 of 45 min" — the verdict with its reason. Held back, it is the
 * verdict on the confirmed accounts with a «?» ("Late 9 min?"): a bare «not known yet» beside the
 * student's own confirmed account read as if that account were the unconfirmed one (2026-09-17).
 */
export function verdictText(v: VerdictFields, locale: Locale = activeLocale()): string {
  if (v.verdict) return verdictWords(v.verdict, v, locale);
  if (v.provisional) return `${verdictWords(v.provisional, v, locale)}?`;
  return t('meet.verdict.unknown', undefined, locale);
}

/** Why a held-back verdict may still change — for the hover; null when it is final. */
export function verdictHint(v: Pick<MeetVerdict, 'held_back'>, locale: Locale = activeLocale()): string | null {
  if (!v.held_back) return null;
  return t('meet.verdict.heldBackHint', undefined, locale);
}

/** The mark and the verdict say different things — about attending, or only present versus late. */
export function verdictDiffers(mark: MeetMark | undefined, v: Pick<MeetVerdict, 'verdict'> | null | undefined): boolean {
  if (!v?.verdict || !mark || mark === 'removed') return false;
  return mark !== v.verdict;
}

/** The rules in one line, for the pages' legends; null from a server without verdicts. */
export function rulesText(rules: MeetVerdictRules | undefined, locale: Locale = activeLocale()): string | null {
  if (!rules) return null;
  const share = Math.round(rules.present_share * 100);
  const hour = Math.floor(60 * rules.present_share);
  return t('meet.verdict.rules', { lateAfter: rules.late_after_minutes, share, hour }, locale);
}

/** "Meet: 12 present · 2 late · 1 absent · 3 not marked" for a list row; null without verdicts. */
export function verdictLine(summary: MeetVerdictSummary | null | undefined, locale: Locale = activeLocale()): string | null {
  if (!summary) return null;
  const count = (key: MessageKey, n: number) => (n ? t(key, { count: n }, locale) : null);
  const parts = [
    count('meet.count.present', summary.present),
    count('meet.count.late', summary.late),
    count('meet.count.absent', summary.absent),
    count('meet.count.notKnown', summary.held_back),
  ].filter(Boolean);
  if (!parts.length) return null;
  const unmarked = summary.unmarked ? ` · ${t('meet.count.notMarked', { count: summary.unmarked }, locale)}` : '';
  return `Meet: ${parts.join(' · ')}${unmarked}`;
}

/** "eventId:userId" → the student's verdict, for the attendance journal. */
export function verdictIndex(items: Pick<MeetLessonSummary, 'event_id' | 'verdicts'>[]): Map<string, MeetStudentVerdict> {
  const index = new Map<string, MeetStudentVerdict>();
  for (const item of items) for (const v of item.verdicts ?? []) index.set(`${item.event_id}:${v.user_id}`, v);
  return index;
}

/** The «Other» preset: its label says nothing, so only what was written for it is shown. */
const isOtherLabel = (label: string | null | undefined) => LOCALES.some((l) => label === t('meet.reason.other', undefined, l));

/** The reason in words: the preset, the comment, or — for «Other» — just what was written. */
export function reasonText(review: MeetFlagReview | null | undefined): string | null {
  if (!review) return null;
  const label = review.reason_code === 'other' || isOtherLabel(review.reason_label) ? null : review.reason_label;
  return [label, review.text?.trim()].filter(Boolean).join(' — ') || null;
}

const MARK_KEY: Record<Exclude<MeetMark, null>, MessageKey> = {
  present: 'meet.mark.present',
  late: 'meet.mark.late',
  absent: 'meet.mark.absent',
  removed: 'meet.mark.removed',
};

/** A journal mark in words: "Present", «Был». */
export function markLabel(mark: Exclude<MeetMark, null>, locale: Locale = activeLocale()): string {
  return t(MARK_KEY[mark], undefined, locale);
}

/** The marks in the signed-in user's language, for code that reads them as a table. */
export const MARK_LABEL: Readonly<Record<Exclude<MeetMark, null>, string>> = {
  get present() { return markLabel('present'); },
  get late() { return markLabel('late'); },
  get absent() { return markLabel('absent'); },
  get removed() { return markLabel('removed'); },
};

/** The review list's one-line reading of a lesson, most serious first; answered flags last. */
export function lessonHeadline(item: Pick<MeetLessonSummary, 'mismatches' | 'unknown' | 'flags'>, locale: Locale = activeLocale()): string {
  const open = item.flags.filter((f) => !f.review);
  const parts: string[] = [];
  const disagree = open.filter((f) => isMismatch(f.code) && !isTeacherFlag(f.code)).length;
  if (disagree) parts.push(t('meet.headline.disagree', { count: disagree }, locale));
  open.filter((f) => isTeacherFlag(f.code)).forEach((f) => parts.push(flagText(f, locale)));
  const late = open.filter((f) => f.code === 'late').length;
  if (late) parts.push(t('meet.count.late', { count: late }, locale));
  if (item.unknown) parts.push(t('meet.headline.toConfirm', { count: item.unknown }, locale));
  const reviewed = item.flags.length - open.length;
  if (reviewed) parts.push(t('meet.headline.reviewed', { count: reviewed }, locale));
  return parts.length ? parts.join(' · ') : t('meet.headline.allClear', undefined, locale);
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

const issue = (key: IssueKey, label: MessageKey, hint: MessageKey) => ({
  key,
  get label() { return t(label); },
  get hint() { return t(hint); },
});

/** The issues a head can filter by, in the order they matter for a report — in the signed-in user's language. */
export const ISSUES: readonly { readonly key: IssueKey; readonly label: string; readonly hint: string }[] = [
  issue('teacher_late', 'meet.issue.teacherLate', 'meet.issue.teacherLateHint'),
  issue('ended_early', 'meet.issue.endedEarly', 'meet.issue.endedEarlyHint'),
  issue('teacher_not_joined', 'meet.issue.teacherNotJoined', 'meet.issue.teacherNotJoinedHint'),
  issue('marks_disagree', 'meet.issue.marksDisagree', 'meet.issue.marksDisagreeHint'),
  issue('students_late', 'meet.issue.studentsLate', 'meet.issue.studentsLateHint'),
  issue('left_early', 'meet.issue.leftEarly', 'meet.issue.leftEarlyHint'),
  issue('not_marked', 'meet.issue.notMarked', 'meet.issue.notMarkedHint'),
  issue('overrides', 'meet.issue.overrides', 'meet.issue.overridesHint'),
  issue('to_confirm', 'meet.issue.toConfirm', 'meet.issue.toConfirmHint'),
  // A filter for reports only: a quiet test lesson is normal, so it never asks for attention.
  issue('silent_students', 'meet.issue.silentStudents', 'meet.issue.silentStudentsHint'),
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

function almatyDate(iso: string, locale: Locale): string {
  return formatDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' }, locale);
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

/**
 * A flag for the spreadsheet: what happened and, once reviewed, the answer — in the language of
 * whoever downloads it (Settings → Language), like the page it comes from.
 */
function flagCell(flag: MeetFlag, locale: Locale): string {
  if (!flag.review) return flagText(flag, locale);
  return t('meetViews.csv.flagReviewed', {
    flag: flagText(flag, locale), reason: reasonText(flag.review) ?? t('meet.register.noReason', undefined, locale),
  }, locale);
}

const who = (locale: Locale, item: MeetLessonSummary, ...codes: MeetFlagCode[]) =>
  item.flags.filter((f) => codes.includes(f.code)).map((f) => `${f.name} (${flagCell(f, locale)})`).join('; ');

const RECORDING_CSV: Record<LessonRecordingStatus, MessageKey> = {
  ready: 'meetViews.csv.recordingReady', pending: 'meetViews.csv.recordingPending', waiting: 'meetViews.sync.waiting',
  failed: 'meetViews.csv.recordingFailed', removed: 'meetViews.csv.recordingRemoved', missing: 'meetViews.csv.recordingNone',
};

/** "Ready · 58 min", "Processing", "None" — empty when the server said nothing about it. */
function recordingCell(item: MeetLessonSummary, locale: Locale): string {
  const recording = item.recording;
  if (!recording) return '';
  const length = recording.status === 'ready' ? formatDurationWords(recording.duration_seconds, locale) : null;
  const key = RECORDING_CSV[recording.status];
  if (length) return `${t(RECORDING_CSV.ready, undefined, locale)} · ${length}`;
  return key ? t(key, undefined, locale) : recording.status;
}

/** Counts by verdict, not marked, and "agree of compared" — blank for a lesson without verdicts. */
function verdictCells(summary: MeetVerdictSummary | null | undefined, locale: Locale): (string | number)[] {
  if (!summary) return ['', '', '', '', '', ''];
  return [summary.present, summary.late, summary.absent, summary.held_back, summary.unmarked,
    summary.compared ? t('meetViews.csv.agreeOf', { agree: summary.agree, compared: summary.compared }, locale) : ''];
}

const REPORT_HEADER: MessageKey[] = ['meetViews.csv.date', 'meetViews.csv.start', 'meetViews.csv.end', 'meetViews.csv.lesson',
  'meetViews.csv.groups', 'meetViews.csv.teacher', 'meetViews.csv.teacherJoined', 'meetViews.csv.teacherLeft',
  'meetViews.csv.teacherIssues', 'meetViews.csv.studentsJoined', 'meetViews.csv.students', 'meetViews.csv.marksDisagree',
  'meetViews.csv.studentsLate', 'meetViews.csv.studentsLeftEarly', 'meetViews.csv.toConfirm', 'meetViews.csv.meetPresent',
  'meetViews.csv.meetLate', 'meetViews.csv.meetAbsent', 'meetViews.csv.meetUnknown', 'meetViews.csv.notMarked',
  'meetViews.csv.marksAgree', 'meetViews.csv.teacherTalkShare', 'meetViews.csv.silentStudents', 'meetViews.csv.meetWrote',
  'meetViews.csv.changedAfterMeet', 'meetViews.csv.recording'];

/**
 * The review list as a spreadsheet, for reporting. Opens correctly in Excel (UTF-8 with BOM, so
 * Cyrillic names survive); dates and times are Almaty; headers in the downloader's language.
 */
export function reportCsv(items: MeetLessonSummary[], locale: Locale = activeLocale()): string {
  const header = REPORT_HEADER.map((key) => t(key, undefined, locale));
  const rows = items.map((item) => {
    const lesson = [almatyDate(item.start, locale), clock(item.start), clock(item.end), item.title,
      item.groups.map((g) => g.name).join(', '), item.teacher?.name ?? ''];
    // Zeros here would read as "nobody came"; the lesson's call simply hasn't come through yet.
    // The recording is its own news and is known either way.
    if (stillLoading(item)) {
      return [...lesson, t('meetViews.csv.loading', undefined, locale), ...Array(header.length - lesson.length - 2).fill(''), recordingCell(item, locale)];
    }
    return [...lesson,
      item.teacher?.first_join ? clock(item.teacher.first_join) : '', item.teacher?.last_leave ? clock(item.teacher.last_leave) : '',
      item.flags.filter((f) => f.role === 'teacher').map((f) => flagCell(f, locale)).join('; '),
      item.joined, item.students,
      who(locale, item, 'marked_present_not_joined', 'marked_present_too_short', 'marked_absent_was_in_room'), who(locale, item, 'late'),
      who(locale, item, 'left_early'),
      item.unknown,
      ...verdictCells(item.verdict_summary, locale),
      item.talk?.teacher_share != null ? `${Math.round(item.talk.teacher_share * 100)}%` : '',
      item.talk ? item.talk.silent.length : '',
      // Marks Meet wrote, even if a person changed one since — the backend report's rule.
      (item.verdicts ?? []).filter((v) => v.register?.written === true).length,
      (item.verdicts ?? []).filter((v) => v.register?.state === 'override').length,
      recordingCell(item, locale),
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
  /** 'webinar': who came, with no class, marks or flags (2026-10-04). Absent = a lesson. */
  kind?: MeetRecord['kind'];
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
      state: record.state, kind: record.kind, waiting: record.waiting ?? null, teacher: null, unknown: [], others: [], held_back: false, partial: false,
      students: (record.roster ?? []).map((r) => ({
        name: r.name, mark: r.mark, first_join: null, last_leave: null, minutes_in_lesson: 0, joins: 0, flags: [],
      })),
    };
  }
  return {
    state: 'ready',
    kind: record.kind,
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
