// Quick-entry parser for the schedule generator: a schedule as a person types it —
// «пн пт 18:00-19:00 сб вс 19:00-20:30» — into a per-weekday time AND length.
//
// Groups can run a different lesson length on different days, so a bare day→time map is not
// enough; every day carries its own `duration`. `parseScheduleShorthand` never throws on bad
// input — unparseable tokens and days left without a time are collected into `problems` and
// reported, not silently dropped or guessed at.
//
// Ported from crm-master frontend/src/lib/scheduleShorthand.ts (2026-09-16) — keep the two in
// step; do not import across repos.

export type ScheduleDay = { time: string; duration: number };
export type ScheduleConfig = Record<number, ScheduleDay>;
export type ScheduleSlot = { day_of_week: number; time_of_day: string; duration_minutes: number };

/** Bounds the API accepts for a lesson length. */
export const DEFAULT_LESSON_MINUTES = 60;
export const MIN_LESSON_MINUTES = 15;
export const MAX_LESSON_MINUTES = 300;

const DAY_MAP: Record<string, number> = {
  'пн': 0,
  'вт': 1,
  'ср': 2,
  'чт': 3,
  'пт': 4,
  'сб': 5,
  'вс': 6,
  'mon': 0,
  'tue': 1,
  'wed': 2,
  'thu': 3,
  'fri': 4,
  'sat': 5,
  'sun': 6,
};

const DAY_ABBREVS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

// A single time, with a colon/dot for minutes, or a lone «,5»/«.5» meaning a half hour.
const SINGLE_TIME_RE = /^(\d{1,2})(?:[:.](\d{2})|[.,](5))?$/;
// A range: the same single-time grammar on each side of a hyphen (dashes normalized first).
const RANGE_RE = /^(\d{1,2})(?:[:.](\d{2})|[.,](5))?-(\d{1,2})(?:[:.](\d{2})|[.,](5))?$/;
const BARE_HOUR_RE = /^\d{1,2}$/;
const TWO_DIGIT_RE = /^\d{2}$/;

const pad = (n: number): string => String(n).padStart(2, '0');

const minutesFromGroups = (mm: string | undefined, half: string | undefined): number => {
  if (mm !== undefined) return Number(mm);
  if (half !== undefined) return 30;
  return 0;
};

export const normalizeScheduleTime = (raw: string): string => {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const parseScheduleShorthand = (
  text: string,
  current?: ScheduleConfig,
): { config: ScheduleConfig; problems: string[] } => {
  const config: ScheduleConfig = {};
  const problems: string[] = [];
  let currentDays: number[] = [];

  const normalized = text
    .toLowerCase()
    .replace(/[—–]/g, '-')
    // Only a half-hour digit after a comma is a decimal («19-20,5» → «19-20.5»). «18:00,19:00»
    // must NOT collapse into one token — that comma separates two times, and the second one
    // (with no day before it) is reported by the empty-currentDays check below.
    .replace(/(\d),(5)(?!\d)/g, '$1.$2');
  const tokens = normalized.split(/[\s,;]+/).filter(Boolean);

  const applyTime = (hour: number, minute: number, raw: string) => {
    if (hour > 23 || minute > 59) {
      problems.push(`Не понял «${raw}»`);
      currentDays = [];
      return;
    }
    if (currentDays.length === 0) {
      problems.push(`Нет дня для «${raw}»`);
      return;
    }
    const time = `${pad(hour)}:${pad(minute)}`;
    for (const day of currentDays) {
      const duration = current?.[day]?.duration ?? DEFAULT_LESSON_MINUTES;
      config[day] = { time, duration };
    }
    currentDays = [];
  };

  const applyRange = (match: RegExpExecArray, raw: string) => {
    const startHour = Number(match[1]);
    const startMinute = minutesFromGroups(match[2], match[3]);
    const endHour = Number(match[4]);
    const endMinute = minutesFromGroups(match[5], match[6]);

    const startValid = startHour <= 23 && startMinute <= 59;
    // 24 is only meaningful as the end of a range (midnight), and only spelled «24»/«24:00».
    const endValid = endHour <= 24 && endMinute <= 59 && !(endHour === 24 && endMinute !== 0);
    if (!startValid || !endValid) {
      problems.push(`Не понял «${raw}»`);
      currentDays = [];
      return;
    }

    if (currentDays.length === 0) {
      problems.push(`Нет дня для «${raw}»`);
      return;
    }

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    const duration = (((endTotal - startTotal) % 1440) + 1440) % 1440;

    if (duration < MIN_LESSON_MINUTES || duration > MAX_LESSON_MINUTES) {
      problems.push(
        `«${raw}» — длительность должна быть от ${MIN_LESSON_MINUTES} минут до ${MAX_LESSON_MINUTES / 60} часов`,
      );
      currentDays = [];
      return;
    }

    const time = `${pad(startHour)}:${pad(startMinute)}`;
    for (const day of currentDays) config[day] = { time, duration };
    currentDays = [];
  };

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    const dayKey = token.endsWith('.') ? token.slice(0, -1) : token;

    if (DAY_MAP[dayKey] !== undefined) {
      currentDays.push(DAY_MAP[dayKey]);
      index += 1;
      continue;
    }

    // Legacy «20 00»: a lone hour token followed by a strict two-digit minutes token. This
    // takes priority over reading the hour alone as «HH:00» — the next token settles it.
    const nextToken = tokens[index + 1];
    if (BARE_HOUR_RE.test(token) && nextToken !== undefined && TWO_DIGIT_RE.test(nextToken)) {
      applyTime(Number(token), Number(nextToken), `${token} ${nextToken}`);
      index += 2;
      continue;
    }

    const rangeMatch = RANGE_RE.exec(token);
    if (rangeMatch) {
      applyRange(rangeMatch, token);
      index += 1;
      continue;
    }

    const timeMatch = SINGLE_TIME_RE.exec(token);
    if (timeMatch) {
      applyTime(Number(timeMatch[1]), minutesFromGroups(timeMatch[2], timeMatch[3]), token);
      index += 1;
      continue;
    }

    problems.push(`Не понял «${token}»`);
    index += 1;
  }

  if (currentDays.length > 0) {
    problems.push(`Нет времени для: ${currentDays.map((day) => DAY_ABBREVS[day]).join(' ')}`);
  }

  return { config, problems };
};

