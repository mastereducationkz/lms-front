import { APP_TIMEZONE, parseAsUTC } from './datetime';
import type { LessonSection } from './lessonLinks';
import type {
  LessonLocale, LessonStatus, LessonView, LessonViewer, RegisterStudent, UiMark,
} from '../services/api/classLessons';
import type { Event } from '../types';

/**
 * `/lessons/:id` (owner, 2026-09-28): the rules the page follows, kept apart from the components so
 * they are tested — which sections a viewer sees and in what order, when «Войти» opens, what a
 * register save sends, and the one-line summary of a register.
 */

/** Sections the page can show. `live` (the room right now) and `me` (a student's own mark) have no
 *  deep link of their own; the others are the anchors `lessonLinks` writes. */
export type PageSection = LessonSection | 'live' | 'me' | 'activities';

interface SectionFlags {
  viewer: Pick<LessonViewer, 'is_staff' | 'is_student' | 'can_view_meet'>;
  hasRegister: boolean;
  hasMe: boolean;
  hasLive: boolean;
  hasRequests: boolean;
  /** The lesson has a recording (in any state) — otherwise no «Запись» section or chip. */
  hasRecording: boolean;
  /** Meet has something to say about the lesson (held in an LMS room and started). */
  hasMeet: boolean;
  /** Live-lesson activities this viewer would find listed (all of them for staff, own answers for a student). */
  hasActivities?: boolean;
  /** This viewer may run live activities now (the switch, the lesson's teacher, its time window). */
  canDriveLive?: boolean;
}

/**
 * The page reads top to bottom in the order that matters now: before a lesson, what to bring to it;
 * while it runs, who is in the room; after it, the recording and the register. A cancelled lesson
 * keeps its materials and requests visible (materials may have moved to the make-up lesson).
 */
export function sectionOrder(status: LessonStatus, flags: SectionFlags): PageSection[] {
  const { viewer } = flags;
  const staff = viewer.is_staff;
  const order: Record<LessonStatus, PageSection[]> = {
    upcoming: ['activities', 'materials', 'homework', 'notes', 'requests'],
    live: ['live', 'activities', 'materials', 'notes', 'register', 'homework', 'requests'],
    finished: ['me', 'recording', 'activities', 'register', 'notes', 'homework', 'meet', 'materials', 'requests'],
    cancelled: ['materials', 'notes', 'requests'],
  };
  return order[status].filter((key) => {
    switch (key) {
      case 'live': return staff && flags.hasLive;
      case 'register': return staff && flags.hasRegister;
      case 'meet': return staff && viewer.can_view_meet && flags.hasMeet;
      case 'recording': return flags.hasRecording;
      case 'requests': return staff && flags.hasRequests;
      case 'me': return viewer.is_student && flags.hasMe;
      case 'activities': return Boolean(flags.canDriveLive || flags.hasActivities);
      default: return true;
    }
  });
}

/** Chip labels, per locale. */
export const SECTION_LABELS: Record<PageSection, [string, string]> = {
  live: ['Сейчас в уроке', 'In the room'],
  me: ['Моя отметка', 'My mark'],
  activities: ['Активности', 'Activities'],
  materials: ['Материалы', 'Materials'],
  recording: ['Запись', 'Recording'],
  register: ['Посещаемость', 'Attendance'],
  homework: ['Домашнее задание', 'Homework'],
  notes: ['Заметки', 'Notes'],
  meet: ['Meet', 'Meet'],
  requests: ['Заявки', 'Requests'],
};

export type JoinState =
  | { kind: 'hidden' }
  | { kind: 'soon'; opensAt: Date }
  | { kind: 'open' };

/** «Войти»: shown until the lesson ends, enabled from `opens_at` (ten minutes before the start). */
export function joinState(view: Pick<LessonView, 'status' | 'join' | 'end'>, now: Date = new Date()): JoinState {
  if (!view.join.url || view.status === 'cancelled' || view.status === 'finished') return { kind: 'hidden' };
  if (parseAsUTC(view.end).getTime() <= now.getTime()) return { kind: 'hidden' };
  const opensAt = view.join.opens_at ? parseAsUTC(view.join.opens_at) : null;
  if (opensAt && opensAt.getTime() > now.getTime()) return { kind: 'soon', opensAt };
  return { kind: 'open' };
}

/** A register row a person may change: marks only while the viewer may mark and the journal would
 *  let them (frozen / no-access cells never change; a cancelled or removed student is not in play). */
export function markEditable(student: RegisterStudent, canMark: boolean): boolean {
  return canMark && student.state === null && student.status !== 'cancelled' && student.status !== 'removed';
}

/** A score can sit on a student who came, or one Meet has not marked yet — never on an absence. */
export function scoreEditable(student: RegisterStudent, status: UiMark, canScore: boolean): boolean {
  return canScore && student.state === null && (status === 'attended' || status === 'late' || status === 'registered');
}

export interface RegisterDraft {
  status: Map<number, UiMark>;
  score: Map<number, number>;
}

export interface RegisterChanges {
  marks: { student_id: number; status: UiMark }[];
  scores: { student_id: number; activity_score: number }[];
}

