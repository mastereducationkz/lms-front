import { describe, expect, it } from 'vitest';
import type { StarsBreakdown, StarStreak } from '../services/api/gamification';
import { barPercent, earlierLabel, isEmptyBreakdown, starRange, streakCopy } from './starsBreakdown';

const RULE = { starts_at_days: 5, start_multiplier: 1.1, step: 0.1, step_days: 2 };
const streak = (days: number, multiplier: number, next_multiplier: number, next_at_days: number): StarStreak =>
  ({ days, multiplier, next_multiplier, next_at_days, ...RULE });

const source = (key: StarsBreakdown['sources'][number]['key'], stars: number) => ({ key, label: key, stars });

describe('starsBreakdown helpers', () => {
  it('scales bars to the largest source and never past the track', () => {
    const sources = [source('homework', 20), source('grades', 40), source('course_quiz', 0)];
    expect(barPercent(40, sources)).toBe(100);
    expect(barPercent(20, sources)).toBe(50);
    expect(barPercent(0, sources)).toBe(0);
    expect(barPercent(-5, sources)).toBe(0);
    expect(barPercent(5, [source('homework', 0)])).toBe(0);
  });

  it('calls a breakdown empty only when nothing at all has been earned', () => {
    const base: StarsBreakdown = {
      total: 0, earlier: null, rules: [], streak: streak(0, 1, 1.1, 5),
      sources: [source('homework', 0), source('grades', 0)],
    };
    expect(isEmptyBreakdown(base)).toBe(true);
    expect(isEmptyBreakdown({ ...base, total: 3, earlier: 3 })).toBe(false);
    expect(isEmptyBreakdown({ ...base, total: 10, sources: [source('homework', 10)] })).toBe(false);
  });

  it('prints fixed amounts and ranges', () => {
    expect(starRange(10, 10)).toBe('+10');
    expect(starRange(10, 50)).toBe('+10–50');
  });

  it('explains the streak bonus before, at and after it starts', () => {
    expect(streakCopy(streak(0, 1, 1.1, 5)).status)
      .toBe('Learn 5 days in a row and every star you earn gets ×1.1.');
    expect(streakCopy(streak(4, 1, 1.1, 5)).status)
      .toBe("You're on a 4-day streak. Keep it going 1 more day and every star you earn gets ×1.1.");
    const active = streakCopy(streak(12, 1.4, 1.5, 13));
    expect(active.title).toBe('Streak bonus ×1.4');
    expect(active.status)
      .toBe('Your 12-day streak multiplies every star you earn by 1.4. Keep it going 1 more day to reach ×1.5.');
    expect(streakCopy(streak(5, 1.1, 1.2, 7)).status).toContain('Keep it going 2 more days to reach ×1.2.');
    expect(active.rule)
      .toBe('×1.1 from a 5-day streak, then +0.1 for every 2 more days. It is added to each award as you earn it.');
  });

  it('names the unexplained remainder by its sign', () => {
    expect(earlierLabel(7)).toBe('Earlier stars');
    expect(earlierLabel(-7)).toBe('Corrections');
  });
});
