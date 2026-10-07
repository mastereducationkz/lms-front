/**
 * Kasatik Achievements (owner, 2026-10-04): the pure rules behind the achievements page, the
 * dashboard tile, the unlock celebration and Star of the Week. No React, no requests — tested in
 * achievements.test.ts.
 */
import { applyPart } from '../components/mascot/config';
import { activeLocale, t, type Locale } from './i18n';
import type { Achievement, AchievementReward, AchievementTier, GroupStars, StarAward } from '../services/api/achievementsUi';
import '@/lib/i18n/catalogs/achievements';

export const TOTAL_LABEL = (list: Achievement[]) => `${list.filter((a) => a.unlocked).length} / ${list.length}`;

/** Categories in page order, with their student-facing names. Unknown categories go last. */
export const CATEGORY_ORDER: { key: string; label: string }[] = [
  { key: 'getting_started', label: 'Getting started' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'weekly_tests', label: 'Weekly tests' },
  { key: 'mastery', label: 'Mastery' },
  { key: 'streaks', label: 'Streaks' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'social', label: 'Social' },
  { key: 'seasonal', label: 'Seasonal' },
];

export const TIER_LABEL: Record<AchievementTier, string> = {
  earned: 'Earned',
  rare: 'Rare',
  legendary: 'Legendary',
  social: 'Social',
  seasonal: 'Seasonal',
};

/** How exciting a tier is — the celebration dresses the orca in the most exciting reward first. */
const TIER_RANK: Record<AchievementTier, number> = { legendary: 0, rare: 1, social: 2, seasonal: 3, earned: 4 };

const ratio = (a: Achievement) => (a.progress && a.progress.target > 0 ? a.progress.current / a.progress.target : 0);
const remaining = (a: Achievement) => (a.progress ? Math.max(0, a.progress.target - a.progress.current) : Infinity);

/** «Almost there»: the locked, visible achievements closest to unlocking (by share done, then by steps left). */
export function almostThere(list: Achievement[], n = 3): Achievement[] {
  return list
    .filter((a) => !a.unlocked && !a.secret && a.progress && a.progress.target > 0 && a.progress.current < a.progress.target)
    .sort((a, b) => ratio(b) - ratio(a) || remaining(a) - remaining(b) || a.key.localeCompare(b.key))
    .slice(0, n);
}

/** The newest unlocks first. */
export function recentlyUnlocked(list: Achievement[], n = 4): Achievement[] {
  return list
    .filter((a) => a.unlocked && a.unlocked_at)
    .sort((a, b) => Date.parse(b.unlocked_at as string) - Date.parse(a.unlocked_at as string))
    .slice(0, n);
}

/** What the dashboard tile points at: the closest one, else the first visible locked one. */
export function nextAchievement(list: Achievement[]): Achievement | null {
  return almostThere(list, 1)[0] ?? list.find((a) => !a.unlocked && !a.secret) ?? null;
}

export function groupByCategory(list: Achievement[]): { key: string; label: string; items: Achievement[] }[] {
  const known = new Set(CATEGORY_ORDER.map((c) => c.key));
  const groups = CATEGORY_ORDER.map((c) => ({ ...c, items: list.filter((a) => a.category === c.key) }));
  const other = list.filter((a) => !known.has(a.category));
  if (other.length) groups.push({ key: 'other', label: 'More', items: other });
  return groups.filter((g) => g.items.length > 0);
}

// ── the orca wearing a reward ───────────────────────────────────────────────────────────

/** Their current look (saved code, else the automatic orca) with one reward put on — the code
 *  «Wear it now» saves. One code format, owned by the mascot module. */
export function withReward(code: string | null | undefined, userId: number | string, reward: AchievementReward): string {
  return applyPart(code, userId, reward.layer, reward.index);
}

/** Most exciting first (legendary → earned), keeping the given order within a tier. */
export function byExcitement(list: Achievement[]): Achievement[] {
  return list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => TIER_RANK[x.a.tier] - TIER_RANK[y.a.tier] || x.i - y.i)
    .map(({ a }) => a);
}