/**
 * What «Сохранить» sends: marks that differ from what was loaded, and scores that differ — minus a
 * score for a student this save marks absent (the server refuses the pair, and so would the reader).
 */
export function registerChanges(students: RegisterStudent[], draft: RegisterDraft): RegisterChanges {
  const marks: RegisterChanges['marks'] = [];
  const scores: RegisterChanges['scores'] = [];
  for (const s of students) {
    const status = draft.status.get(s.user_id) ?? s.status;
    if (status !== s.status && (status === 'attended' || status === 'late' || status === 'missed')) {
      marks.push({ student_id: s.user_id, status });
    }
    const score = draft.score.get(s.user_id);
    if (score != null && score !== s.activity_score && status !== 'missed') {
      scores.push({ student_id: s.user_id, activity_score: score });
    }
  }
  return { marks, scores };
}

export interface RegisterSummary {
  present: number;
  late: number;
  absent: number;
  unmarked: number;
  scored: number;
  /** Students who came (present or late) — the denominator for scores. */
  attended: number;
}

/** «Был 10 · Опоздал 1 · Не был 2 · баллы 9/11» — counted over what the page shows now. */
export function registerSummary(students: { status: UiMark; activity_score: number | null; state?: string | null }[]): RegisterSummary {
  const out: RegisterSummary = { present: 0, late: 0, absent: 0, unmarked: 0, scored: 0, attended: 0 };
  for (const s of students) {
    if (s.state) continue;
    if (s.status === 'attended') out.present += 1;
    else if (s.status === 'late') out.late += 1;
    else if (s.status === 'missed') out.absent += 1;
    else if (s.status === 'registered') out.unmarked += 1;
    if (s.status === 'attended' || s.status === 'late') {
      out.attended += 1;
      if (s.activity_score != null) out.scored += 1;
    }
  }
  return out;
}

export function summaryLine(summary: RegisterSummary, locale: LessonLocale): string {
  const ru = locale === 'ru';
  const parts = [
    `${ru ? 'Был' : 'Present'} ${summary.present}`,
    `${ru ? 'Опоздал' : 'Late'} ${summary.late}`,
    `${ru ? 'Не был' : 'Absent'} ${summary.absent}`,
  ];
  if (summary.unmarked) parts.push(`${ru ? 'Не отмечено' : 'Not marked'} ${summary.unmarked}`);
  parts.push(`${ru ? 'баллы' : 'scores'} ${summary.scored}/${summary.attended}`);
  return parts.join(' · ');
}

/** YYYY-MM-DD of an instant, on the school's calendar. */
export function almatyDay(iso: string): string {
  return parseAsUTC(iso).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

/**
 * «Все уроки группы»: the journal at the week of this lesson. Teachers and heads keep it under
 * /attendance, curators under /curator/leaderboard; students have no journal.
 */
export function journalUrl(role: string, groupId: number, start: string): string | null {
  const query = `?groupId=${groupId}&date=${almatyDay(start)}`;
  if (role === 'curator') return `/curator/leaderboard${query}`;
  if (['teacher', 'admin', 'head_teacher', 'head_curator'].includes(role)) return `/attendance${query}`;
  return null;
}

/** The anchor a link asked for (`#materials`), if the page knows it. */
export function sectionFromHash(hash: string): PageSection | null {
  const key = hash.replace(/^#/, '') as PageSection;
  return key in SECTION_LABELS ? key : null;
}

/** The calendar's `Event` shape, for the sections the lesson card already had (recording, Meet). */
export function asCalendarEvent(view: LessonView): Event {
  return {
    id: view.id,
    title: view.title,
    event_type: 'class',
    start_datetime: view.start,
    end_datetime: view.end,
    is_online: true,
    meeting_url: view.join.url ?? undefined,
    created_by: 0,
    is_active: view.status !== 'cancelled',
    is_recurring: false,
    participant_count: 0,
    is_substitution: view.is_substitution,
    groups: view.groups.map((g) => g.name),
    group_ids: view.groups.map((g) => g.id),
    teacher_id: view.teacher?.id,
    teacher_name: view.teacher?.name,
  };
}

/** «пн, 28 сент., 18:00–19:00» / «Mon, 28 Sep, 18:00–19:00», on the school's clock. */
export function lessonWhen(start: string, end: string, locale: LessonLocale): string {
  const tag = locale === 'ru' ? 'ru-RU' : 'en-GB';
  const day = parseAsUTC(start).toLocaleDateString(tag, { timeZone: APP_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short' });
  const clock = (iso: string) => parseAsUTC(iso).toLocaleTimeString(tag, { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' });
  return `${day}, ${clock(start)}–${clock(end)}`;
}

/** «HH:MM» on the school's clock. */
export function clockKz(iso: string | Date, locale: LessonLocale): string {
  const date = typeof iso === 'string' ? parseAsUTC(iso) : iso;
  return date.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-GB', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' });
}

/** «28 сент., 18:05» — a note's or a request's time. */
export function stampKz(iso: string, locale: LessonLocale): string {
  const tag = locale === 'ru' ? 'ru-RU' : 'en-GB';
  return parseAsUTC(iso).toLocaleString(tag, { timeZone: APP_TIMEZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const NOTE_LIMIT = 3000;
