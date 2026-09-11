import { APP_TIMEZONE } from './datetime';
import type {
  MeetFlag,
  MeetFlagCode,
  MeetLessonFlag,
  MeetLessonSummary,
  MeetMark,
  MeetPerson,
  MeetPresence,
  MeetRecord,
  MeetSpan,
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
    case 'marked_absent_was_in_room': return `Marked absent, in the room ${m} min`;
    case 'teacher_late': return `Started ${m} min late`;
    case 'ended_early': return `Ended ${m} min early`;
    case 'teacher_not_joined': return 'Teacher never joined';
    default: return flag.code;
  }
}

export const MARK_LABEL: Record<Exclude<MeetMark, null>, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  removed: 'Removed',
};

/** The review list's one-line reading of a lesson, most serious first. */
export function lessonHeadline(item: Pick<MeetLessonSummary, 'mismatches' | 'unknown' | 'flags'>): string {
  const parts: string[] = [];
  if (item.mismatches) parts.push(`${item.mismatches} mark${item.mismatches === 1 ? '' : 's'} disagree`);
  const teacherTiming = item.flags.filter((f) => f.code === 'teacher_late' || f.code === 'ended_early');
  teacherTiming.forEach((f) => parts.push(flagText(f)));
  const late = item.flags.filter((f) => f.code === 'late').length;
  if (late) parts.push(`${late} late`);
  if (item.unknown) parts.push(`${item.unknown} to confirm`);
  return parts.length ? parts.join(' · ') : 'All clear';
}

/** "eventId:userId" → the disagreeing flags, for the attendance journal's warning dots. */
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
  | 'to_confirm';

/** The issues a head can filter by, in the order they matter for a report. */
export const ISSUES: { key: IssueKey; label: string; hint: string }[] = [
  { key: 'teacher_late', label: 'Teacher late', hint: 'The teacher joined more than 2 min after the start' },
  { key: 'ended_early', label: 'Ended early', hint: 'The teacher left more than 5 min before the end' },
  { key: 'teacher_not_joined', label: 'Teacher never joined', hint: 'No confirmed account of the teacher was in the room' },
  { key: 'marks_disagree', label: 'Marks disagree', hint: 'Marked present but never joined, or marked absent but in the room 10+ min' },
  { key: 'students_late', label: 'Students late', hint: 'A student joined more than 5 min after the start' },
  { key: 'left_early', label: 'Students left early', hint: 'A student left more than 10 min before the end' },
  { key: 'to_confirm', label: 'To confirm', hint: 'Google accounts nobody has named yet' },
];

type Reportable = Pick<MeetLessonSummary, 'flags' | 'unknown' | 'mismatches'>;

const hasCode = (item: Reportable, ...codes: MeetFlagCode[]) => item.flags.some((f) => codes.includes(f.code));

export function hasIssue(item: Reportable, key: IssueKey): boolean {
  switch (key) {
    case 'teacher_late': return hasCode(item, 'teacher_late');
    case 'ended_early': return hasCode(item, 'ended_early');
    case 'teacher_not_joined': return hasCode(item, 'teacher_not_joined');
    case 'marks_disagree': return hasCode(item, 'marked_present_not_joined', 'marked_absent_was_in_room');
    case 'students_late': return hasCode(item, 'late');
    case 'left_early': return hasCode(item, 'left_early');
    case 'to_confirm': return item.unknown > 0;
    default: return false;
  }
}

/** "Needs attention": something a person has to act on — not every late student. */
export function needsAttention(item: Reportable): boolean {
  return item.mismatches > 0 || item.unknown > 0 || item.flags.some((f) => f.role === 'teacher');
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
}

/** One row per teacher, the ones with most to talk about first. */
export function tallyByTeacher(items: MeetLessonSummary[]): TeacherTally[] {
  const rows = new Map<number, TeacherTally>();
  for (const item of items) {
    if (!item.teacher) continue;
    const row = rows.get(item.teacher.id) ?? {
      teacherId: item.teacher.id, name: item.teacher.name, lessons: 0, teacher_late: 0, late_minutes: 0,
      ended_early: 0, teacher_not_joined: 0, marks_disagree: 0, to_confirm: 0,
    };
    row.lessons += 1;
    const late = item.flags.find((f) => f.code === 'teacher_late');
    if (late) { row.teacher_late += 1; row.late_minutes += late.minutes ?? 0; }
    if (hasIssue(item, 'ended_early')) row.ended_early += 1;
    if (hasIssue(item, 'teacher_not_joined')) row.teacher_not_joined += 1;
    if (hasIssue(item, 'marks_disagree')) row.marks_disagree += 1;
    if (hasIssue(item, 'to_confirm')) row.to_confirm += 1;
    rows.set(item.teacher.id, row);
  }
  const weight = (r: TeacherTally) => r.teacher_late + r.ended_early + r.teacher_not_joined + r.marks_disagree;
  return [...rows.values()].sort((a, b) => weight(b) - weight(a) || a.name.localeCompare(b.name));
}

function almatyDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: APP_TIMEZONE });
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const who = (item: MeetLessonSummary, ...codes: MeetFlagCode[]) =>
  item.flags.filter((f) => codes.includes(f.code)).map((f) => `${f.name} (${flagText(f)})`).join('; ');

/**
 * The review list as a spreadsheet, for reporting. Opens correctly in Excel (UTF-8 with BOM, so
 * Cyrillic names survive); dates and times are Almaty.
 */
export function reportCsv(items: MeetLessonSummary[]): string {
  const header = ['Date', 'Start', 'End', 'Lesson', 'Groups', 'Teacher', 'Teacher joined', 'Teacher left',
    'Teacher issues', 'Students joined', 'Students', 'Marks disagree', 'Students late', 'Students left early',
    'Accounts to confirm'];
  const rows = items.map((item) => [
    almatyDate(item.start), clock(item.start), clock(item.end), item.title,
    item.groups.map((g) => g.name).join(', '), item.teacher?.name ?? '',
    item.teacher?.first_join ? clock(item.teacher.first_join) : '', item.teacher?.last_leave ? clock(item.teacher.last_leave) : '',
    item.flags.filter((f) => f.role === 'teacher').map(flagText).join('; '),
    item.joined, item.students,
    who(item, 'marked_present_not_joined', 'marked_absent_was_in_room'), who(item, 'late'), who(item, 'left_early'),
    item.unknown,
  ]);
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
    minutes_in_lesson: p.minutes_in_lesson, joins: p.joins, flags: p.flags, role: p.role,
  });
  if (record.state !== 'ready') {
    return {
      state: record.state, teacher: null, unknown: [], others: [], held_back: false, partial: false,
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
    case 'marked_absent_was_in_room': return `Отмечен «не был», но был в комнате ${m} мин`;
    case 'teacher_late': return `Начал на ${m} мин позже`;
    case 'ended_early': return `Закончил на ${m} мин раньше`;
    case 'teacher_not_joined': return 'Преподаватель не заходил';
    default: return flag.code;
  }
}