/** The reward the celebration dresses the orca in: the most exciting tier among the new unlocks. */
export function celebrationReward(list: Achievement[], unseen: string[]): { achievement: Achievement; reward: AchievementReward } | null {
  const fresh = list
    .filter((a) => unseen.includes(a.key) && a.rewards.length > 0)
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || unseen.indexOf(a.key) - unseen.indexOf(b.key));
  return fresh[0] ? { achievement: fresh[0], reward: fresh[0].rewards[0] } : null;
}

// ── the celebration ─────────────────────────────────────────────────────────────────────

export interface CelebrationInput {
  role?: string | null;
  unseen: string[];
  tourActive: boolean;
  assignmentZeroGate: boolean;
  pathname: string;
  /** Keys already celebrated in this page session (shown, then closed). */
  celebrated: Set<string>;
}

/** Students only, something new to celebrate, never over the tour or the Assignment Zero gate. */
export function shouldShowCelebration(i: CelebrationInput): boolean {
  if (i.role !== 'student') return false;
  if (i.tourActive || i.assignmentZeroGate) return false;
  if (i.pathname.startsWith('/assignment-zero')) return false;
  return i.unseen.some((k) => !i.celebrated.has(k));
}

export const celebrationTitle = (count: number) =>
  count <= 1 ? 'Achievement unlocked!' : `You unlocked ${count} achievements!`;

// ── the bell ────────────────────────────────────────────────────────────────────────────

export const ACHIEVEMENT_NOTIFICATION_TYPE = 'achievement_unlocked';

/** Fired by the bell when its unread count grows — a new achievement may have landed. */
export const ACHIEVEMENTS_CHECK_EVENT = 'kasatik:achievements-check';

/**
 * Where an achievement notice in the bell leads; null for every other notice. The notice's
 * related_id is the unlock's id, matched to an achievement's unlock_id; when that can't be
 * resolved (the list failed to load, an older backend) it's the page itself.
 */
export function achievementNotificationPath(
  n: { notification_type: string; related_id: number | null },
  list: Pick<Achievement, 'key' | 'unlock_id'>[] | null,
): string | null {
  if (n.notification_type !== ACHIEVEMENT_NOTIFICATION_TYPE) return null;
  const key = n.related_id != null ? list?.find((a) => a.unlock_id === n.related_id)?.key : undefined;
  return key ? `/achievements#${key}` : '/achievements';
}

/** The card a `#key` deep link points at, if that achievement exists. */
export function resolveHighlight(list: Achievement[], hash: string): string | null {
  const key = decodeURIComponent(hash.replace(/^#/, ''));
  return key && list.some((a) => a.key === key) ? key : null;
}

// ── Star of the Week ────────────────────────────────────────────────────────────────────

export const STAR_REASON_MAX = 140;

/** Stars the caller can still give this group this week: one per awarder role (teacher, curator). */
export function starQuota(stars: GroupStars): number {
  if (!stars.can_award) return 0;
  if (stars.my_role !== 'teacher' && stars.my_role !== 'curator') return 1;
  return stars.this_week.some((a) => a.awarded_by_role === stars.my_role) ? 0 : 1;
}

export function starQuotaLabel(left: number, locale: Locale = activeLocale()): string {
  return t(left > 0 ? 'achievements.star.quotaLeft' : 'achievements.star.quotaUsed', undefined, locale);
}

export function validStarReason(reason: string): boolean {
  const r = reason.trim();
  return r.length >= 1 && r.length <= STAR_REASON_MAX;
}

/** «from your curator Aida» — how a student sees who gave the star. */
export function starFromLabel(award: Pick<StarAward, 'awarded_by_role' | 'awarded_by_name'>): string {
  const first = (award.awarded_by_name || '').trim().split(/\s+/)[0] || '';
  const who = award.awarded_by_role === 'curator' ? 'your curator' : award.awarded_by_role === 'teacher' ? 'your teacher' : 'Master Education';
  return first && who !== 'Master Education' ? `from ${who} ${first}` : `from ${who}`;
}
