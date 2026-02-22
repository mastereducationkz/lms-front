import type { DashboardStats, RecentActivity, AdminDashboard, ManualLessonUnlockCreate, ManualLessonUnlockListResponse } from '../../types';
import { api } from './client';

export async function getDashboardStats(groupId?: number, startDate?: string, endDate?: string): Promise<DashboardStats> {
  try {
    const params: any = {};
    if (groupId) params.group_id = groupId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/dashboard/stats', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load dashboard stats');
  }
}

export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  try {
    const response = await api.get('/dashboard/recent-activity', {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load recent activity');
  }
}

export async function updateStudyTime(minutes: number): Promise<any> {
  try {
    const response = await api.post('/dashboard/update-study-time', null, {
      params: { minutes_studied: minutes }
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to update study time');
  }
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  try {
    const response = await api.get('/admin/dashboard');
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch admin dashboard');
  }
}

export async function getAdminStats() {
  try {
    const response = await api.get('/admin/stats');
    return response.data;
  } catch (error) {
    throw new Error('Failed to load admin stats');
  }
}

export async function completeStepsForUser(data: {
  user_id: number;
  course_id: number;
  lesson_ids?: number[];
  step_ids?: number[];
}): Promise<{
  success: boolean;
  message: string;
  user: { id: number; name: string; email: string };
  course: { id: number; title: string };
  statistics: {
    total_steps: number;
    newly_completed: number;
    updated: number;
    already_completed: number;
  };
}> {
  try {
    const response = await api.post('/admin/complete-steps-for-user', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to complete steps for user');
  }
}

export async function resetStepsForUser(data: {
  user_id: number;
  course_id: number;
  lesson_ids?: number[];
  step_ids?: number[];
}): Promise<{
  success: boolean;
  message: string;
  deleted_records: number;
}> {
  try {
    const response = await api.post('/admin/reset-steps-for-user', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to reset steps for user');
  }
}

export async function getUserProgressSummary(userId: number, courseId: number): Promise<{
  user: { id: number; name: string; email: string };
  course: { id: number; title: string };
  overall: {
    total_steps: number;
    completed_steps: number;
    completion_percentage: number;
  };
  lessons: Array<{
    lesson_id: number;
    lesson_title: string;
    module_title: string;
    total_steps: number;
    completed_steps: number;
    completion_percentage: number;
  }>;
}> {
  try {
    const response = await api.get(`/admin/user-progress-summary/${userId}/${courseId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get user progress summary');
  }
}

export async function reportQuestionError(questionId: string | number, message: string, stepId?: number, suggestedAnswer?: string): Promise<void> {
  try {
    await api.post('/questions/report-error', {
      question_id: questionId,
      message,
      step_id: stepId,
      suggested_answer: suggestedAnswer,
    });
  } catch (error) {
    console.error('Failed to report question error:', error);
    throw error;
  }
}

export async function getQuestionErrorReports(status?: string): Promise<any[]> {
  try {
    const params = status ? { status } : {};
    const response = await api.get('/questions/error-reports', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get question error reports:', error);
    throw error;
  }
}

export async function getQuestionErrorReportDetail(reportId: number): Promise<any> {
  try {
    const response = await api.get(`/questions/error-reports/${reportId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get question error report detail:', error);
    throw error;
  }
}

export async function updateQuestionErrorReportStatus(reportId: number, status: string): Promise<void> {
  try {
    await api.patch(`/questions/error-reports/${reportId}`, null, { params: { status } });
  } catch (error) {
    console.error('Failed to update question error report status:', error);
    throw error;
  }
}

export async function updateQuestion(stepId: number, questionId: string | number, data: {
  question_text?: string;
  correct_answer?: any;
  options?: any[];
  explanation?: string;
}): Promise<any> {
  try {
    const response = await api.put(`/questions/update-question/${stepId}/${questionId}`, data);
    return response.data;
  } catch (error) {
    console.error('Failed to update question:', error);
    throw error;
  }
}

export async function manualUnlockLesson(data: ManualLessonUnlockCreate): Promise<any> {
  try {
    const response = await api.post('/progress/manual-unlock', data);
    return response.data;
  } catch (error) {
    console.error('Failed to manually unlock lesson:', error);
    throw error;
  }
}

export async function manualLockLesson(data: ManualLessonUnlockCreate): Promise<any> {
  try {
    const response = await api.post('/progress/manual-lock', data);
    return response.data;
  } catch (error) {
    console.error('Failed to manually lock lesson:', error);
    throw error;
  }
}

export async function getManualUnlocks(params: {
  lesson_id?: number;
  user_id?: number;
  group_id?: number;
}): Promise<ManualLessonUnlockListResponse> {
  try {
    const response = await api.get('/progress/manual-unlocks', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch manual unlocks:', error);
    throw error;
  }
}

export async function getStudentsJournal(params?: {
  group_id?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  total: number;
  students: Array<{
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    group_id: number;
    group_name: string;
    attendance_attended: number;
    attendance_total: number;
    attendance_rate: number | null;
    lms_progress: number | null;
    hw_submitted: number;
    hw_avg_score: number | null;
    az_status: 'not_started' | 'draft' | 'submitted';
    last_activity: string | null;
  }>;
}> {
  try {
    const response = await api.get('/student-journal/list', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get students journal:', error);
    throw error;
  }
}

export async function getStudentJournalGroups(): Promise<Array<{ id: number; name: string }>> {
  try {
    const response = await api.get('/student-journal/groups');
    return response.data;
  } catch (error) {
    console.error('Failed to get journal groups:', error);
    throw error;
  }
}

export async function getStudentProfile(studentId: number): Promise<any> {
  try {
    const response = await api.get(`/student-journal/${studentId}/profile`);
    return response.data;
  } catch (error) {
    console.error('Failed to get student profile:', error);
    throw error;
  }
}
