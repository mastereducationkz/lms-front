import { APP_TIMEZONE } from './datetime';
import { activeLocale, formatDate, t, type Locale, type MessageKey } from './i18n';
import { clock } from './meetAttendance';
import type { MeetLessonSummary } from '../services/api/meetAttendance';
import type {
  GroupTalk,
  GroupTalkLesson,
  PublicTalk,
  StudentLessonMark,
  StudentLessonState,
  TalkPerson,
  TalkQuestions,
  TalkRecord,
  TalkTally,
  TeacherTalk,
  TeacherTalkRow,
  TeachersTalk,
  TranscriptLine,
} from '../services/api/meetTalk';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

const pad = (n: number) => String(n).padStart(2, '0');

/** "45 s", "12 min", "1 h 05 min" (ru: «45 с», «12 мин», «1 ч 05 мин»). */
export function formatDuration(seconds: number | null | undefined, locale: Locale = activeLocale()): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return t('meet.duration.seconds', { seconds: s }, locale);
  const m = Math.round(s / 60);
  if (m < 60) return t('meet.duration.minutes', { minutes: m }, locale);
  return t('meet.duration.hours', { hours: Math.floor(m / 60), minutes: pad(m % 60) }, locale);
}

/** A transcript stamp: "7:05", "1:02:09"; before the lesson start, "-0:45". */
export function stamp(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const s = Math.floor(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${sign}${h}:${pad(m)}:${pad(s % 60)}` : `${sign}${m}:${pad(s % 60)}`;
}

/** A moment of the lesson on the Almaty clock, to the second: "20:09:56". */
export function clockAt(start: string, seconds: number): string {
  const moment = new Date(new Date(start).getTime() + seconds * 1000);
  if (!Number.isFinite(moment.getTime())) return stamp(seconds);
  return moment.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: APP_TIMEZONE });
}

/** 0..1 → "72%"; nothing known → "—". */
export function percent(share: number | null | undefined): string {
  if (share == null || !Number.isFinite(share)) return '—';
  return `${Math.round(share * 100)}%`;
}

// ── transcript search ────────────────────────────────────────────────────────────────────

/**
 * Lower case, and «ё» read as «е» — character by character, so every index in the folded text
 * is the same index in the original (a whole-string toLowerCase can change the length).
 */
const YO = 0x451; // «ё»
const YE = String.fromCodePoint(0x435); // «е»

function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const one = lower.length === ch.length ? lower : ch;
    out += one.codePointAt(0) === YO ? YE : one;
  }
  return out;
}

export interface TranscriptHit {
  line: TranscriptLine;
  /** [start, end) ranges of the match inside line.text. */
  ranges: [number, number][];
}

/** The lines that say the query (or whose speaker is it), each with where it matched. */
export function searchTranscript(lines: TranscriptLine[], query: string): TranscriptHit[] {
  const needle = fold(query.trim().replace(/\s+/g, ' '));
  if (!needle) return lines.map((line) => ({ line, ranges: [] }));
  const hits: TranscriptHit[] = [];
  for (const line of lines) {
    const hay = fold(line.text);
    const ranges: [number, number][] = [];
    for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
      ranges.push([at, at + needle.length]);
    }
    if (ranges.length || fold(line.speaker_label).includes(needle)) hits.push({ line, ranges });
  }
  return hits;
}

/** A line's text cut into plain and matched parts, for rendering. */
export function highlightParts(text: string, ranges: [number, number][]): { text: string; hit: boolean }[] {
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const [a, b] of ranges) {
    if (a > at) parts.push({ text: text.slice(at, a), hit: false });
    parts.push({ text: text.slice(a, b), hit: true });
    at = b;
  }
  if (at < text.length || parts.length === 0) parts.push({ text: text.slice(at), hit: false });
  return parts;
}

// ── the speaking timeline ────────────────────────────────────────────────────────────────

export interface TalkAxis {
  /** Seconds from the lesson start. */
  from: number;
  to: number;
  lessonSeconds: number;
  ticks: { at: number; label: string }[];
}

const MARGIN = 30 * 60;

/**
 * The timeline's range: the lesson, stretched to whoever spoke before it or after it — but no
 * further than the 30 minutes the record counts. Ticks are Almaty clock times.
 */
export function talkAxis(start: string, lessonSeconds: number, people: Pick<TalkPerson, 'spans'>[]): TalkAxis {
  let from = 0;
  let to = lessonSeconds;
  for (const p of people) {
    for (const [a, b] of p.spans) {
      from = Math.min(from, a);
      to = Math.max(to, b);
    }
  }
  from = Math.max(from, -MARGIN);
  to = Math.min(to, lessonSeconds + MARGIN);
  from = Math.floor(from / 300) * 300;
  to = Math.ceil(to / 300) * 300;
  const base = new Date(start).getTime();
  const step = to - from > 150 * 60 ? 1800 : 900;
  const ticks: { at: number; label: string }[] = [];
  // Tick on quarter hours of the Almaty clock (a whole number of hours from UTC).
  const firstAbs = Math.ceil((base + from * 1000) / (step * 1000)) * step * 1000;
  for (let abs = firstAbs; abs <= base + to * 1000; abs += step * 1000) {
    ticks.push({ at: (abs - base) / 1000, label: clock(new Date(abs).toISOString()) });
  }
  return { from, to, lessonSeconds, ticks };
}

/** Where a moment sits on the axis, 0–100, clamped. */
export function axisPosition(axis: TalkAxis, at: number): number {
  const span = axis.to - axis.from;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((at - axis.from) / span) * 100));
}

/** A speech stretch as a bar; a second of speech still shows as a sliver. */
export function spanBar(axis: TalkAxis, [a, b]: [number, number]): { left: number; width: number } | null {
  if (!(b > a) || b < axis.from || a > axis.to) return null;
  const left = axisPosition(axis, a);
  return { left: Math.min(left, 99.7), width: Math.max(0.3, axisPosition(axis, b) - left) };
}

// ── who spoke when, in blocks ────────────────────────────────────────────────────────────
// The exact lanes are hard to read: a lesson is hundreds of slivers. Blocks of five minutes, each
// saying how long that person spoke in it, answer "who talked, and when" at a glance.

export interface TalkGridColumn {
  /** Seconds from the lesson start. */
  from: number;
  to: number;
  /** The block's start on the Almaty clock. */
  label: string;
}

export interface TalkGridRow {
  person: TalkPerson;
  /** Seconds spoken in each column. */
  cells: number[];
}

export interface TalkGrid {
  binSeconds: number;
  columns: TalkGridColumn[];
  rows: TalkGridRow[];
  /** Per column: the teacher's seconds, and the students' (unconfirmed voices included). */
  teacher: number[];
  students: number[];
}

/**
 * Five-minute blocks (ten for a lesson over 90 minutes) across the lesson, stretched to whoever
 * spoke before or after it. One row per person who spoke — and the teacher even if they did not.
 * `binSeconds` asks for other blocks: the recording's side panel reads the lesson minute by minute.
 */
export function talkGrid(talk: Pick<TalkRecord, 'start' | 'lesson_seconds' | 'people'>, binSeconds?: number): TalkGrid {
  const lessonSeconds = talk.lesson_seconds ?? 3600;
  const bin = binSeconds && binSeconds > 0 ? binSeconds : lessonSeconds > 90 * 60 ? 600 : 300;
  const people = (talk.people ?? []).filter((p) => p.seconds > 0 || p.role === 'teacher');
  let from = 0;
  let to = lessonSeconds;
  for (const p of people) {
    for (const [a, b] of p.spans) {
      from = Math.min(from, a);
      to = Math.max(to, b);
    }
  }
  from = Math.floor(Math.max(from, -MARGIN) / bin) * bin;
  to = Math.ceil(Math.min(to, lessonSeconds + MARGIN) / bin) * bin;
  const base = new Date(talk.start).getTime();
  const columns: TalkGridColumn[] = [];
  for (let at = from; at < to; at += bin) {
    columns.push({ from: at, to: at + bin, label: clock(new Date(base + at * 1000).toISOString()) });
  }
  const inside = (spans: [number, number][], a: number, b: number) =>
    spans.reduce((sum, [x, y]) => sum + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);
  const rows = people.map((person) => ({
    person,
    cells: columns.map((c) => Math.round(inside(person.spans, c.from, c.to))),
  }));
  const total = (roles: TalkPerson['role'][]) => columns.map((_, i) => rows
    .filter((r) => roles.includes(r.person.role))
    .reduce((sum, r) => sum + r.cells[i], 0));
  return { binSeconds: bin, columns, rows, teacher: total(['teacher']), students: total(['student', 'unknown']) };
}

// Seconds in a five-minute block that make it one shade darker: a few words, a sentence or two,
// a real answer, a long turn, most of the block.
const SHADES = [15, 45, 90, 150];

/** How dark a block is: 0 (said nothing) to 5. */
export function blockShade(seconds: number, binSeconds = 300): number {
  if (seconds <= 0) return 0;
  const scaled = seconds * (300 / binSeconds);
  return 1 + SHADES.filter((limit) => scaled >= limit).length;
}

/** How dark one minute of a person's strip is: 0 (nothing), 1 (a few words), 2 (a sentence or two), 3 (most of it). */
export function minuteShade(seconds: number, binSeconds = 60): number {
  if (seconds <= 0) return 0;
  const scaled = seconds * (60 / binSeconds);
  return scaled < 10 ? 1 : scaled < 30 ? 2 : 3;
}

/** Clock labels every quarter hour of the Almaty clock between two lesson seconds, placed in lesson seconds. */
export function clockTicks(start: string, from: number, to: number, stepSeconds = 900): { at: number; label: string }[] {
  const base = new Date(start).getTime();
  if (!Number.isFinite(base) || !(to > from)) return [];
  const step = stepSeconds * 1000;
  // Almaty is a whole number of hours from UTC, so its quarter hours are UTC's.
  const ticks: { at: number; label: string }[] = [];
  for (let abs = Math.ceil((base + from * 1000) / step) * step; abs <= base + to * 1000; abs += step) {
    ticks.push({ at: (abs - base) / 1000, label: clock(new Date(abs).toISOString()) });
  }
  return ticks;
}

/** A block's speech as "0:45" / "3:10" — short enough to sit inside the block. */
export function blockTime(seconds: number): string {
  if (seconds <= 0) return '';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** The transcript lines said in one block — by one person, or by anyone (key null). */
export function linesInBlock(lines: TranscriptLine[], focus: { key: string | null; from: number; to: number }): TranscriptLine[] {
  return lines.filter((line) => line.lesson_at < focus.to && line.lesson_at + Math.max(0, line.end - line.at) > focus.from
    && (focus.key === null || line.speaker_key === focus.key));
}

// ── summaries ────────────────────────────────────────────────────────────────────────────

/** Lessons whose list entry says some student in the room never spoke. */
export function silentCount(item: Pick<MeetLessonSummary, 'talk'>): number {
  return item.talk?.silent.length ?? 0;
}

/** "Teacher 72% · students 28% · 3 didn't speak" — the lesson card's one line. */
export function talkSummaryLine(talk: Pick<TalkRecord, 'teacher_share' | 'students_share' | 'silent_students'>, locale: Locale = activeLocale()): string {
  const silent = talk.silent_students?.length ?? 0;
  return [
    t('meet.talk.teacherShare', { share: percent(talk.teacher_share) }, locale),
    t('meet.talk.studentsShare', { share: percent(talk.students_share) }, locale),
    silent ? t('meet.talk.silentCount', { count: silent }, locale) : null,
  ].filter(Boolean).join(' · ');
}

/**
 * "eventId:userId" → seconds spoken, for the attendance journal's hover: everyone who spoke,
 * and 0 for those in the room who never did. Lessons without talk time add nothing.
 */
export function talkSecondsIndex(items: Pick<MeetLessonSummary, 'event_id' | 'talk'>[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const item of items) {
    if (!item.talk) continue;
    for (const uid of item.talk.silent) index.set(`${item.event_id}:${uid}`, 0);
    for (const [uid, seconds] of Object.entries(item.talk.seconds)) index.set(`${item.event_id}:${uid}`, seconds);
  }
  return index;
}

/** The journal's hover line for one student in one lesson, or null when there is no talk time. */
export function spokeNote(seconds: number | undefined, locale: Locale = activeLocale()): string | null {
  if (seconds === undefined) return null;
  if (seconds <= 0) return t('meet.talk.didntSpeakInMeet', undefined, locale);
  return t('meet.talk.spokeInMeet', { duration: formatDuration(seconds, locale) }, locale);
}

/** The average teacher share over the lessons that have talk time, or null when none do. */
export function averageTeacherShare(items: Pick<MeetLessonSummary, 'talk'>[]): number | null {
  const shares = items.map((i) => i.talk?.teacher_share).filter((s): s is number => s != null);
  return shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null;
}

/**
 * The watch page's talk time (no ids, no transcript) as a TalkRecord the panel can draw. The
 * lesson's length comes from the page itself: the public shape does not repeat it.
 */
export function publicTalkRecord(talk: PublicTalk, lesson: { title: string; start: string; end: string }): TalkRecord {
  const lessonSeconds = talk.lesson_seconds
    ?? Math.max(60, (new Date(lesson.end).getTime() - new Date(lesson.start).getTime()) / 1000);
  return {
    event_id: 0,
    title: lesson.title,
    start: lesson.start,
    end: lesson.end,
    state: talk.state,
    enabled: true,
    source: talk.source,
    lesson_seconds: lessonSeconds,
    speech_seconds: talk.speech_seconds,
    silence_seconds: talk.silence_seconds,
    teacher_share: talk.teacher_share,
    students_share: talk.students_share,
    people: talk.people.map((p, i) => ({
      key: `n${i}`, user_id: null, name: p.name, role: p.role, seconds: p.seconds, share: p.share,
      turns: 0, longest_turn_seconds: 0, in_room: p.in_room, questions: null, spans: p.spans,
    })),
    silent_students: talk.silent_students.map((name, i) => ({ user_id: -1 - i, name })),
    buckets: talk.buckets,
    insights: null,
    recording_offset_seconds: talk.recording_offset_seconds ?? null,
  };
}

// ── questions ────────────────────────────────────────────────────────────────────────────

/** The share of the teacher's questions a student answered (0..1); null without questions. */
export function answeredShare(q: Pick<TalkQuestions, 'teacher_questions' | 'answered'> | null | undefined): number | null {
  if (!q || !q.teacher_questions) return null;
  return q.answered / q.teacher_questions;
}

/** "43 asked · 49% answered" (ru: «43 вопроса · 49% с ответом»); "—" without a transcript. */
export function questionsLine(
  q: Pick<TalkQuestions, 'teacher_questions' | 'answered'> | null | undefined,
  locale: Locale = activeLocale(),
): string {
  if (!q) return '—';
  const share = answeredShare(q);
  return share == null
    ? t('meet.talk.questionsAsked', { count: q.teacher_questions }, locale)
    : t('meet.talk.questionsAnswered', { count: q.teacher_questions, share: percent(share) }, locale);
}

/** Per lesson with a transcript, one decimal: 4.3. Null without transcripts. */
export function perLesson(count: number | null | undefined, lessons: number | null | undefined): number | null {
  if (count == null || !lessons) return null;
  return Math.round((count / lessons) * 10) / 10;
}

// ── a student's lessons: what each one was ───────────────────────────────────────────────

function markDate(iso: string, locale: Locale): string {
  return `${formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' }, locale)} ${clock(iso)}`;
}

/** A lesson bar's tooltip: "Fri 11 Sep 20:00 · spoke 12 min", "… · silent — in the room, never spoke". */
export function lessonMarkLabel(mark: StudentLessonMark, locale: Locale = activeLocale()): string {
  const what = mark.state === 'spoke' ? t('meet.talk.lessonSpoke', { duration: formatDuration(mark.seconds, locale) }, locale)
    : mark.state === 'silent' ? t('meet.talk.lessonSilent', undefined, locale)
      : mark.state === 'present' ? t('meet.talk.lessonPresent', undefined, locale)
        : t('meet.talk.lessonAbsent', undefined, locale);
  return `${markDate(mark.start, locale)} · ${what}`;
}

// ── a student's lessons, as a sparkline ──────────────────────────────────────────────────
// A dot per lesson wraps onto several lines once a group has had a few dozen lessons. One thin
// bar per lesson, as tall as the minutes spoken, fits 48 lessons on a line and shows the trend.

/** The most lessons one sparkline draws; older ones are counted, not drawn. */
export const MAX_LESSON_BARS = 48;

/** Which lessons a sparkline draws — the newest `max`, oldest first — and how many earlier ones it leaves out. */
export function lessonBars<T>(marks: T[], max = MAX_LESSON_BARS): { shown: T[]; earlier: number } {
  return marks.length > max ? { shown: marks.slice(marks.length - max), earlier: marks.length - max } : { shown: marks, earlier: 0 };
}

/** The group's longest speech by one student in one lesson — every sparkline's full height (a minute at least). */
export function lessonPeakSeconds(students: { lessons?: StudentLessonMark[] }[]): number {
  let peak = 60;
  for (const s of students) for (const m of s.lessons ?? []) peak = Math.max(peak, m.seconds);
  return peak;
}

/**
 * A lesson bar's height, 0..1 of the sparkline: minutes spoken against the group's peak (never so
 * short a few words vanish), a low stub for silent, nothing for "in briefly" and absent — those
 * are drawn as ticks on the baseline.
 */
export function lessonBarHeight(mark: Pick<StudentLessonMark, 'state' | 'seconds'>, peakSeconds: number): number {
  if (mark.state === 'spoke') return Math.min(1, Math.max(0.22, mark.seconds / Math.max(1, peakSeconds)));
  if (mark.state === 'silent') return 0.16;
  return 0;
}

/** Bar width and gap in px so `count` bars fit `space` px on one line: 10 px wide at most, 3 at least. */
export function lessonBarSize(count: number, space = 200): { width: number; gap: number } {
  if (count <= 0) return { width: 10, gap: 2 };
  const gap = count > 20 ? 1 : 2;
  const width = Math.floor((space - gap * (count - 1)) / count);
  return { width: Math.min(10, Math.max(3, width)), gap };
}

/** "spoke in 8 of 10" — lessons they said something in, of this group's lessons with talk time. */
export function spokeInText(marks: StudentLessonMark[], locale: Locale = activeLocale()): string {
  const spoke = marks.filter((m) => m.state === 'spoke').length;
  return t('meet.talk.spokeIn', { spoke, total: marks.length }, locale);
}

/** One line for the sparkline's row: in the room, spoke, silent, absent. */
export function marksSummary(marks: StudentLessonMark[], locale: Locale = activeLocale()): string {
  const count = (state: StudentLessonState) => marks.filter((m) => m.state === state).length;
  const params = { inRoom: marks.length - count('absent'), total: marks.length, spoke: count('spoke'), silent: count('silent'), absent: count('absent') };
  return t(params.absent ? 'meet.talk.marksSummaryAbsent' : 'meet.talk.marksSummary', params, locale);
}

// ── the group's table ────────────────────────────────────────────────────────────────────

export type GroupStudentSort =
  | 'name' | 'lessons_in_room' | 'lessons_spoke' | 'silent_lessons' | 'total_seconds' | 'avg_seconds'
  | 'share_of_student_talk' | 'questions' | 'answers';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });

