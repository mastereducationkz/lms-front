/**
 * Pure helpers for the header star pill's breakdown (GET /gamification/breakdown).
 * "Stars" is the student-facing name for activity points; this UI never says "points".
 */
import '@/lib/i18n/catalogs/stars';
import '@/lib/i18n/catalogs/studentHome';
import { activeLocale, formatNumber, hasMessage, t, type Locale } from '@/lib/i18n';
import type { StarRule, StarsBreakdown, StarSource, StarStreak } from '../services/api/gamification';

/** A bar's length as a share of the largest bar, so the biggest source spans the track. */
export function barPercent(stars: number, sources: StarSource[]): number {
  const max = Math.max(0, ...sources.map((s) => s.stars));
  if (stars <= 0 || max <= 0) return 0;
  return Math.min(100, (stars / max) * 100);
}

/** A brand-new student: nothing earned yet, so the dropdown teaches instead of charting zeros. */
export function isEmptyBreakdown(data: StarsBreakdown): boolean {
  return data.total === 0 && !data.earlier && data.sources.every((s) => s.stars === 0);
}

/** "+10" for a fixed amount, "+10–50" for a range. */
export function starRange(min: number, max: number): string {
  return min === max ? `+${min}` : `+${min}–${max}`;
}

const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1 } as const;

function decimal(value: number): string {
  return formatNumber(value, ONE_DECIMAL);
}

export function formatMultiplier(value: number): string {
  return `×${decimal(value)}`;
}

/**
 * The streak panel: where the student stands, when the bonus next grows (or that it is at its
 * cap), and the rule itself. The bonus is baked into every award but a teacher's, so it explains
 * the bars rather than being one.
 */
export function streakCopy(streak: StarStreak): { title: string; status: string; rule: string } {
  const rule = t('stars.streak.rule', {
    start: decimal(streak.start_multiplier),
    startDays: streak.starts_at_days,
    step: decimal(streak.step),
    stepDays: streak.step_days,
    max: decimal(streak.max_multiplier),
  });
  const next = streak.next_multiplier !== null ? decimal(streak.next_multiplier) : '';
  const more = streak.next_at_days !== null
    ? t('stars.streak.moreDays', { count: streak.next_at_days - streak.days })
    : '';
  if (streak.days >= streak.starts_at_days) {
    const params = { days: streak.days, multiplier: decimal(streak.multiplier), more, next };
    return {
      title: t('stars.streak.titleWith', { multiplier: decimal(streak.multiplier) }),
      status: streak.next_at_days === null ? t('stars.streak.atMax', params) : t('stars.streak.active', params),
      rule,
    };
  }
  return {
    title: t('stars.streak.title'),
    status: streak.days > 0
      ? t('stars.streak.building', { days: streak.days, more, next })
      : t('stars.streak.notStarted', { count: streak.starts_at_days, next }),
    rule,
  };
}

/** What an `earlier` remainder is called: stars the ledger doesn't explain, or a correction. */
export function earlierLabel(earlier: number, locale: Locale = activeLocale()): string {
  return t(earlier > 0 ? 'studentHome.stars.earlier' : 'studentHome.stars.corrections', undefined, locale);
}

/**
 * The server names its bars and rules in English (lms-backend src/gamification/routes/breakdown.py).
 * English shows the server's words as they are; another language takes the catalog's by key, and
 * keeps the server's for a key the catalog doesn't know yet.
 */
export function sourceLabel(source: Pick<StarSource, 'key' | 'label'>, locale: Locale = activeLocale()): string {
  const key = `studentHome.stars.source.${source.key}`;
  return locale !== 'en' && hasMessage(key) ? t(key, undefined, locale) : source.label;
}

export function ruleCopy(rule: StarRule, locale: Locale = activeLocale()): { label: string; note: string } {
  const label = `studentHome.stars.rule.${rule.key}.label`;
  const note = `studentHome.stars.rule.${rule.key}.note`;
  if (locale === 'en' || !hasMessage(label) || !hasMessage(note)) return { label: rule.label, note: rule.note };
  // The two notes with numbers: the grade's base + score bonus (min/max), the teacher's weekly budget (in the note).
  const weekly = Number(/\d+/.exec(rule.note)?.[0]);
  if (rule.key === 'teacher_bonus' && !Number.isFinite(weekly)) return { label: t(label, undefined, locale), note: rule.note };
  return {
    label: t(label, undefined, locale),
    note: t(note, { base: rule.min, bonus: rule.max - rule.min, count: weekly }, locale),
  };
}
