/**
 * Pure helpers for the header star pill's breakdown (GET /gamification/breakdown).
 * "Stars" is the student-facing name for activity points; this UI never says "points".
 */
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

export function formatMultiplier(value: number): string {
  return `×${value.toFixed(1)}`;
}

function moreDays(n: number): string {
  return n === 1 ? '1 more day' : `${n} more days`;
}

/**
 * The streak panel: where the student stands, when the bonus next grows, and the rule itself.
 * The bonus is baked into every award, so it explains the bars rather than being one.
 */
export function streakCopy(streak: StarStreak): { title: string; status: string; rule: string } {
  const rule =
    `${formatMultiplier(streak.start_multiplier)} from a ${streak.starts_at_days}-day streak, ` +
    `then +${streak.step.toFixed(1)} for every ${streak.step_days} more days. ` +
    'It is added to each award as you earn it.';
  const toGo = moreDays(streak.next_at_days - streak.days);
  const next = formatMultiplier(streak.next_multiplier);
  if (streak.days >= streak.starts_at_days) {
    return {
      title: `Streak bonus ${formatMultiplier(streak.multiplier)}`,
      status: `Your ${streak.days}-day streak multiplies every star you earn by ${streak.multiplier.toFixed(1)}. ` +
        `Keep it going ${toGo} to reach ${next}.`,
      rule,
    };
  }
  return {
    title: 'Streak bonus',
    status: streak.days > 0
      ? `You're on a ${streak.days}-day streak. Keep it going ${toGo} and every star you earn gets ${next}.`
      : `Learn ${streak.starts_at_days} days in a row and every star you earn gets ${next}.`,
    rule,
  };
}

/** What an `earlier` remainder is called: stars the ledger doesn't explain, or a correction. */
export function earlierLabel(earlier: number): string {
  return earlier > 0 ? 'Earlier stars' : 'Corrections';
}
