import type { Lesson } from '../../types';
import { getCourses } from './courses';
import { getCourseModules } from './modules';
import { getModuleLessons, createLesson, updateLesson, deleteLesson } from './lessons';

export async function fetchModules() {
  console.warn('fetchModules needs course context - use getCourses() instead');
  try {
    const courses = await getCourses();
    if (courses.length > 0) {
      return await getCourseModules(courses[0].id);
    }
    return [];
  } catch (error) {
    return [];
  }
}

export async function fetchLectures(_moduleId: string): Promise<any[]> {
  console.warn('fetchLectures needs course context - use getModuleLessons(courseId, moduleId)');
  return [];
}

export async function createLecture(moduleId: string, lectureData: any): Promise<any> {
  console.warn('createLecture needs course context for new API');
  try {
    const courses = await getCourses();
    const moduleIdNum = parseInt(moduleId);
    for (const course of courses) {
      try {
        const modules = await getCourseModules(course.id);
        const targetModule = modules.find(m => m.id === moduleIdNum);
        if (targetModule) {
          return await createLesson(course.id, moduleIdNum, lectureData);
        }
      } catch (err) {
        continue;
      }
    }
    throw new Error('Could not find course context for module');
  } catch (error) {
    throw new Error('Failed to create lecture');
  }
}

export async function deleteLecture(lectureId: string): Promise<void> {
  try {
    return await deleteLesson(lectureId);
  } catch (error) {
    throw new Error('Failed to delete lecture');
  }
}

export async function updateLecture(lectureId: string, lectureData: any): Promise<any> {
  try {
    return await updateLesson(lectureId, lectureData);
  } catch (error) {
    throw new Error('Failed to update lecture');
  }
}

export async function fetchLecturesByModule(moduleId: string): Promise<Lesson[]> {
  console.warn('fetchLecturesByModule needs course context - use getModuleLessons(courseId, moduleId)');
  try {
    const courses = await getCourses();
    const moduleIdNum = parseInt(moduleId);
    for (const course of courses) {
      try {
        const modules = await getCourseModules(course.id);
        const targetModule = modules.find(m => m.id === moduleIdNum);
        if (targetModule) {
          return await getModuleLessons(course.id, moduleIdNum);
        }
      } catch (err) {
        continue;
      }
    }
    return [];
  } catch (error) {
    console.warn('Failed to fetch lectures by module:', error);
    return [];
  }
}
