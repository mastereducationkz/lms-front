import { APP_TIMEZONE } from './datetime';
import { clock } from './meetAttendance';
import type { MeetLessonSummary } from '../services/api/meetAttendance';
import type {
  GroupTalk,
  PublicTalk,
  TalkPerson,
  TalkRecord,
  TranscriptLine,
} from '../services/api/meetTalk';

export type TalkLocale = 'en' | 'ru';

const pad = (n: number) => String(n).padStart(2, '0');

/** "45 s", "12 min", "1 h 05 min" (ru: «45 с», «12 мин», «1 ч 05 мин»). */
export function formatDuration(seconds: number | null | undefined, locale: TalkLocale = 'en'): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  const [sec, min, hr] = locale === 'ru' ? ['с', 'мин', 'ч'] : ['s', 'min', 'h'];
  if (s < 60) return `${s} ${sec}`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} ${min}`;
  return `${Math.floor(m / 60)} ${hr} ${pad(m % 60)} ${min}`;
}

/** A transcript stamp: "7:05", "1:02:09"; before the lesson start, "-0:45". */
export function stamp(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const s = Math.floor(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${sign}${h}:${pad(m)}:${pad(s % 60)}` : `${sign}${m}:${pad(s % 60)}`;
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
function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const one = lower.length === ch.length ? lower : ch;
    out += one === 'ё' ? 'е' : one;
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

// ── summaries ────────────────────────────────────────────────────────────────────────────

/** Lessons whose list entry says some student in the room never spoke. */
export function silentCount(item: Pick<MeetLessonSummary, 'talk'>): number {
  return item.talk?.silent.length ?? 0;
}

/** "Teacher 72% · students 28% · 3 didn't speak" — the lesson card's one line. */
export function talkSummaryLine(talk: Pick<TalkRecord, 'teacher_share' | 'students_share' | 'silent_students'>, locale: TalkLocale = 'en'): string {
  const silent = talk.silent_students?.length ?? 0;
  if (locale === 'ru') {
    return [
      `Преподаватель ${percent(talk.teacher_share)}`,
      `ученики ${percent(talk.students_share)}`,
      silent ? `${silent} не ${silent === 1 ? 'говорил' : 'говорили'}` : null,
    ].filter(Boolean).join(' · ');
  }
  return [
    `Teacher ${percent(talk.teacher_share)}`,
    `students ${percent(talk.students_share)}`,
    silent ? `${silent} didn’t speak` : null,
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
export function spokeNote(seconds: number | undefined, locale: TalkLocale): string | null {
  if (seconds === undefined) return null;
  if (seconds <= 0) return locale === 'ru' ? 'В Meet не говорил' : 'Didn’t speak in Meet';
  return locale === 'ru' ? `Говорил ${formatDuration(seconds, 'ru')} в Meet` : `Spoke ${formatDuration(seconds)} in Meet`;
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
  const lessonSeconds = Math.max(60, (new Date(lesson.end).getTime() - new Date(lesson.start).getTime()) / 1000);
  return {
    event_id: 0,
    title: lesson.title,
    start: lesson.start,
    end: lesson.end,
    state: talk.state,
    enabled: true,
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
  };
}

// ── the group's table ────────────────────────────────────────────────────────────────────

export type GroupStudentSort =
  | 'name' | 'lessons_in_room' | 'lessons_spoke' | 'silent_lessons' | 'total_seconds' | 'avg_seconds'
  | 'share_of_student_talk' | 'questions';

/** The students' rows in the chosen order; ties (and missing questions) fall back to the name. */
export function sortGroupStudents(rows: GroupTalk['students'], key: GroupStudentSort, direction: 'asc' | 'desc'): GroupTalk['students'] {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'name') return sign * byName(a, b);
    const x = a[key] ?? -1;
    const y = b[key] ?? -1;
    return x === y ? byName(a, b) : sign * (x - y);
  });
}

// ── the group's spreadsheet ──────────────────────────────────────────────────────────────

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const minutes = (seconds: number) => (seconds / 60).toFixed(1);

function almatyDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: APP_TIMEZONE });
}

/**
 * A group's talk time as a spreadsheet: the students, then the lessons. UTF-8 with a BOM so
 * Excel keeps Cyrillic names; dates and times are Almaty; durations in minutes.
 */
export function groupTalkCsv(data: GroupTalk): string {
  const rows: (string | number)[][] = [
    ['Group', data.group.name, 'From', almatyDate(data.from), 'To', almatyDate(data.to)],
    [],
    ['Student', 'Lessons in the room', 'Lessons spoke', 'Lessons silent', 'Total (min)', 'Average per lesson (min)',
      'Share of student talk', 'Questions'],
    ...data.students.map((s) => [
      s.name, s.lessons_in_room, s.lessons_spoke, s.silent_lessons, minutes(s.total_seconds), minutes(s.avg_seconds),
      percent(s.share_of_student_talk), s.questions ?? '',
    ]),
    [],
    ['Date', 'Start', 'Lesson', 'Teacher', 'Teacher share', 'Students share', 'Speech (min)', 'Students in the room',
      'Didn’t speak'],
    ...data.lessons.map((l) => [
      almatyDate(l.start), clock(l.start), l.title, l.teacher_name ?? '', percent(l.teacher_share),
      percent(l.students_share), minutes(l.speech_seconds), l.students_in_room, l.silent,
    ]),
  ];
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
