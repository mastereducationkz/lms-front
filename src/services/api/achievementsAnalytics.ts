/**
 * Achievements for staff (owner, 2026-10-04, S1–S4): GET /achievements/analytics (scoped on the
 * server: the school for admins and head roles, their groups for teachers and curators) and the
 * share-tracking totals GET /achievements/shares/stats (null while that endpoint isn't deployed).
 */
import { api } from './client';
import type { AchievementTier } from './achievementsUi';

export interface AnalyticsPerson {
  id: number;
  name: string;
  avatar_url: string | null;
  mascot: string | null;
  count: number;
  groups?: string[];
}

export interface AnalyticsAchievement {
  key: string;
  title: string;
  tier: AchievementTier;
  category: string;
  secret: boolean;
  unlocked: number;
  pct: number;
  last_7_days: number;
  last_30_days: number;
}

export interface AnalyticsGroup {
  id: number;
  name: string | null;
  students: number;
  avg_achievements: number;
  top: AnalyticsPerson[];
}

export interface StaffStars {
  user_id: number;
  name: string;
  role: string;
  total: number;
  per_week: number[];
}

export interface AchievementsAnalytics {
  scope: { kind: 'school' | 'groups' | 'group'; group_id: number | null; groups: { id: number; name: string }[] };
  summary: {
    active_students: number;
    students_with_any: number;
    students_with_any_pct: number;
    avg_per_student: number;
    achievements_total: number;
    unlocks: number;
    retro_unlocks: number;
    last_7_days: number;
    last_30_days: number;
  };
  achievements: AnalyticsAchievement[];
  trend: { week: string; unlocks: number }[];
  groups: AnalyticsGroup[];
  top_earners: AnalyticsPerson[];
  stars: {
    weeks: string[];
    by_staff: StaffStars[];
    total: number;
    groups_this_week: number;
    groups_total: number;
    coverage_this_week_pct: number;
  };
  streaks: {
    buckets: string[];
    current: number[];
    longest: number[];
    students_on_a_streak: number;
    avg_current: number;
    best_longest: number;
  };
}

export interface ShareStats {
  totals: { shares: number; views: number; by_method: Partial<Record<'native' | 'download' | 'copy' | 'qr', number>> };
  by_kind: Record<string, { shares?: number; views?: number }>;
  by_achievement: { key: string; shares: number; views: number }[];
  last_30_days: { date: string; shares: number; views: number }[];
}

export async function getAchievementsAnalytics(params: { groupId?: number | null; weeks?: number } = {}): Promise<AchievementsAnalytics> {
  const query: Record<string, number> = {};
  if (params.groupId) query.group_id = params.groupId;
  if (params.weeks) query.weeks = params.weeks;
  const response = await api.get('/achievements/analytics', { params: query, cache: false } as never);
  return response.data as AchievementsAnalytics;
}

/** The share builder's totals; null when the endpoint isn't there yet (404) or isn't ours to see. */
export async function getShareStats(): Promise<ShareStats | null> {
  try {
    const response = await api.get('/achievements/shares/stats', { cache: false } as never);
    const data = response?.data as ShareStats | undefined;
    return data && data.totals ? data : null;
  } catch {
    return null;
  }
}