/** The students' rows in the chosen order; ties (and missing figures) fall back to the name. */
export function sortGroupStudents(rows: GroupTalk['students'], key: GroupStudentSort, direction: 'asc' | 'desc'): GroupTalk['students'] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'name') return sign * byName(a, b);
    const x = a[key] ?? -1;
    const y = b[key] ?? -1;
    return x === y ? byName(a, b) : sign * (x - y);
  });
}

// ── every teacher side by side ───────────────────────────────────────────────────────────

export type TeacherSort =
  | 'name' | 'lessons' | 'groups' | 'teacher_share' | 'teacher_seconds' | 'student_seconds'
  | 'longest_stretch_seconds' | 'questions_per_lesson' | 'answered_share' | 'student_questions_per_lesson'
  | 'silent_per_lesson';

/** One figure of a teacher's row, worked out where the row only has the counts. */
export function teacherFigure(row: TalkTally, key: Exclude<TeacherSort, 'name'>): number | null {
  const q = row.questions;
  switch (key) {
    case 'questions_per_lesson': return perLesson(q?.teacher_questions, q?.lessons_with_transcript);
    case 'student_questions_per_lesson': return perLesson(q?.student_questions, q?.lessons_with_transcript);
    case 'answered_share': return answeredShare(q);
    default: return row[key];
  }
}

