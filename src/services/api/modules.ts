import type { CourseModule } from '../../types';
import { api } from './client';

export async function getCourseModules(courseId: string, includeLessons: boolean = false, studentId?: string): Promise<CourseModule[]> {
  try {
    const params: any = {};
    if (includeLessons) params.include_lessons = 'true';
    if (studentId && studentId !== 'me') {
      params.student_id = studentId;
    }
    const response = await api.get(`/courses/${courseId}/modules`, { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load modules');
  }
}

export async function createModule(courseId: string, moduleData: any): Promise<CourseModule> {
  try {
    const response = await api.post(`/courses/${courseId}/modules`, moduleData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to create module');
  }
}

export async function updateModule(courseId: string, moduleId: number, moduleData: any): Promise<CourseModule> {
  try {
    const response = await api.put(`/courses/${courseId}/modules/${moduleId}`, moduleData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to update module');
  }
}

export async function deleteModule(courseId: string, moduleId: number): Promise<void> {
  try {
    await api.delete(`/courses/${courseId}/modules/${moduleId}`);
  } catch (error) {
    throw new Error('Failed to delete module');
  }
}

// Legacy compatibility
export const fetchModulesByCourse = (courseId: string, includeLessons: boolean = false): Promise<CourseModule[]> => {
  return getCourseModules(courseId, includeLessons);
};

export async function fetchModuleById(_moduleId: string): Promise<CourseModule | null> {
  console.warn('fetchModuleById needs course context');
  return null;
}

export function getModuleProgress(_moduleId: string): number {
  console.warn('getModuleProgress needs course context - use getMyProgress');
  return 0;
}
