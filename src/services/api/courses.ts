import type { Course } from '../../types';
import { api } from './client';

export async function getCourses(params: Record<string, any> = {}): Promise<Course[]> {
  try {
    const response = await api.get('/courses/', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load courses');
  }
}

export async function getCourse(courseId: string): Promise<Course> {
  try {
    const response = await api.get(`/courses/${courseId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load course');
  }
}

export async function createCourse(courseData: any): Promise<Course> {
  try {
    const response = await api.post('/courses/', courseData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to create course');
  }
}

export async function updateCourse(courseId: string, courseData: any): Promise<Course> {
  try {
    const response = await api.put(`/courses/${courseId}`, courseData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to update course');
  }
}

export async function publishCourse(courseId: string): Promise<any> {
  try {
    const response = await api.post(`/courses/${courseId}/publish`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to publish course');
  }
}

export async function unpublishCourse(courseId: string): Promise<any> {
  try {
    const response = await api.post(`/courses/${courseId}/unpublish`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to unpublish course');
  }
}

export async function setCourseThumbnailUrl(courseId: string, url: string): Promise<{ cover_image_url: string }> {
  try {
    const response = await api.put(`/media/courses/${courseId}/thumbnail-url`, { url });
    return response.data;
  } catch (error) {
    throw new Error('Failed to set course thumbnail URL');
  }
}

export async function uploadCourseThumbnail(courseId: string, file: File): Promise<{ cover_image_url: string }> {
  try {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post(`/media/courses/${courseId}/thumbnail`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to upload course thumbnail');
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  try {
    await api.delete(`/courses/${courseId}`);
  } catch (error) {
    throw new Error('Failed to delete course');
  }
}

export async function enrollInCourse(courseId: string): Promise<any> {
  try {
    const response = await api.post(`/courses/${courseId}/enroll`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to enroll in course');
  }
}

export async function unenrollFromCourse(courseId: string): Promise<void> {
  try {
    const response = await api.delete(`/courses/${courseId}/enroll`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to unenroll from course');
  }
}

export async function getMyCourses(): Promise<Course[]> {
  try {
    const response = await api.get('/courses/my-courses');
    return response.data;
  } catch (error) {
    throw new Error('Failed to load my courses');
  }
}

export async function autoEnrollStudents(courseId: string): Promise<any> {
  try {
    const response = await api.post(`/courses/${courseId}/auto-enroll-students`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to auto-enroll students');
  }
}

export async function grantGroupAccess(courseId: string, groupId: string): Promise<any> {
  try {
    const response = await api.post(`/courses/${courseId}/grant-group-access/${groupId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to grant group access');
  }
}

export async function revokeGroupAccess(courseId: string, groupId: string): Promise<any> {
  try {
    const response = await api.delete(`/courses/${courseId}/revoke-group-access/${groupId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to revoke group access');
  }
}

export async function getCourseGroupAccessStatus(courseId: string): Promise<any> {
  try {
    const response = await api.get(`/courses/${courseId}/group-access-status`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to get course group access status');
  }
}

export async function getCourseTeacherAccess(courseId: string): Promise<any[]> {
  try {
    const response = await api.get(`/courses/${courseId}/teacher-access`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to get course teacher access');
  }
}

export async function grantCourseTeacherAccess(courseId: string, teacherId: string): Promise<any> {
  try {
    const response = await api.post(`/courses/${courseId}/grant-teacher-access/${teacherId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to grant teacher access');
  }
}

export async function revokeCourseTeacherAccess(courseId: string, teacherId: string): Promise<any> {
  try {
    const response = await api.delete(`/courses/${courseId}/revoke-teacher-access/${teacherId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to revoke teacher access');
  }
}

export async function getTeacherCourses(): Promise<any[]> {
  try {
    const response = await api.get('/courses/');
    return response.data;
  } catch (error) {
    console.error('Failed to get teacher courses:', error);
    throw error;
  }
}

export async function getCourseLessons(courseId: string, lightweight: boolean = false): Promise<any[]> {
  try {
    const response = await api.get(`/courses/${courseId}/lessons`, {
      params: lightweight ? { lightweight: true } : undefined
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load course lessons');
  }
}

export async function getCourseLessonsTyped(courseId: string): Promise<Array<{type: string, data: any}>> {
  try {
    const response = await api.get(`/courses/${courseId}/lessons/typed`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load course lessons');
  }
}

export async function fixLessonOrder(courseId: string): Promise<any> {
  try {
    const response = await api.post(`/courses/${courseId}/fix-lesson-order`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to fix lesson order');
  }
}

export async function addSummaryStepsToCourse(courseId: string): Promise<{ message: string; added_count: number }> {
  try {
    const response = await api.post(`/courses/${courseId}/add-summary-steps`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to add summary steps');
  }
}

export async function analyzeSatImage(imageFile: File, correctAnswers?: string): Promise<any> {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    if (correctAnswers) {
      formData.append('correct_answers', correctAnswers);
    }
    const response = await api.post('/courses/analyze-sat-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  } catch (error: any) {
    console.error('analyzeSatImage error:', error);
    throw new Error(`Failed to analyze SAT image: ${error.message || error}`);
  }
}

// Legacy compatibility aliases
export const fetchCourses = () => getCourses();
export const fetchCourseById = (courseId: string): Promise<Course> => getCourse(courseId);