/** Teachers in the chosen order; a missing figure sorts last whichever way; ties by name. */
export function sortTeachers(rows: TeacherTalkRow[], key: TeacherSort, direction: 'asc' | 'desc'): TeacherTalkRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'name') return sign * byName(a, b);
    const x = teacherFigure(a, key);
    const y = teacherFigure(b, key);
    if (x == null || y == null) return x == null && y == null ? byName(a, b) : x == null ? 1 : -1;
    return x === y ? byName(a, b) : sign * (x - y);
  });
}

// ── spreadsheets ─────────────────────────────────────────────────────────────────────────

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const minutes = (seconds: number) => (seconds / 60).toFixed(1);
const blank = (value: number | null | undefined) => (value == null ? '' : value);
const csv = (rows: (string | number)[][]) => '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

function almatyDate(iso: string, locale: Locale): string {
  return formatDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' }, locale);
}

const header = (keys: MessageKey[], locale: Locale) => keys.map((key) => t(key, undefined, locale));

const LESSON_HEADER: MessageKey[] = ['meetViews.csv.date', 'meetViews.csv.start', 'meetViews.csv.lesson', 'meetViews.csv.groups',
  'meetViews.csv.teacher', 'meetViews.csv.teacherShare', 'meetViews.csv.studentsShare', 'meetViews.csv.speechMin',
  'meetViews.csv.longestMin', 'meetViews.csv.teacherQuestions', 'meetViews.csv.answered', 'meetViews.csv.answeredPct',
  'meetViews.csv.studentQuestions', 'meetViews.csv.medianWait', 'meetViews.csv.studentsInRoom', 'meetViews.csv.didntSpeak',
  'meetViews.csv.namesFromVoices'];

