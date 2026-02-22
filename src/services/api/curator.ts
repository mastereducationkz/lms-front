import type { Group, StudentProgress } from '../../types';
import { api } from './client';

export async function getCuratorPendingSubmissions(): Promise<any[]> {
  try {
    const response = await api.get('/dashboard/curator/pending-submissions');
    return response.data.pending_submissions || [];
  } catch (error) {
    console.error('Failed to load curator pending submissions:', error);
    throw error;
  }
}

export async function getCuratorRecentSubmissions(limit: number = 10): Promise<any[]> {
  try {
    const response = await api.get('/dashboard/curator/recent-submissions', {
      params: { limit }
    });
    return response.data.recent_submissions || [];
  } catch (error) {
    console.error('Failed to load curator recent submissions:', error);
    throw error;
  }
}

export async function getCuratorStudentsProgress(): Promise<StudentProgress[]> {
  try {
    const response = await api.get('/dashboard/curator/students-progress');
    return response.data.students_progress || [];
  } catch (error) {
    console.error('Failed to load curator students progress:', error);
    throw error;
  }
}

export async function getCuratorAssignmentsAnalytics(): Promise<any[]> {
  try {
    const response = await api.get('/dashboard/curator/assignments-analytics');
    return response.data.assignments || [];
  } catch (error) {
    console.error('Failed to load curator assignments analytics:', error);
    throw error;
  }
}

export async function getCuratorHomeworkByGroup(groupId?: number): Promise<any> {
  try {
    const response = await api.get('/dashboard/curator/homework-by-group', {
      params: groupId ? { group_id: groupId } : {}
    });
    return response.data;
  } catch (error) {
    console.error('Failed to load curator homework by group:', error);
    throw error;
  }
}

export async function getCuratorGroups(): Promise<Group[]> {
  try {
    const response = await api.get('/leaderboard/curator/groups');
    return response.data;
  } catch (error) {
    console.error('Failed to load curator groups:', error);
    throw error;
  }
}

