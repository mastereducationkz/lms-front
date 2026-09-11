import type { Event } from '../types';

/**
 * The pure half of lesson recordings: how durations, days and lesson names read, and which
 * lessons the calendar's "Recordings" filter keeps. Everything here is deterministic and
 * unit-tested; the components only arrange it.
 *
 * Times are shown in Almaty, like the rest of the calendar — a lesson at 14:00 UTC is a
 * 19:00 lesson to everyone in the school, wherever their laptop thinks it is.
 */

export const ALMATY_TZ = 'Asia/Almaty';

export type Locale = 'en' | 'ru';
export type RecordingFilter = 'all' | 'with' | 'without';

/** "1:03:54" or "45:12" — the badge on a preview, as every video player writes it. */
export function formatClock(seconds?: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "1 h 4 min", "45 min", "1 ч 4 мин" — for sentences, where a clock reads oddly. */
export function formatDurationWords(seconds?: number | null, locale: Locale = 'en'): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const [H, M] = locale === 'ru' ? ['ч', 'мин'] : ['h', 'min'];
  if (h === 0) return `${m} ${M}`;
  return m ? `${h} ${H} ${m} ${M}` : `${h} ${H}`;
}

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ALMATY_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: ALMATY_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

/** The Almaty calendar day of an instant, as "YYYY-MM-DD". */
export function almatyDayKey(iso: string | Date): string {
  return dayKeyFormat.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** "19:00–20:00" in Almaty. */
export function timeRange(startIso: string, endIso: string): string {
  return `${clockFormat.format(new Date(startIso))}–${clockFormat.format(new Date(endIso))}`;
}

function capitalise(text: string): string {
  return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}

/**
 * "Fri, 11 Sep" / "пт, 11 сентября" — a day in a few characters, the year only when it is not
 * this one. The date picker's label and the Today/Yesterday headings both say it this way.
 */
export function shortDate(dayKey: string, now: Date, locale: Locale = 'en'): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  // Only the parts are used, in our own order; en-US because en-GB now abbreviates September "Sept".
  const format = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    timeZone: ALMATY_TZ, weekday: 'short', day: 'numeric', month: locale === 'ru' ? 'long' : 'short',
  });
  const parts = Object.fromEntries(format.formatToParts(noon).map((p) => [p.type, p.value]));
  const year = String(y) === almatyDayKey(now).slice(0, 4) ? '' : ` ${y}`;
  return `${parts.weekday}, ${parts.day} ${parts.month}${year}`;
}

/** "Today · Fri, 11 Sep", "Yesterday · …", else "Monday 7 September" — the year only when it is not this one. */
export function dayHeading(dayKey: string, now: Date, locale: Locale = 'en'): string {
  const today = almatyDayKey(now);
  if (dayKey === today) return `${locale === 'ru' ? 'Сегодня' : 'Today'} · ${shortDate(dayKey, now, locale)}`;
  if (dayKey === almatyDayKey(new Date(now.getTime() - 86_400_000))) {
    return `${locale === 'ru' ? 'Вчера' : 'Yesterday'} · ${shortDate(dayKey, now, locale)}`;
  }
  const [y, m, d] = dayKey.split('-').map(Number);
  // Noon UTC falls on the same calendar day in Almaty (UTC+5), so the date cannot drift.
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const format = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    timeZone: ALMATY_TZ, weekday: 'long', day: 'numeric', month: 'long',
    ...(String(y) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  });
  if (locale === 'ru') return capitalise(format.format(noon));
  // en-GB adds a comma after the weekday only when a year is present; build it from parts
  // so every heading reads the same way.
  const parts = Object.fromEntries(format.formatToParts(noon).map((p) => [p.type, p.value]));
  return [parts.weekday, parts.day, parts.month, parts.year].filter(Boolean).join(' ');
}

export interface DayGroup<T> {
  key: string;
  items: T[];
}

/** Consecutive items grouped by their Almaty day, in the order given (newest first). */
export function groupByDay<T extends { start_datetime: string }>(items: T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  items.forEach((item) => {
    const key = almatyDayKey(item.start_datetime);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  });
  return groups;
}

/** A group name without its trailing " - Teacher" (teacher names are short). */
function withoutTeacher(name: string): string {
  const dash = name.lastIndexOf(' - ');
  return dash !== -1 && name.length - dash - 3 <= 24 ? name.slice(0, dash).trim() : name.trim();
}

/**
 * "July 8 SAT - Gulzada: Lesson 29" → { name: "July 8 SAT", lesson: "Lesson 29" }.
 * The group comes from `groups` when known (a title can be stale after a rename), and the
 * lesson number from the title, which is the only place it lives.
 */
export function splitLessonTitle(
  title: string,
  groups?: { name: string }[] | null,
  locale: Locale = 'en',
): { name: string; lesson: string | null } {
  const match = title.match(/^(.*?):\s*(Lesson\s+\d+.*)$/i);
  const source = groups && groups.length ? groups.map((g) => g.name) : [match ? match[1] : title];
  const name = source.map(withoutTeacher).filter(Boolean).join(', ') || title;
  let lesson = match ? match[2].trim() : null;
  if (lesson && locale === 'ru') lesson = lesson.replace(/^Lesson\b/i, 'Урок');
  return { name, lesson };
}

/**
 * The calendar's "Recordings" filter. It is about lessons, so any other event falls out of
 * both choices. "With" includes a recording still being processed — it has one, it is on its
 * way. "Without" means a lesson that has ended and left nothing to watch; a lesson still ahead
 * is in neither, because it cannot have a recording yet.
 */
export function matchesRecordingFilter(event: Event, filter: RecordingFilter, now: number = Date.now()): boolean {
  if (filter === 'all') return true;
  if (event.event_type !== 'class') return false;
  const status = event.recording?.status;
  const hasOne = status === 'ready' || status === 'pending';
  if (filter === 'with') return hasOne;
  return new Date(event.end_datetime).getTime() < now && !hasOne;
}

/** `?watch=14156` → 14156; anything else → null. */
export function parseWatchParam(params: URLSearchParams): number | null {
  const raw = params.get('watch');
  if (!raw || !/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

/** The app's existing language rule: curators and head curators read Russian. */
export function recordingsLocale(role?: string | null): Locale {
  return role === 'curator' || role === 'head_curator' ? 'ru' : 'en';
}
