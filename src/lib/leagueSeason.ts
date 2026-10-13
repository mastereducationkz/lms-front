/**
 * The Master League season banner's pure rules (owner, 2026-10-13): which words a phase gets, how
 * a matchday pip reads, the kick-off countdown, the coach's note of the day and the season goals.
 * No React, no requests: tested in leagueSeason.test.ts. The server decides the phase
 * (lms-backend src/master_league) and this file only renders it.
 */
import { almatyCivilDate } from './datetime';
import { activeLocale, formatDate, formatTime, t, type Locale, type MessageKey } from './i18n';
import type { LeagueGoal, LeaguePhase, LeagueLesson, LessonState, MyLeague } from '../services/api/masterLeague';
import '@/lib/i18n/catalogs/studentHome';

/** The six league achievements for playing the season, in the order the banner and the page show them. */
export const LEAGUE_GOAL_KEYS = [
  'ml_signed', 'ml_first_whistle', 'ml_hat_trick', 'ml_full_squad', 'ml_ever_present', 'ml_no_loose_ends',
] as const;

/**
 * The four that come with the mock climb and the official result (phase 2), listed after the six.
 * The banner shows one only once the server lists it, so a front end that ships before its backend
 * never promises a goal nothing can award yet.
 */
export const LEAGUE_RESULT_GOAL_KEYS = ['ml_mock_climb', 'ml_breakthrough', 'ml_1500', 'ml_perfect'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

/** «Dreamville» out of «Master League Dreamville»; a name without the prefix stays as it is. */
export function groupTail(name: string): string {
  const tail = name.replace(/^\s*(master\s*league|мастер\s*лига)[\s:·\-–—]*/i, '').trim();
  return tail || name.trim();
}

/** The matchday the banner names: the lesson running today, else the next one, else the last. */
export function currentMatchday(league: Pick<MyLeague, 'lessons' | 'next_lesson'>): number {
  const today = league.lessons.items.find((i) => i.state === 'today');
  if (today) return today.number;
  if (league.next_lesson) return league.next_lesson.number;
  return Math.max(1, league.lessons.total);
}

export const pipKey = (state: LessonState): MessageKey => `studentHome.league.pip.${state}`;

/** What a screen reader hears for one pip, with the lesson's day for the ones still to come. */
export function pipLabel(item: LeagueLesson, locale: Locale = activeLocale()): string {
  const base = t(pipKey(item.state), { n: item.number }, locale);
  return item.state === 'upcoming' || item.state === 'today' ? `${base} · ${kickoffLabel(item.starts_at, locale)}` : base;
}

/** «14 h 15 min» / «45 min»: how long to a kick-off, to the minute, never below one minute. */
export function formatCountdown(ms: number, locale: Locale = activeLocale()): string {
  const minutes = Math.max(1, Math.ceil(ms / MIN_MS));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const unit = (k: 'h' | 'min') => t(`studentHome.league.unit.${k}`, undefined, locale);
  // Non-breaking spaces: «5 h 20 min» must never wrap in the middle of a number and its unit.
  const NB = '\u00a0';
  if (h <= 0) return `${m}${NB}${unit('min')}`;
  return m === 0 ? `${h}${NB}${unit('h')}` : `${h}${NB}${unit('h')} ${m}${NB}${unit('min')}`;
}

/** «Wed 14 Oct, 18:00» on the school's clock. */
export function kickoffLabel(startsAt: string, locale: Locale = activeLocale()): string {
  return `${formatDate(startsAt, { weekday: 'short', day: 'numeric', month: 'short' }, locale)}, ${formatTime(startsAt, undefined, locale)}`;
}

/**
 * The kick-off line: a live countdown inside the last 24 hours, the day and time beyond that, and
 * «last matchday played» once the lessons run out. A lesson that has already started shows its
 * time instead of a negative countdown.
 */
export function kickoffLine(league: Pick<MyLeague, 'next_lesson'>, now: number, locale: Locale = activeLocale()): string {
  const next = league.next_lesson;
  if (!next) return t('studentHome.league.lastMatchday', undefined, locale);
  const start = Date.parse(next.starts_at);
  if (Number.isFinite(start) && start > now && start - now < DAY_MS) {
    return t('studentHome.league.kickoffIn', { time: formatCountdown(start - now, locale) }, locale);
  }
  return t('studentHome.league.nextKickoff', { when: kickoffLabel(next.starts_at, locale) }, locale);
}

/** Does the banner need a ticking clock (a kick-off inside the last 24 hours)? */
export function needsTicker(league: Pick<MyLeague, 'next_lesson'>, now: number): boolean {
  const next = league.next_lesson;
  if (!next) return false;
  const start = Date.parse(next.starts_at);
  return Number.isFinite(start) && start > now && start - now < DAY_MS + HOUR_MS;
}

/** Whole days from the Almaty date of `now` to a YYYY-MM-DD date (0 on the day itself). */
export function daysUntil(ymd: string | null, now: number): number | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  const today = almatyCivilDate(new Date(now));
  const from = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - from) / DAY_MS);
}

