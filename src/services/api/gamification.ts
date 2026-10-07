import { api } from './client';

export async function getGamificationStatus(): Promise<{
  activity_points: number;
  daily_streak: number;
  monthly_points: number;
  rank_this_month: number | null;
}> {
  try {
    const response = await api.get('/gamification/status');
    return response.data;
  } catch (error) {
    console.error('Failed to get gamification status:', error);
    throw error;
  }
}

/** One bar in the stars breakdown: a source's net stars (grade reversals are folded into grades). */
export interface StarSource {
  key: 'homework' | 'grades' | 'course_quiz' | 'daily_questions' | 'teacher_bonus' | 'other';
  label: string;
  stars: number;
}

/** How a source pays, from the same constants the backend awards with. */
export interface StarRule {
  key: Exclude<StarSource['key'], 'other'>;
  label: string;
  min: number;
  max: number;
  note: string;
}

export interface StarStreak {
  days: number;
  multiplier: number;
  /** Both null once the multiplier is at its cap. */
  next_multiplier: number | null;
  next_at_days: number | null;
  starts_at_days: number;
  start_multiplier: number;
  step: number;
  step_days: number;
  /** The cap (×2.5, owner 2026-10-07). */
  max_multiplier: number;
}

export interface StarsBreakdown {
  /** users.activity_points, the lifetime total the header pill shows. */
  total: number;
  sources: StarSource[];
  /** Stars the ledger does not explain (drift); null when the bars add up to the total. */
  earlier: number | null;
  rules: StarRule[];
  streak: StarStreak;
}

/** The signed-in student's stars by source (students only). Cached like every /gamification read. */
export async function getStarsBreakdown(): Promise<StarsBreakdown> {
  const response = await api.get('/gamification/breakdown');
  return response.data;
}

export async function getBonusAllowance(groupId?: number): Promise<{ limit: number; given: number; remaining: number }> {
  try {
    const url = groupId
      ? `/gamification/bonus-allowance?group_id=${groupId}`
      : '/gamification/bonus-allowance';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Failed to get bonus allowance:', error);
    return { limit: 50, given: 0, remaining: 50 };
  }
}

export async function giveTeacherBonus(data: {
  student_id: number;
  amount: number;
  reason?: string;
  group_id?: number;
}): Promise<{ success: boolean; message: string; new_total: number }> {
  try {
    const response = await api.post('/gamification/bonus', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to give bonus');
  }
}

export async function getGamificationLeaderboard(params: {
  period?: 'monthly' | 'weekly' | 'all_time';
  group_id?: number;
  limit?: number;
}): Promise<{
  period: string;
  start_date: string | null;
  end_date: string | null;
  total_participants: number;
  entries: Array<{
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    mascot?: string | null;
    points: number;
    rank: number;
  }>;
  self_only?: boolean;
  my_rank?: number | null;
  my_points?: number | null;
  points_to_next_rank?: number | null;
}> {
  try {
    const response = await api.get('/gamification/leaderboard', { params });
    return response.data;
  } catch (error: any) {
    const detail = error?.response?.data?.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d?.msg || '').filter(Boolean).join('; ')
          : 'Failed to load gamification leaderboard';
    throw new Error(msg);
  }
}

export async function getPointHistory(limit: number = 50): Promise<Array<{
  id: number;
  user_id: number;
  amount: number;
  reason: string;
  description: string | null;
  created_at: string;
}>> {
  try {
    const response = await api.get('/gamification/history', { params: { limit } });
    return response.data;
  } catch (error) {
    console.error('Failed to get point history:', error);
    throw error;
  }
}

export async function getStudentLeaderboard(period: 'all_time' | 'this_week' | 'this_month' = 'all_time'): Promise<{
  group_id: number | null;
  group_name: string | null;
  leaderboard: Array<{
    rank: number;
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    mascot?: string | null;
    steps_completed: number;
    time_spent_minutes: number;
    is_current_user: boolean;
  }>;
  current_user_rank: number;
  current_user_entry: {
    rank: number;
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    mascot?: string | null;
    steps_completed: number;
    time_spent_minutes: number;
    is_current_user: boolean;
  } | null;
  current_user_title: string;
  total_participants: number;
  period: string;
  steps_to_next_rank: number;
}> {
  try {
    const response = await api.get('/leaderboard/student/my-ranking', { params: { period } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to load leaderboard');
  }
}
