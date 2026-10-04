/**
 * Kasatik Achievements API (owner, 2026-10-04) — typed exactly to the shared contract
 * (scratchpad ACHIEVEMENTS_CONTRACT.md §3, incl. Amendment 1). Backend prefix: /achievements.
 */
import { api } from './client';

export type AchievementTier = 'earned' | 'rare' | 'legendary' | 'social' | 'seasonal';
export type RewardLayer = 'h' | 'g' | 'p' | 'b' | 'f';

export interface AchievementReward {
  layer: RewardLayer;
  index: number;
  name: string;
}

export interface Achievement {
  key: string;
  /** "Secret achievement" while a secret one is locked. */
  title: string;
  description: string | null;
  how_to: string | null;
  tier: AchievementTier;
  category: string;
  secret: boolean;
  unlocked: boolean;
  unlocked_at: string | null;
  seen: boolean;
  progress: { current: number; target: number } | null;
  count: number;
  rewards: AchievementReward[];
  /** The achievement_unlocks row id — maps a bell notification's related_id to this key. */
  unlock_id: number | null;
}

export interface StarAward {
  id?: number;
  student_id?: number;
  group_id?: number;
  reason: string;
  awarded_by_name: string;
  awarded_by_role: string;
  week: string;
  created_at: string;
}

export interface MyAchievements {
  achievements: Achievement[];
  locked_parts: Partial<Record<RewardLayer, number[]>>;
  unseen: string[];
  streak: { current: number; longest: number };
  star_awards: StarAward[];
}

export type StudentAchievements = Omit<MyAchievements, 'locked_parts' | 'unseen'>;

export interface GroupStars {
  this_week: StarAward[];
  history: StarAward[];
  can_award: boolean;
  my_role: string;
}

const detail = (error: any, fallback: string) => new Error(error?.response?.data?.detail || fallback);

export async function getMyAchievements(): Promise<MyAchievements> {
  try {
    const response = await api.get('/achievements/me');
    return response.data;
  } catch (error: any) {
    throw detail(error, 'Could not load your achievements');
  }
}

export async function markAchievementsSeen(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await api.post('/achievements/me/seen', { keys });
  } catch (error: any) {
    throw detail(error, 'Could not update your achievements');
  }
}

export async function getStudentAchievements(studentId: number): Promise<StudentAchievements> {
  try {
    const response = await api.get(`/achievements/students/${studentId}`);
    return response.data;
  } catch (error: any) {
    throw detail(error, "Could not load the student's achievements");
  }
}

export async function awardStar(body: { student_id: number; group_id: number; reason: string }): Promise<StarAward> {
  try {
    const response = await api.post('/achievements/stars', body);
    return response.data;
  } catch (error: any) {
    throw detail(error, 'Could not award the star');
  }
}

export async function getGroupStars(groupId: number): Promise<GroupStars> {
  try {
    const response = await api.get('/achievements/stars', { params: { group_id: groupId } });
    return response.data;
  } catch (error: any) {
    throw detail(error, 'Could not load Stars of the Week');
  }
}
