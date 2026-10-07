// What pressing «Generate» in the schedule generator would do, in words — the body of
// `POST /leaderboard/curator/schedule/preview`, which takes the same payload as the save and
// writes nothing.
//
// Changing a group's schedule moves, resizes, creates and switches off lessons in one go, and a
// curator used to see the result only afterwards, on the calendar. These helpers turn the
// preview into the lines the dialog shows before the button is pressed, in the viewer's language.
// Every date is read as a UTC instant (an offset-less server string included) and shown in Almaty
// time by lib/i18n's formatters — never the viewer's own zone.
//
// Ported from crm-master frontend/src/lib/schedulePreview.ts (2026-09-17) — keep the two in
// step; do not import across repos.

import { activeLocale, formatDate, t, type Locale, type MessageKey } from './i18n';
import {
  MAX_LESSON_MINUTES,
  MIN_LESSON_MINUTES,
  invalidScheduleTimes,
  scheduleSlotsFromConfig,
  type ScheduleConfig,
  type ScheduleSlot,
} from './scheduleShorthand';

export type SchedulePreviewChange = 'keep' | 'move' | 'resize' | 'create';

export interface SchedulePreviewLesson {
  start: string;
  end: string;
  minutes: number;
  event_id: number | null;
  change: SchedulePreviewChange;
  previous_start: string | null;
  previous_end: string | null;
}

export interface SchedulePreview {
  started_lessons: number;
  started_minutes: number;
  planned_lessons: number;
  planned_minutes: number;
  total_lessons: number;
  total_minutes: number;
  first_start: string | null;
  last_end: string | null;
  lessons: SchedulePreviewLesson[];
  deactivated: { event_id: number; start: string; end: string }[];
  warnings: string[];
}

/** The generate body — what the preview is asked about. */
export interface SchedulePreviewPayload {
  group_id: number;
  start_date: string;
  lessons_count: number;
  schedule_items: ScheduleSlot[];
}

/** The largest «Кол-во уроков» the API accepts. */
export const MAX_LESSONS_COUNT = 500;

const CHANGE_TAGS: Record<SchedulePreviewChange, MessageKey | null> = {
  keep: null,
  move: 'schedule.preview.tag.move',
  resize: 'schedule.preview.tag.resize',
  create: 'schedule.preview.tag.create',
};

/** The small tag beside a planned date; an untouched lesson gets none. */
export function previewChangeTag(change: SchedulePreviewChange, locale: Locale = activeLocale()): string | null {
  const key = CHANGE_TAGS[change];
  return key ? t(key, undefined, locale) : null;
}

/** Past this many, the switched-off dates end in «…» — the count beside them stays exact. */
const MAX_LISTED_DEACTIVATED = 5;

const dayMonth = (iso: string | null | undefined, locale: Locale): string =>
  formatDate(iso, { day: '2-digit', month: '2-digit' }, locale);

const clock = (iso: string, locale: Locale): string =>
  formatDate(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, locale);

/** «14 h», «22 h 30 min», «45 min» (ru: «14 ч», «22 ч 30 мин», «45 мин»). */
export const formatHoursTotal = (minutes: number, locale: Locale = activeLocale()): string => {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours && rest) return t('schedule.length.minutes', { minutes: rest }, locale);
  if (!rest) return t('schedule.length.hours', { hours }, locale);
  return t('schedule.length.hoursMinutes', { hours, minutes: rest }, locale);
};

const counted = (lessons: number, minutes: number, locale: Locale): string =>
  `${t('common.lessons', { count: lessons }, locale)} · ${formatHoursTotal(minutes, locale)}`;

export function previewSummary(preview: SchedulePreview, locale: Locale = activeLocale()): {
  started: string;
  planned: string;
  total: string;
  changes: string;
} {
  const from = dayMonth(preview.first_start, locale);
  const to = dayMonth(preview.last_end, locale);
  const range = from && to ? ` · ${from}–${to}` : '';

  const count = (change: SchedulePreviewChange) => preview.lessons.filter((lesson) => lesson.change === change).length;

  const offDates = preview.deactivated.slice(0, MAX_LISTED_DEACTIVATED).map((item) => dayMonth(item.start, locale));
  if (preview.deactivated.length > MAX_LISTED_DEACTIVATED) offDates.push('…');
  const offList = offDates.length > 0 ? ` (${offDates.join(', ')})` : '';

  return {
    started: t('schedule.preview.started', { amount: counted(preview.started_lessons, preview.started_minutes, locale) }, locale),
    planned: t('schedule.preview.planned', { amount: counted(preview.planned_lessons, preview.planned_minutes, locale), range }, locale),
    total: t('schedule.preview.total', { amount: counted(preview.total_lessons, preview.total_minutes, locale) }, locale),
    changes: t('schedule.preview.changes', {
      moved: count('move'),
      resized: count('resize'),
      created: count('create'),
      off: preview.deactivated.length,
      offDates: offList,
    }, locale),
  };
}

/** «Fri 18/09 18:00–19:00» (ru: «пт 18.09 18:00–19:00») — one planned lesson, in Almaty time. */
export function formatPreviewLessonRow(start: string, end: string, locale: Locale = activeLocale()): string {
  const weekday = formatDate(start, { weekday: 'short' }, locale);
  return `${weekday} ${dayMonth(start, locale)} ${clock(start, locale)}–${clock(end, locale)}`.trim();
}

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isCalendarDay = (value: string): boolean => {
  const match = ISO_DAY_RE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/**
 * The body to preview, or `null` while the form is not something «Generate» could save — no
 * group, no day, a time or length the API refuses, a count outside 1–500, or no real start
 * date. `null` means no request and no panel: a preview of a form the API would answer 422 is
 * noise.
 */
export function schedulePreviewPayload(form: {
  groupId: number | null;
  startDate: string;
  lessonsCount: number;
  config: ScheduleConfig;
}): SchedulePreviewPayload | null {
  if (!form.groupId || !Number.isInteger(form.groupId) || form.groupId < 1) return null;
  if (!isCalendarDay(form.startDate)) return null;
  if (!Number.isInteger(form.lessonsCount) || form.lessonsCount < 1 || form.lessonsCount > MAX_LESSONS_COUNT) {
    return null;
  }
  const items = scheduleSlotsFromConfig(form.config);
  if (items.length === 0 || invalidScheduleTimes(form.config).length > 0) return null;
  const lengthRefused = items.some(
    (item) =>
      !Number.isInteger(item.duration_minutes) ||
      item.duration_minutes < MIN_LESSON_MINUTES ||
      item.duration_minutes > MAX_LESSON_MINUTES,
  );
  if (lengthRefused) return null;
  return {
    group_id: form.groupId,
    start_date: form.startDate,
    lessons_count: form.lessonsCount,
    schedule_items: items,
  };
}