function lessonCells(l: GroupTalkLesson, locale: Locale): (string | number)[] {
  return [
    almatyDate(l.start, locale), clock(l.start), l.title, (l.groups ?? []).map((g) => g.name).join(', '), l.teacher_name ?? '',
    percent(l.teacher_share), percent(l.students_share), minutes(l.speech_seconds),
    l.longest_stretch_seconds == null ? '' : minutes(l.longest_stretch_seconds),
    blank(l.teacher_questions), blank(l.answered),
    l.teacher_questions ? percent((l.answered ?? 0) / l.teacher_questions) : '',
    blank(l.student_questions), blank(l.median_wait_seconds), l.students_in_room, l.silent,
    l.source === 'voices' ? t('meetViews.csv.yes', undefined, locale) : '',
  ];
}

const TALLY_HEADER: MessageKey[] = ['meetViews.csv.lessonCount', 'meetViews.csv.groupCount', 'meetViews.csv.teacherShareAvg',
  'meetViews.csv.studentsShareAvg', 'meetViews.csv.teacherSpokeMin', 'meetViews.csv.studentsSpokeMin',
  'meetViews.csv.longestAvgMin', 'meetViews.csv.teacherQuestions', 'meetViews.csv.answeredPct',
  'meetViews.csv.teacherQuestionsPerLesson', 'meetViews.csv.studentQuestions', 'meetViews.csv.studentQuestionsPerLesson',
  'meetViews.csv.silentPerLesson', 'meetViews.csv.inRoomPerLesson'];