export async function getGroupSchedule(groupId: number): Promise<{
  start_date: string;
  weeks_count: number;
  lessons_count?: number;
  schedule_items: { day_of_week: number; time_of_day: string }[];
}> {
  try {
    const response = await api.get(`/leaderboard/curator/schedule/${groupId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to load group schedule:', error);
    throw error;
  }
}

export async function getGroupLeaderboard(groupId: number, weekNumber: number): Promise<any[]> {
  try {
    const response = await api.get(`/leaderboard/curator/leaderboard/${groupId}`, {
      params: { week_number: weekNumber }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
    throw error;
  }
}

export async function getWeeklyLessonsWithHwStatus(groupId: number, weekNumber: number): Promise<any> {
  try {
    const response = await api.get(`/leaderboard/curator/weekly-lessons/${groupId}`, {
      params: { week_number: weekNumber }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get weekly lessons:', error);
    throw error;
  }
}

export async function getGroupFullAttendanceMatrix(groupId: number): Promise<any> {
  try {
    const response = await api.get(`/leaderboard/curator/full-attendance/${groupId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get full attendance matrix:', error);
    throw error;
  }
}

export async function updateLeaderboardConfig(data: {
  group_id: number;
  week_number: number;
  curator_hour_enabled?: boolean;
  study_buddy_enabled?: boolean;
  self_reflection_journal_enabled?: boolean;
  weekly_evaluation_enabled?: boolean;
  extra_points_enabled?: boolean;
  curator_hour_date?: string | null;
}): Promise<any> {
  try {
    const response = await api.post('/leaderboard/config', data);
    return response.data;
  } catch (error) {
    console.error('Failed to update leaderboard config:', error);
    throw error;
  }
}

export async function updateAttendanceBulk(data: {
  updates: Array<{
    group_id: number;
    week_number: number;
    lesson_index: number;
    student_id: number;
    score: number;
    status: string;
    event_id: number | null;
  }>;
}): Promise<any> {
  try {
    const response = await api.post('/leaderboard/curator/attendance/bulk', data);
    return response.data;
  } catch (error) {
    console.error('Failed to update bulk attendance:', error);
    throw error;
  }
}

export async function updateLeaderboardEntry(data: {
  user_id: number;
  group_id: number;
  week_number: number;
  [key: string]: number;
}): Promise<any> {
  try {
    const response = await api.post('/leaderboard/curator/leaderboard', data);
    return response.data;
  } catch (error) {
    console.error('Failed to update leaderboard entry:', error);
    throw error;
  }
}

export async function updateAttendance(data: {
  group_id: number;
  week_number: number;
  lesson_index: number;
  student_id: number;
  score: number;
  status: string;
  event_id?: number;
}): Promise<any> {
  try {
    const response = await api.post('/leaderboard/curator/attendance', data);
    return response.data;
  } catch (error) {
    console.error('Failed to update attendance:', error);
    throw error;
  }
}

export async function generateSchedule(data: {
  group_id: number;
  start_date: string;
  schedule_items: { day_of_week: number; time_of_day: string }[];
  weeks_count?: number;
  lessons_count?: number;
}): Promise<any> {
  try {
    const response = await api.post('/leaderboard/curator/schedule/generate', data);
    return response.data;
  } catch (error) {
    console.error('Failed to generate schedule:', error);
    throw error;
  }
}

export async function getGroupSchedules(groupId: number, weeksBack: number = 4, weeksAhead: number = 8): Promise<{
  id: number;
  title: string;
  scheduled_at: string;
  lesson_number: number;
  is_past?: boolean;
}[]> {
  try {
    const response = await api.get(`/leaderboard/group-schedules/${groupId}`, {
      params: { weeks_back: weeksBack, weeks_ahead: weeksAhead }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to load group class events:', error);
    throw error;
  }
}

export async function bulkScheduleUpload(text: string): Promise<any> {
  try {
    const response = await api.post('/admin/groups/bulk-schedule-upload', { text });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to bulk upload schedules');
  }
}

export async function getCuratorDetails(curatorId: number): Promise<{
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  groups: Array<{
    id: number;
    name: string;
    student_count: number;
    overdue_count: number;
    avg_progress: number;
  }>;
  total_students: number;
  total_overdue: number;
  avg_progress: number;
}> {
  try {
    const response = await api.get(`/dashboard/curator/${curatorId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get curator details:', error);
    throw error;
  }
}

export async function getCuratorTasks(params?: {
  status?: string;
  task_type?: string;
  student_id?: number;
  group_id?: number;
  week?: string;
  program_week?: number;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; tasks: any[] }> {
  try {
    const response = await api.get('/curator-tasks/my-tasks', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get curator tasks:', error);
    throw error;
  }
}

export async function getCuratorTaskGroups(): Promise<Array<{
  id: number;
  name: string;
  start_date: string | null;
  lessons_count: number | null;
  program_week: number | null;
  total_weeks: number | null;
  has_schedule: boolean;
}>> {
  try {
    const response = await api.get('/curator-tasks/my-groups');
    return response.data;
  } catch (error) {
    console.error('Failed to get curator task groups:', error);
    throw error;
  }
}

export async function getCuratorTasksSummary(): Promise<{
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  total: number;
}> {
  try {
    const response = await api.get('/curator-tasks/my-tasks/summary');
    return response.data;
  } catch (error) {
    console.error('Failed to get curator tasks summary:', error);
    throw error;
  }
}

export async function updateCuratorTask(taskId: number, data: {
  status?: string;
  result_text?: string;
  screenshot_url?: string;
}): Promise<any> {
  try {
    const response = await api.patch(`/curator-tasks/my-tasks/${taskId}`, data);
    return response.data;
  } catch (error) {
    console.error('Failed to update curator task:', error);
    throw error;
  }
}

export async function bulkUpdateCuratorTasks(taskIds: number[], status: string): Promise<{ updated: number }> {
  try {
    const response = await api.patch('/curator-tasks/my-tasks/bulk', { task_ids: taskIds, status });
    return response.data;
  } catch (error) {
    console.error('Failed to bulk update curator tasks:', error);
    throw error;
  }
}

export async function getCuratorTaskTemplates(taskType?: string): Promise<any[]> {
  try {
    const params = taskType ? { task_type: taskType } : {};
    const response = await api.get('/curator-tasks/templates', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get curator task templates:', error);
    throw error;
  }
}

export async function seedCuratorTaskTemplates(): Promise<{ detail: string }> {
  try {
    const response = await api.post('/curator-tasks/seed-templates');
    return response.data;
  } catch (error) {
    console.error('Failed to seed curator task templates:', error);
    throw error;
  }
}

export async function generateWeeklyTasks(week?: string, group_id?: number): Promise<{ detail: string; created: number; week: string }> {
  try {
    const params: any = {};
    if (week) params.week = week;
    if (group_id) params.group_id = group_id;
    const response = await api.post('/curator-tasks/generate-weekly', null, { params });
    return response.data;
  } catch (error) {
    console.error('Failed to generate weekly tasks:', error);
    throw error;
  }
}

export async function getAllCuratorTasks(params?: {
  curator_id?: number;
  status?: string;
  task_type?: string;
  group_id?: number;
  week?: string;
  program_week?: number;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; tasks: any[] }> {
  try {
    const response = await api.get('/curator-tasks/all-tasks', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get all curator tasks:', error);
    throw error;
  }
}

export async function getCuratorsSummary(week?: string): Promise<any[]> {
  try {
    const params = week ? { week } : {};
    const response = await api.get('/curator-tasks/curators-summary', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get curators summary:', error);
    throw error;
  }
}
