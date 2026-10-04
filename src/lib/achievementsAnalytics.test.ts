import { describe, expect, it } from 'vitest';
import type { AnalyticsAchievement, AnalyticsGroup } from '@/services/api/achievementsAnalytics';
import { barWidth, filterGroups, formatPct, highlights, langForRole, staffRoleLabel, weekLabel } from './achievementsAnalytics';

const item = (key: string, unlocked: number): AnalyticsAchievement => ({
  key, title: key, tier: 'rare', category: 'x', secret: false, unlocked, pct: 0, last_7_days: 0, last_30_days: 0,
});

describe('achievements analytics helpers', () => {
  it('formats percentages without hiding a rare unlock', () => {
    expect(formatPct(0)).toBe('0%');
    expect(formatPct(0.4)).toBe('<1%');
    expect(formatPct(25)).toBe('25%');
    expect(formatPct(12.5)).toBe('12.5%');
  });

  it('keeps a tiny bar visible and caps at 100%', () => {
    expect(barWidth(0)).toBe('0%');
    expect(barWidth(0.3)).toBe('2%');
    expect(barWidth(140)).toBe('100%');
  });

  it('labels weeks and roles, Russian for curator roles', () => {
    expect(weekLabel('2026-09-28')).toBe('28.09');
    expect(langForRole('head_curator')).toBe('ru');
    expect(langForRole('admin')).toBe('en');
    expect(staffRoleLabel('curator', 'ru')).toBe('Куратор');
    expect(staffRoleLabel('teacher', 'en')).toBe('Teacher');
  });

  it('searches groups by name, keeping the server order', () => {
    const groups = [{ id: 1, name: 'October 3 SAT' }, { id: 2, name: 'IELTS July' }] as AnalyticsGroup[];
    expect(filterGroups(groups, 'sat').map((g) => g.id)).toEqual([1]);
    expect(filterGroups(groups, '  ').map((g) => g.id)).toEqual([1, 2]);
  });

  it('picks the rarest held and the most common achievements', () => {
    const { rarest, commonest } = highlights([item('a', 0), item('b', 5), item('c', 1), item('d', 9)], 2);
    expect(rarest.map((a) => a.key)).toEqual(['c', 'b']);
    expect(commonest.map((a) => a.key)).toEqual(['d', 'b']);
  });
});
