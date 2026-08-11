import type { Event, EventType } from '../../types';

// Kazakhstan timezone — backend stores UTC, we display/position in Almaty time.
export const ALMATY_TZ = 'Asia/Almaty';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Tiny classNames helper (avoids a hard dependency on the app's cn util). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ALMATY_TZ,
  });
}

/** Minutes since midnight in Almaty time (used for week-view positioning). */
export function minutesInAlmaty(iso: string): number {
  const [h, m] = formatTime(iso).split(':').map(Number);
  return h * 60 + m;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export interface MonthDay {
  date: Date;
  events: Event[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

/** 6-week (42 cell) Monday-first matrix for the month of `anchor`. */
export function buildMonthDays(anchor: Date, events: Event[]): MonthDay[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const dow = firstDay.getDay();
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - (dow === 0 ? 6 : dow - 1));

  const days: MonthDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const d0 = startOfDay(date);
    const dayEvents = events
      .filter((e) => {
        const s = startOfDay(new Date(e.start_datetime));
        const en = startOfDay(new Date(e.end_datetime));
        return d0 >= s && d0 <= en;
      })
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
    const wd = date.getDay();
    days.push({
      date,
      events: dayEvents,
      isCurrentMonth: date.getMonth() === month,
      isToday: isSameDay(date, today),
      isWeekend: wd === 0 || wd === 6,
    });
  }
  return days;
}

/** The 7 Monday-first dates of the week containing `anchor`. */
export function buildWeekDays(anchor: Date): Date[] {
  const dow = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Events that fall on `date` (by local day), sorted by start time. */
export function eventsOnDay(date: Date, events: Event[]): Event[] {
  const d0 = startOfDay(date);
  return events
    .filter((e) => {
      const s = startOfDay(new Date(e.start_datetime));
      const en = startOfDay(new Date(e.end_datetime));
      return d0 >= s && d0 <= en;
    })
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
}

export interface LaidEvent {
  event: Event;
  start: number; // minutes since midnight
  end: number;   // minutes since midnight (>= start + 30)
  col: number;
  ncols: number;
}

/**
 * Assign overlapping events to side-by-side columns so they don't stack on top
 * of each other in the week view. Greedy interval-graph colouring per cluster.
 */
export function layoutDayColumns(dayEvents: Event[]): LaidEvent[] {
  const items: LaidEvent[] = dayEvents
    .map((event) => {
      const start = minutesInAlmaty(event.start_datetime);
      const end = Math.max(minutesInAlmaty(event.end_datetime), start + 30);
      return { event, start, end, col: 0, ncols: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cluster: LaidEvent[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const colEnds: number[] = [];
    cluster.forEach((x) => {
      let placed = false;
      for (let i = 0; i < colEnds.length; i++) {
        if (x.start >= colEnds[i]) {
          x.col = i;
          colEnds[i] = x.end;
          placed = true;
          break;
        }
      }
      if (!placed) {
        x.col = colEnds.length;
        colEnds.push(x.end);
      }
    });
    cluster.forEach((x) => (x.ncols = colEnds.length));
    cluster = [];
    clusterEnd = -1;
  };

  items.forEach((x) => {
    if (cluster.length && x.start >= clusterEnd) flush();
    cluster.push(x);
    clusterEnd = Math.max(clusterEnd, x.end);
  });
  if (cluster.length) flush();

  return items;
}

/** Visible hour window for the week grid, widened to fit all events (clamped 06:00–23:00). */
export function weekTimeWindow(weekEvents: Event[]): { startMin: number; endMin: number } {
  let earliest = 8 * 60;
  let latest = 20 * 60;
  weekEvents.forEach((e) => {
    const s = minutesInAlmaty(e.start_datetime);
    const en = Math.max(minutesInAlmaty(e.end_datetime), s + 30);
    earliest = Math.min(earliest, s);
    latest = Math.max(latest, en);
  });
  const startHour = Math.max(6, Math.floor(earliest / 60));
  const endHour = Math.min(23, Math.max(startHour + 1, Math.ceil(latest / 60)));
  return { startMin: startHour * 60, endMin: endHour * 60 };
}

/** A teacher viewing a lesson now taught by someone else (i.e. they gave it away). */
export function isSubstitutedForTeacher(
  e: Event,
  user: { id?: number | string; role?: string } | null | undefined,
): boolean {
  return (
    user?.role === 'teacher' &&
    !!e.teacher_id &&
    Number(e.teacher_id) !== Number(user.id)
  );
}

/** Per-event-type visual language. Colour encodes the TYPE, not the group. */
export interface TypeStyle {
  label: string;
  dot: string;
  time: string;
  strong: string;
  chipBg: string;
  blockBg: string;
  blockBorder: string;
  ring: string;
}

export const TYPE_STYLES: Record<EventType, TypeStyle> = {
  class: {
    label: 'Class',
    dot: 'bg-blue-500 dark:bg-blue-400',
    time: 'text-blue-600 dark:text-blue-400',
    strong: 'text-blue-700 dark:text-blue-300',
    chipBg: 'bg-blue-50 dark:bg-blue-500/10',
    blockBg: 'bg-blue-50 dark:bg-blue-500/15',
    blockBorder: 'border-blue-200/70 dark:border-blue-500/25',
    ring: 'ring-blue-500/15 dark:ring-blue-400/20',
  },
  weekly_test: {
    label: 'Weekly Test',
    dot: 'bg-amber-500 dark:bg-amber-400',
    time: 'text-amber-600 dark:text-amber-400',
    strong: 'text-amber-700 dark:text-amber-300',
    chipBg: 'bg-amber-50 dark:bg-amber-500/10',
    blockBg: 'bg-amber-50 dark:bg-amber-500/15',
    blockBorder: 'border-amber-200/70 dark:border-amber-500/25',
    ring: 'ring-amber-500/15 dark:ring-amber-400/20',
  },
  webinar: {
    label: 'Webinar',
    dot: 'bg-violet-500 dark:bg-violet-400',
    time: 'text-violet-600 dark:text-violet-400',
    strong: 'text-violet-700 dark:text-violet-300',
    chipBg: 'bg-violet-50 dark:bg-violet-500/10',
    blockBg: 'bg-violet-50 dark:bg-violet-500/15',
    blockBorder: 'border-violet-200/70 dark:border-violet-500/25',
    ring: 'ring-violet-500/15 dark:ring-violet-400/20',
  },
  assignment: {
    label: 'Assignment Deadline',
    dot: 'bg-rose-500 dark:bg-rose-400',
    time: 'text-rose-600 dark:text-rose-400',
    strong: 'text-rose-700 dark:text-rose-300',
    chipBg: 'bg-rose-50 dark:bg-rose-500/10',
    blockBg: 'bg-rose-50 dark:bg-rose-500/15',
    blockBorder: 'border-rose-200/70 dark:border-rose-500/25',
    ring: 'ring-rose-500/15 dark:ring-rose-400/20',
  },
};

export function styleFor(type: EventType): TypeStyle {
  return TYPE_STYLES[type] || TYPE_STYLES.class;
}

export function typeLabel(type: EventType): string {
  return TYPE_STYLES[type]?.label || 'Event';
}

/**
 * Distinct per-group palette for classes, so different groups are easy to tell
 * apart. Amber / violet / rose are deliberately reserved for weekly-test /
 * webinar / assignment, so those special types always read as themselves.
 */
export const GROUP_PALETTE: TypeStyle[] = [
  { label: '', dot: 'bg-blue-500 dark:bg-blue-400', time: 'text-blue-600 dark:text-blue-400', strong: 'text-blue-700 dark:text-blue-300', chipBg: 'bg-blue-50 dark:bg-blue-500/10', blockBg: 'bg-blue-50 dark:bg-blue-500/15', blockBorder: 'border-blue-200/70 dark:border-blue-500/25', ring: 'ring-blue-500/15 dark:ring-blue-400/20' },
  { label: '', dot: 'bg-emerald-500 dark:bg-emerald-400', time: 'text-emerald-600 dark:text-emerald-400', strong: 'text-emerald-700 dark:text-emerald-300', chipBg: 'bg-emerald-50 dark:bg-emerald-500/10', blockBg: 'bg-emerald-50 dark:bg-emerald-500/15', blockBorder: 'border-emerald-200/70 dark:border-emerald-500/25', ring: 'ring-emerald-500/15 dark:ring-emerald-400/20' },
  { label: '', dot: 'bg-cyan-500 dark:bg-cyan-400', time: 'text-cyan-600 dark:text-cyan-400', strong: 'text-cyan-700 dark:text-cyan-300', chipBg: 'bg-cyan-50 dark:bg-cyan-500/10', blockBg: 'bg-cyan-50 dark:bg-cyan-500/15', blockBorder: 'border-cyan-200/70 dark:border-cyan-500/25', ring: 'ring-cyan-500/15 dark:ring-cyan-400/20' },
  { label: '', dot: 'bg-indigo-500 dark:bg-indigo-400', time: 'text-indigo-600 dark:text-indigo-400', strong: 'text-indigo-700 dark:text-indigo-300', chipBg: 'bg-indigo-50 dark:bg-indigo-500/10', blockBg: 'bg-indigo-50 dark:bg-indigo-500/15', blockBorder: 'border-indigo-200/70 dark:border-indigo-500/25', ring: 'ring-indigo-500/15 dark:ring-indigo-400/20' },
  { label: '', dot: 'bg-teal-500 dark:bg-teal-400', time: 'text-teal-600 dark:text-teal-400', strong: 'text-teal-700 dark:text-teal-300', chipBg: 'bg-teal-50 dark:bg-teal-500/10', blockBg: 'bg-teal-50 dark:bg-teal-500/15', blockBorder: 'border-teal-200/70 dark:border-teal-500/25', ring: 'ring-teal-500/15 dark:ring-teal-400/20' },
  { label: '', dot: 'bg-pink-500 dark:bg-pink-400', time: 'text-pink-600 dark:text-pink-400', strong: 'text-pink-700 dark:text-pink-300', chipBg: 'bg-pink-50 dark:bg-pink-500/10', blockBg: 'bg-pink-50 dark:bg-pink-500/15', blockBorder: 'border-pink-200/70 dark:border-pink-500/25', ring: 'ring-pink-500/15 dark:ring-pink-400/20' },
  { label: '', dot: 'bg-sky-500 dark:bg-sky-400', time: 'text-sky-600 dark:text-sky-400', strong: 'text-sky-700 dark:text-sky-300', chipBg: 'bg-sky-50 dark:bg-sky-500/10', blockBg: 'bg-sky-50 dark:bg-sky-500/15', blockBorder: 'border-sky-200/70 dark:border-sky-500/25', ring: 'ring-sky-500/15 dark:ring-sky-400/20' },
  { label: '', dot: 'bg-fuchsia-500 dark:bg-fuchsia-400', time: 'text-fuchsia-600 dark:text-fuchsia-400', strong: 'text-fuchsia-700 dark:text-fuchsia-300', chipBg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', blockBg: 'bg-fuchsia-50 dark:bg-fuchsia-500/15', blockBorder: 'border-fuchsia-200/70 dark:border-fuchsia-500/25', ring: 'ring-fuchsia-500/15 dark:ring-fuchsia-400/20' },
  { label: '', dot: 'bg-lime-500 dark:bg-lime-400', time: 'text-lime-600 dark:text-lime-500', strong: 'text-lime-700 dark:text-lime-300', chipBg: 'bg-lime-50 dark:bg-lime-500/10', blockBg: 'bg-lime-50 dark:bg-lime-500/15', blockBorder: 'border-lime-200/70 dark:border-lime-500/25', ring: 'ring-lime-500/15 dark:ring-lime-400/20' },
  { label: '', dot: 'bg-orange-500 dark:bg-orange-400', time: 'text-orange-600 dark:text-orange-400', strong: 'text-orange-700 dark:text-orange-300', chipBg: 'bg-orange-50 dark:bg-orange-500/10', blockBg: 'bg-orange-50 dark:bg-orange-500/15', blockBorder: 'border-orange-200/70 dark:border-orange-500/25', ring: 'ring-orange-500/15 dark:ring-orange-400/20' },
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function groupSeed(e: Event): string {
  if (e.group_ids && e.group_ids.length) return [...e.group_ids].sort((a, b) => a - b).join(',');
  if (e.groups && e.groups.length) return [...e.groups].sort().join(',');
  return e.title || 'x';
}

/** Colour for an event: classes are coloured per-group; other types keep their semantic colour. */
export function eventStyle(e: Event): TypeStyle {
  if (e.event_type === 'class') {
    return GROUP_PALETTE[stringHash(groupSeed(e)) % GROUP_PALETTE.length];
  }
  return styleFor(e.event_type);
}

/**
 * Display label for a class: just the group, without the noise. Group names /
 * titles here follow "Teacher - Group[: Lesson N]" (e.g. "Шадеева - IELTS June 8
 * 2026: Lesson 34"), so we drop the short teacher prefix and the lesson suffix,
 * leaving "IELTS June 8 2026". Non-class events keep their own title.
 */
export function eventTitle(e: Event): string {
  if (e.event_type !== 'class') return e.title;
  let name = e.groups && e.groups.length ? e.groups.join(', ') : e.title;
  const dash = name.indexOf(' - ');
  if (dash !== -1 && dash <= 24) name = name.slice(dash + 3); // strip "Teacher - "
  name = name.replace(/:\s*Lesson\s+\d+.*$/i, '').trim();     // strip ": Lesson N"
  return name || e.title;
}