export const configFromScheduleSlots = (
  slots: { day_of_week: number; time_of_day: string; duration_minutes?: number | null }[],
): ScheduleConfig => {
  const config: ScheduleConfig = {};
  for (const slot of slots) {
    config[slot.day_of_week] = {
      time: normalizeScheduleTime(slot.time_of_day),
      duration: slot.duration_minutes ?? DEFAULT_LESSON_MINUTES,
    };
  }
  return config;
};

// A time the generate API accepts once `normalizeScheduleTime` has padded the hour: «9:05» is
// fine, «24:00», «18:60», «1800» or an empty box are not.
const VALID_TIME_RE = /^(\d{1,2}):([0-5]\d)$/;

/**
 * The weekdays (0 = Monday, ascending) whose typed time is not a real HH:MM. Checked before a
 * save so the dialog can point at the day instead of the API answering 422 — or, worse,
 * `normalizeScheduleTime` quietly clamping «25:00» to «23:00».
 */
export const invalidScheduleTimes = (config: ScheduleConfig): number[] =>
  Object.entries(config)
    .filter(([, value]) => {
      const match = VALID_TIME_RE.exec((value?.time ?? '').trim());
      return !match || Number(match[1]) > 23;
    })
    .map(([day]) => Number(day))
    .sort((left, right) => left - right);

export const scheduleSlotsFromConfig = (config: ScheduleConfig): ScheduleSlot[] =>
  Object.entries(config)
    .map(([day, value]) => ({
      day_of_week: Number(day),
      time_of_day: normalizeScheduleTime(value.time),
      duration_minutes: value.duration,
    }))
    .sort((left, right) => left.day_of_week - right.day_of_week);

/**
 * One keystroke in the quick-entry field: the text read against a fixed BASE, not against the
 * config the previous keystroke produced.
 *
 * The base is the schedule as the dialog opened it, refreshed only by edits in the day rows
 * (never by a shorthand parse). Parsing against the live config lost lengths while typing:
 * «сб вс 19:00-20:3» has no time for Sat/Sun, so they vanished; «19:00-20» brought them back at
 * 60; «19:00» then kept that 60, and the saved 90 was gone for good.
 *
 * `base` is only the length source — it never appears in the result. Retyping the line REPLACES
 * the selected day set with what it parses against `base` (so leaving a day out removes it,
 * matching the CRM editor). A text that yields no day at all leaves `current` untouched, by
 * reference — the field is not a way to blank out or revert whatever schedule is already
 * showing — but its problems are still reported.
 */
export const applyShorthand = (
  text: string,
  base: ScheduleConfig,
  current: ScheduleConfig,
): { config: ScheduleConfig; problems: string[] } => {
  const { config, problems } = parseScheduleShorthand(text, base);
  return { config: Object.keys(config).length > 0 ? config : current, problems };
};