const PHASE_KEY: Record<Exclude<LeaguePhase, 'over'>, string> = {
  warmup: 'warmup', season: 'season', final_week: 'finalWeek', eve: 'eve', exam_day: 'examDay', after: 'after',
};

export interface PhaseCopy {
  title: string;
  sub: string;
  /** The key the coach's notes hang off (studentHome.league.note.<key>.1…3). */
  noteKey: string;
  /** The next kick-off, as its own line, in the phases whose sentence does not already carry it. */
  kickoff: string | null;
}

/** The headline and the line under it for the season's phase, in the reader's language. */
export function phaseCopy(league: MyLeague, now: number, locale: Locale = activeLocale()): PhaseCopy {
  const phase = league.phase === 'over' ? 'after' : league.phase;
  const key = PHASE_KEY[phase];
  const tr = (id: string, params?: Record<string, string | number>) => t(`studentHome.league.${id}` as MessageKey, params, locale);
  if (phase === 'season') {
    const days = league.days_to_exam;
    const left = days != null && days >= 0 ? tr('daysToFinal', { count: days }) : null;
    const sub = [left, kickoffLine(league, now, locale)].filter(Boolean).join(' · ');
    return { title: tr('phase.season.title', { n: currentMatchday(league), total: league.lessons.total }), sub, noteKey: key, kickoff: null };
  }
  if (phase === 'final_week') {
    const days = Math.max(0, league.days_to_exam ?? 0);
    const kickoff = league.next_lesson ? kickoffLine(league, now, locale) : null;
    return { title: tr('phase.finalWeek.title'), sub: tr('phase.finalWeek.sub', { count: days }), noteKey: key, kickoff };
  }
  if (phase === 'after') {
    const left = daysUntil(league.result_due, now);
    const sub = left == null || left <= 0 ? tr('phase.after.subToday') : tr('phase.after.sub', { count: left });
    return { title: tr('phase.after.title'), sub, noteKey: key, kickoff: null };
  }
  const kickoff = phase === 'warmup' && league.next_lesson ? kickoffLine(league, now, locale) : null;
  return { title: tr(`phase.${key}.title`), sub: tr(`phase.${key}.sub`), noteKey: key, kickoff };
}

/** A small stable hash of the day, so the coach's note changes daily and is the same for the whole day. */
export function dayIndex(now: number, userId: number | string): number {
  const d = almatyCivilDate(new Date(now));
  const who = typeof userId === 'number' ? userId : Number.parseInt(userId, 10) || 0;
  return Math.abs(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate() + who);
}

/** The coach's note for today: one of three per phase, stable through the day. */
export function coachNote(noteKey: string, now: number, userId: number | string, locale: Locale = activeLocale()): string {
  const n = (dayIndex(now, userId) % 3) + 1;
  return t(`studentHome.league.note.${noteKey}.${n}` as MessageKey, undefined, locale);
}

export interface GoalView {
  key: string;
  title: string;
  unlocked: boolean;
  progress: { current: number; target: number } | null;
}

/** The season goals in a fixed order; one of the six the server did not send shows as not done yet. */
export function goalViews(goals: LeagueGoal[], locale: Locale = activeLocale()): GoalView[] {
  const listed = LEAGUE_RESULT_GOAL_KEYS.filter((key) => goals.some((g) => g.key === key));
  return [...LEAGUE_GOAL_KEYS, ...listed].map((key) => {
    const g = goals.find((x) => x.key === key);
    return {
      key,
      title: t(`studentHome.achievement.${key}.title` as MessageKey, undefined, locale),
      unlocked: g?.unlocked === true,
      progress: g?.progress ?? null,
    };
  });
}

/** «87%» or «—» while nothing has been marked. */
export function attendanceText(a: MyLeague['attendance'], locale: Locale = activeLocale()): string {
  return a.marked > 0 ? `${Math.round(a.percent)}%` : t('studentHome.league.stat.none', undefined, locale);
}

/** «3/3», or «—» while no homework has come due. */
export function homeworkText(h: MyLeague['homework'], locale: Locale = activeLocale()): string {
  return h.due > 0 ? `${h.on_time}/${h.due}` : t('studentHome.league.stat.none', undefined, locale);
}
