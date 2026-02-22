import type { StepProgress, CourseStepsProgress, StudentProgressOverview, DailyStreakInfo } from '../../types';
import { api } from './client';

export async function markLessonComplete(lessonId: string, timeSpent: number = 0) {
  try {
    const response = await api.post(`/progress/lesson/${lessonId}/complete`, null, {
      params: { time_spent: timeSpent }
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to mark lesson complete');
  }
}

export async function startLesson(lessonId: string): Promise<any> {
  try {
    const response = await api.post(`/progress/lesson/${lessonId}/start`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to start lesson');
  }
}

export async function getMyProgress(params: Record<string, any> = {}): Promise<any> {
  try {
    const response = await api.get('/progress/my', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load progress');
  }
}

export async function getCourseProgress(courseId: string, studentId: string | null = null) {
  try {
    const params = studentId ? { student_id: studentId } : {};
    const response = await api.get(`/progress/course/${courseId}`, { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load course progress');
  }
}

export async function isLessonCompleted(lectureId: string): Promise<boolean> {
  try {
    const progress = await getMyProgress({ lesson_id: lectureId });
    return progress.some((p: any) => p.lesson_id === lectureId && p.status === 'completed');
  } catch {
    return false;
  }
}

export async function markStepStarted(stepId: string): Promise<any> {
  try {
    const response = await api.post(`/progress/step/${stepId}/start`);
    return response.data;
  } catch (error) {
    console.error('Failed to mark step as started:', error);
    throw error;
  }
}

export async function markStepVisited(stepId: string, timeSpentMinutes: number): Promise<any> {
  try {
    const response = await api.post(`/progress/step/${stepId}/visit`, {
      step_id: parseInt(stepId),
      time_spent_minutes: timeSpentMinutes
    });
    return response.data;
  } catch (error) {
    console.error('Failed to mark step as visited:', error);
    throw error;
  }
}

export async function getStepProgress(stepId: string): Promise<StepProgress> {
  try {
    const response = await api.get(`/progress/step/${stepId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to get step progress');
  }
}

export async function getLessonStepsProgress(lessonId: string): Promise<StepProgress[]> {
  try {
    const response = await api.get(`/progress/lesson/${lessonId}/steps`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to get lesson steps progress');
  }
}

export async function getCourseStudentsStepsProgress(courseId: string): Promise<CourseStepsProgress> {
  try {
    const response = await api.get(`/progress/course/${courseId}/students/steps`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to get course students steps progress');
  }
}

export async function getStudentProgressOverview(): Promise<StudentProgressOverview> {
  try {
    const response = await api.get('/progress/student/overview');
    return response.data;
  } catch (error) {
    throw new Error('Failed to get student progress overview');
  }
}

export async function getStudentProgressOverviewById(studentId: string): Promise<StudentProgressOverview> {
  try {
    const response = await api.get(`/progress/student/${studentId}/overview`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to get student progress overview');
  }
}

export async function getDailyStreak(): Promise<DailyStreakInfo> {
  try {
    const response = await api.get('/progress/my-streak');
    return response.data;
  } catch (error) {
    throw new Error('Failed to get daily streak info');
  }
}

export async function getStudentProgress(studentId: string): Promise<any[]> {
  try {
    const response = await api.get(`/progress/student/${studentId}`);
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch student progress:', error);
    return [];
  }
}

export async function getProgressStudents(): Promise<any[]> {
  try {
    const response = await api.get('/progress/students');
    return response.data;
  } catch (error) {
    console.error('Failed to get progress students:', error);
    throw error;
  }
}

// Legacy compatibility
export const markLectureComplete = (lectureId: string): Promise<any> => markLessonComplete(lectureId);

export const isLectureCompleted = (lectureId: string) => {
  console.warn('isLectureCompleted is deprecated - use isLessonCompleted');
  return isLessonCompleted(lectureId);
};

export function getCourseProgressLegacy(_courseId: string): number {
  console.warn('getCourseProgressLegacy is deprecated - use getCourseProgress(courseId, studentId)');
  return 0;
}

export function getCourseStatus(_courseId: string): string {
  console.warn('getCourseStatus needs updating to use new API');
  return 'not-started';
}
