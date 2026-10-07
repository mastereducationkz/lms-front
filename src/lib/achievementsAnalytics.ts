/** Pure helpers for the staff achievements analytics (owner, 2026-10-04). */
import type { AnalyticsAchievement, AnalyticsGroup } from '@/services/api/achievementsAnalytics';
import { activeLocale, t, type Locale, type MessageKey } from './i18n';
import '@/lib/i18n/catalogs/achievements';

export function formatPct(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  if (value < 1) return '<1%';
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

/** «12.10» for the Monday ISO date of a week. */
export function weekLabel(isoMonday: string): string {
  const [, m, d] = isoMonday.split('-');
  return m && d ? `${d}.${m}` : isoMonday;
}

const ROLE_LABELS: Record<string, MessageKey> = {
  teacher: 'achievements.role.teacher',
  curator: 'achievements.role.curator',
  head_teacher: 'achievements.role.headTeacher',
  head_curator: 'achievements.role.headCurator',
  admin: 'achievements.role.admin',
};

export function staffRoleLabel(role: string, locale: Locale = activeLocale()): string {
  const key = ROLE_LABELS[role];
  return key ? t(key, undefined, locale) : role;
}

/** Bar width for a percentage: never 0 for a non-zero value, so a rare unlock stays visible. */
export function barWidth(pct: number): string {
  if (!pct || pct <= 0) return '0%';
  return `${Math.max(2, Math.min(100, pct))}%`;
}

/** Groups matching a search, in the server's order (highest average first). */
export function filterGroups(groups: AnalyticsGroup[], query: string): AnalyticsGroup[] {
  const q = query.trim().toLowerCase();
  return q ? groups.filter((g) => (g.name || '').toLowerCase().includes(q)) : groups;
}

/** The few rarest achievements somebody in scope already holds (rare = interesting), then the most common. */
export function highlights(items: AnalyticsAchievement[], n = 3): { rarest: AnalyticsAchievement[]; commonest: AnalyticsAchievement[] } {
  const held = items.filter((a) => a.unlocked > 0);
  const rarest = [...held].sort((a, b) => a.unlocked - b.unlocked).slice(0, n);
  const commonest = [...held].sort((a, b) => b.unlocked - a.unlocked).slice(0, n);
  return { rarest, commonest };
}