function tallyCells(t: TalkTally): (string | number)[] {
  const q = t.questions;
  const share = answeredShare(q);
  return [
    t.lessons, t.groups, percent(t.teacher_share), percent(t.students_share), minutes(t.teacher_seconds),
    minutes(t.student_seconds), minutes(t.longest_stretch_seconds), q ? q.teacher_questions : '',
    share == null ? '' : percent(share), blank(teacherFigure(t, 'questions_per_lesson')),
    q ? q.student_questions : '', blank(teacherFigure(t, 'student_questions_per_lesson')), t.silent_per_lesson,
    t.students_in_room_per_lesson,
  ];
}

const STATE_CSV: Record<StudentLessonState, MessageKey> = {
  spoke: 'meetViews.csv.stateSpoke', silent: 'meetViews.csv.stateSilent', present: 'meetViews.csv.stateBrief', absent: 'meetViews.csv.stateAbsent',
};

/**
 * A group's talk time as a spreadsheet: the students, then the lessons. UTF-8 with a BOM so
 * Excel keeps Cyrillic names; dates and times are Almaty; durations in minutes. Headers and words
 * are in the downloader's language (Settings → Language).
 */
export function groupTalkCsv(data: GroupTalk, locale: Locale = activeLocale()): string {
  return csv([
    [t('meetViews.csv.group', undefined, locale), data.group.name, t('meetViews.csv.from', undefined, locale), almatyDate(data.from, locale),
      t('meetViews.csv.to', undefined, locale), almatyDate(data.to, locale)],
    [],
    header(['meetViews.csv.student', 'meetViews.csv.lessonsWithTalk', 'meetViews.csv.inRoom', 'meetViews.csv.spokeIn',
      'meetViews.csv.silentIn', 'meetViews.csv.totalMin', 'meetViews.csv.avgMin', 'meetViews.csv.shareOfStudentTalk',
      'meetViews.csv.questionsAsked', 'meetViews.csv.questionsAnswered', 'meetViews.csv.byLesson'], locale),
    ...data.students.map((s) => [
      s.name, s.lessons?.length ?? s.lessons_in_room, s.lessons_in_room, s.lessons_spoke, s.silent_lessons,
      minutes(s.total_seconds), minutes(s.avg_seconds), percent(s.share_of_student_talk), blank(s.questions),
      blank(s.answers), (s.lessons ?? []).map((m) => t(STATE_CSV[m.state], undefined, locale)).join(' '),
    ]),
    [],
    header(LESSON_HEADER, locale),
    ...data.lessons.map((l) => lessonCells(l, locale)),
  ]);
}

