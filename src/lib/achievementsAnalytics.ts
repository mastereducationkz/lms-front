/** Pure helpers for the staff achievements analytics (owner, 2026-10-04). */
import type { AnalyticsAchievement, AnalyticsGroup } from '@/services/api/achievementsAnalytics';

export type Lang = 'ru' | 'en';

export const tr = (lang: Lang, ru: string, en: string) => (lang === 'ru' ? ru : en);

/** Russian for curator roles, English for everyone else — the sidebar's own rule. */
export const langForRole = (role?: string | null): Lang => (role === 'curator' || role === 'head_curator' ? 'ru' : 'en');

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

const ROLE_LABELS: Record<string, [string, string]> = {
  teacher: ['Преподаватель', 'Teacher'],
  curator: ['Куратор', 'Curator'],
  head_teacher: ['Head Teacher', 'Head Teacher'],
  head_curator: ['Руководитель кураторов', 'Head Curator'],
  admin: ['Админ', 'Admin'],
};

export function staffRoleLabel(role: string, lang: Lang): string {
  const pair = ROLE_LABELS[role];
  return pair ? tr(lang, pair[0], pair[1]) : role;
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
