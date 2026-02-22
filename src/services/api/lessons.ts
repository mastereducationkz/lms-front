import type { Lesson, Step } from '../../types';
import { api } from './client';

export async function getModuleLessons(courseId: string, moduleId: number): Promise<Lesson[]> {
  try {
    const response = await api.get(`/courses/${courseId}/modules/${moduleId}/lessons`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load lessons');
  }
}

export async function getLesson(lessonId: string): Promise<Lesson> {
  try {
    const response = await api.get(`/courses/lessons/${lessonId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load lesson');
  }
}

export async function checkLessonAccess(lessonId: string): Promise<{ accessible: boolean; reason?: string }> {
  try {
    const response = await api.get(`/courses/lessons/${lessonId}/check-access`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to check lesson access');
  }
}

export async function getLessonTyped(lessonId: string): Promise<{type: string, data: any}> {
  try {
    const response = await api.get(`/courses/lessons/${lessonId}/typed`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load lesson');
  }
}

export async function createLesson(courseId: string, moduleId: number, lessonData: any): Promise<Lesson> {
  try {
    const response = await api.post(`/courses/${courseId}/modules/${moduleId}/lessons`, lessonData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to create lesson');
  }
}

export async function updateLesson(lessonId: string, lessonData: any): Promise<Lesson> {
  try {
    const response = await api.put(`/courses/lessons/${lessonId}`, lessonData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to update lesson');
  }
}

export async function deleteLesson(lessonId: string): Promise<void> {
  try {
    await api.delete(`/courses/lessons/${lessonId}`);
  } catch (error) {
    throw new Error('Failed to delete lesson');
  }
}

export async function splitLesson(courseId: string, lessonId: string, afterStepIndex: number): Promise<{ message: string; original_lesson_id: number; new_lesson_id: number; new_lesson_title: string; steps_moved: number }> {
  try {
    const response = await api.post(`/courses/courses/${courseId}/lessons/${lessonId}/split`, {
      after_step_index: afterStepIndex
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to split lesson');
  }
}

// Step management
export async function getLessonSteps(lessonId: string, includeContent: boolean = true): Promise<Step[]> {
  try {
    const params = { include_content: includeContent };
    const response = await api.get(`/courses/lessons/${lessonId}/steps`, { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to get lesson steps');
  }
}

export async function createStep(lessonId: string, stepData: any): Promise<Step> {
  try {
    const response = await api.post(`/courses/lessons/${lessonId}/steps`, stepData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to create step');
  }
}

export async function getStep(stepId: string): Promise<Step> {
  try {
    const response = await api.get(`/courses/steps/${stepId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to get step');
  }
}

export async function updateStep(stepId: string, stepData: any): Promise<Step> {
  try {
    const response = await api.put(`/courses/steps/${stepId}`, stepData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to update step');
  }
}

export async function deleteStep(stepId: string): Promise<void> {
  try {
    await api.delete(`/courses/steps/${stepId}`);
  } catch (error) {
    throw new Error('Failed to delete step');
  }
}

export async function reorderSteps(lessonId: string, stepIds: number[]): Promise<void> {
  try {
    await api.post(`/courses/lessons/${lessonId}/reorder-steps`, {
      step_ids: stepIds
    });
  } catch (error) {
    throw new Error('Failed to reorder steps');
  }
}

export async function uploadStepAttachment(stepId: string, file: File): Promise<{
  attachment_id: number;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/media/steps/${stepId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to upload step attachment');
  }
}

export async function deleteStepAttachment(stepId: string, attachmentId: number): Promise<void> {
  try {
    await api.delete(`/media/steps/${stepId}/attachments/${attachmentId}`);
  } catch (error) {
    throw new Error('Failed to delete step attachment');
  }
}

// Legacy compatibility
export async function fetchLesson(lessonId: string): Promise<Lesson> {
  try {
    const response = await api.get(`/courses/lessons/${lessonId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch lesson');
  }
}

export const fetchLectureById = (lectureId: string): Promise<Lesson> => getLesson(lectureId);
