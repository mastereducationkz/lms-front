/**
 * Kasatik Achievements (owner, 2026-10-04) — the client for the achievements pages, the unlock
 * celebration and Star of the Week. Shapes follow the shared contract (backend `src/achievements`).
 * GETs skip the request cache: an unlock must show the moment it happens.
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
  /** The unlock row's id (contract amendment 1) — the bell notice's related_id points at it. */
  unlock_id?: number | null;
}

export interface StarAward {
  id?: number;
  student_id?: number;
  student_name?: string;
  group_id?: number;
  reason: string;
  awarded_by_name: string;
  awarded_by_role: string;
  week: string;
  created_at: string;
}

export interface AchievementStreak {
  current: number;
  longest: number;
}

export interface MyAchievements {
  achievements: Achievement[];
  locked_parts: Partial<Record<RewardLayer, number[]>>;
  unseen: string[];
  streak: AchievementStreak;
  /** The student's own Stars of the Week, newest first (contract amendment 1); absent on an older backend. */
  star_awards?: StarAward[];
}

export type StudentAchievements = Omit<MyAchievements, 'locked_parts' | 'unseen'>;

export interface GroupStars {
  this_week: StarAward[];
  history: StarAward[];
  can_award: boolean;
  my_role: string;
}

/** Anything but the expected object is "nothing yet", never a value that crashes a page. */
function asMyAchievements(data: unknown): MyAchievements {
  const d = (data ?? {}) as Partial<MyAchievements>;
  return {
    achievements: Array.isArray(d.achievements) ? d.achievements : [],
    locked_parts: d.locked_parts && typeof d.locked_parts === 'object' ? d.locked_parts : {},
    unseen: Array.isArray(d.unseen) ? d.unseen : [],
    streak: {
      current: Number(d.streak?.current) || 0,
      longest: Number(d.streak?.longest) || 0,
    },
    star_awards: Array.isArray(d.star_awards) ? d.star_awards : undefined,
  };
}

export async function getMyAchievements(): Promise<MyAchievements> {
  const response = await api.get('/achievements/me', { cache: false } as never);
  return asMyAchievements(response?.data);
}

export async function markAchievementsSeen(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await api.post('/achievements/me/seen', { keys });
}

export async function getStudentAchievements(studentId: number): Promise<StudentAchievements> {
  const response = await api.get(`/achievements/students/${studentId}`, { cache: false } as never);
  const { achievements, streak, star_awards } = asMyAchievements(response?.data);
  return { achievements, streak, star_awards };
}

export async function getGroupStars(groupId: number): Promise<GroupStars> {
  const response = await api.get('/achievements/stars', { params: { group_id: groupId }, cache: false } as never);
  const d = (response?.data ?? {}) as Partial<GroupStars>;
  return {
    this_week: Array.isArray(d.this_week) ? d.this_week : [],
    history: Array.isArray(d.history) ? d.history : [],
    can_award: Boolean(d.can_award),
    my_role: typeof d.my_role === 'string' ? d.my_role : '',
  };
}

/** Awards a Star of the Week. Rejects with the server's own reason (e.g. the weekly limit, 409). */
export async function awardStar(body: { student_id: number; group_id: number; reason: string }): Promise<StarAward> {
  try {
    const response = await api.post('/achievements/stars', body);
    return response.data as StarAward;
  } catch (error: unknown) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    throw new Error(typeof detail === 'string' && detail ? detail : 'Could not award the star');
  }
}
