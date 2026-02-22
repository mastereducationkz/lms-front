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
    points: number;
    rank: number;
  }>;
}> {
  try {
    const response = await api.get('/gamification/leaderboard', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load gamification leaderboard');
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
