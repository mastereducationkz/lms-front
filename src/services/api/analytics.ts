import { api } from './client';

export async function getDetailedStudentAnalytics(studentId: string, courseId?: string): Promise<any> {
  try {
    const params = courseId ? `?course_id=${courseId}` : '';
    const response = await api.get(`/analytics/student/${studentId}/detailed${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get detailed student analytics:', error);
    throw error;
  }
}

export async function getCourseAnalyticsOverview(courseId: string): Promise<any> {
  try {
    const response = await api.get(`/analytics/course/${courseId}/overview`);
    return response.data;
  } catch (error) {
    console.error('Failed to get course analytics overview:', error);
    throw error;
  }
}

export async function getVideoEngagementAnalytics(courseId: string): Promise<any> {
  try {
    const response = await api.get(`/analytics/video-engagement/${courseId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get video engagement analytics:', error);
    throw error;
  }
}

export async function getQuizPerformanceAnalytics(courseId: string): Promise<any> {
  try {
    const response = await api.get(`/analytics/quiz-performance/${courseId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get quiz performance analytics:', error);
    throw error;
  }
}

export async function getQuizErrors(courseId: string, groupId?: number, limit: number = 20, lessonId?: number): Promise<{
  course_id: number;
  group_id: number | null;
  total_attempts_analyzed: number;
  questions: Array<{
    step_id: number;
    lesson_id: number;
    question_id: string;
    total_attempts: number;
    wrong_answers: number;
    error_rate: number;
    question_text: string;
    question_type: string;
    lesson_title: string;
    step_title: string;
  }>;
}> {
  try {
    const params: Record<string, any> = { limit };
    if (groupId) params.group_id = groupId;
    if (lessonId) params.lesson_id = lessonId;
    const response = await api.get(`/analytics/course/${courseId}/quiz-errors`, { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get quiz errors:', error);
    throw error;
  }
}

export async function getAllStudentsAnalytics(courseId?: string): Promise<any> {
  try {
    const params = courseId ? `?course_id=${courseId}` : '';
    const response = await api.get(`/analytics/students/all${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get all students analytics:', error);
    throw error;
  }
}

export async function getGroupsAnalytics(): Promise<any> {
  try {
    const response = await api.get('/analytics/groups');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch groups analytics:', error);
    throw error;
  }
}

export async function getCourseGroupsAnalytics(courseId: string): Promise<any> {
  try {
    const response = await api.get(`/analytics/course/${courseId}/groups`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch course groups analytics:', error);
    throw error;
  }
}

export async function getCourseProgressHistory(courseId: string, groupId?: string): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (groupId && groupId !== 'all') params.append('group_id', groupId);
    const response = await api.get(`/analytics/course/${courseId}/progress-history?${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get course progress history:', error);
    throw error;
  }
}

export async function getGroupStudentsAnalytics(groupId: string, courseId?: string): Promise<any> {
  try {
    const params = courseId ? `?course_id=${courseId}` : '';
    const response = await api.get(`/analytics/group/${groupId}/students${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get group students analytics:', error);
    throw error;
  }
}

export async function getStudentProgressHistory(studentId: string, courseId?: string, days: number = 30): Promise<any> {
  try {
    const params = new URLSearchParams();
    if (courseId) params.append('course_id', courseId);
    params.append('days', days.toString());
    const response = await api.get(`/analytics/student/${studentId}/progress-history?${params}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get student progress history:', error);
    throw error;
  }
}

export async function exportStudentReport(studentId: string, courseId?: string): Promise<Blob> {
  try {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.post(`/analytics/export/student/${studentId}`, params, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to export student report:', error);
    throw error;
  }
}

export async function exportGroupReport(groupId: string): Promise<Blob> {
  try {
    const response = await api.post(`/analytics/export/group/${groupId}`, {}, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to export group report:', error);
    throw error;
  }
}

export async function exportAllStudentsReport(): Promise<Blob> {
  try {
    const response = await api.post('/analytics/export/all-students', {}, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to export all students report:', error);
    throw error;
  }
}

export async function exportAnalyticsExcel(courseId: number, groupId?: number): Promise<Blob> {
  try {
    const response = await api.get('/analytics/export-excel', {
      params: {
        course_id: courseId,
        ...(groupId && { group_id: groupId })
      },
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to export analytics to Excel:', error);
    throw error;
  }
}

export async function getStudentDetailedProgress(studentId: string, courseId?: string): Promise<any> {
  try {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.get(`/analytics/student/${studentId}/detailed-progress`, { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get student detailed progress:', error);
    throw error;
  }
}

export async function getStudentSatScores(studentId: string): Promise<any> {
  try {
    const response = await api.get(`/analytics/student/${studentId}/sat-scores`);
    return response.data;
  } catch (error) {
    console.warn('Failed to load SAT scores:', error);
    return { testResults: [] };
  }
}

export async function getStudentLearningPath(studentId: string, courseId: string): Promise<any> {
  try {
    const response = await api.get(`/analytics/student/${studentId}/learning-path`, {
      params: { course_id: courseId }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get student learning path:', error);
    throw error;
  }
}