/** Every teacher, one row each. */
export function teachersCsv(data: TeachersTalk, locale: Locale = activeLocale()): string {
  return csv([
    [t('meetViews.csv.from', undefined, locale), almatyDate(data.from, locale), t('meetViews.csv.to', undefined, locale), almatyDate(data.to, locale)],
    [],
    header(['meetViews.csv.teacher', ...TALLY_HEADER], locale),
    ...data.teachers.map((row) => [row.name, ...tallyCells(row)]),
  ]);
}

/** One teacher: all groups together, each group, each lesson. */
export function teacherTalkCsv(data: TeacherTalk, locale: Locale = activeLocale()): string {
  return csv([
    [t('meetViews.csv.teacher', undefined, locale), data.teacher.name, t('meetViews.csv.from', undefined, locale), almatyDate(data.from, locale),
      t('meetViews.csv.to', undefined, locale), almatyDate(data.to, locale)],
    [],
    ['', ...header(TALLY_HEADER, locale)],
    [t('meetViews.csv.allGroups', undefined, locale), ...tallyCells(data.teacher)],
    ...data.groups.map((g) => [g.name ?? t('meetViews.teacherTalk.noGroup', undefined, locale), ...tallyCells(g)]),
    [],
    header(LESSON_HEADER, locale),
    ...data.lessons.map((l) => lessonCells(l, locale)),
  ]);
}
