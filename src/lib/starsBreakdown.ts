/**
 * Pure helpers for the header star pill's breakdown (GET /gamification/breakdown).
 * "Stars" is the student-facing name for activity points; this UI never says "points".
 */
import '@/lib/i18n/catalogs/stars';
import { formatNumber, t } from '@/lib/i18n';
import type { StarsBreakdown, StarSource, StarStreak } from '../services/api/gamification';

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
export function earlierLabel(earlier: number): string {
  return earlier > 0 ? 'Earlier stars' : 'Corrections';
}
