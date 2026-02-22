import { api } from './client';

export async function getHeadTeacherManagedCourses(): Promise<Array<{
  id: number;
  title: string;
  description: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  is_active: boolean;
  created_at: string;
}>> {
  try {
    const response = await api.get('/head-teacher/courses');
    return response.data;
  } catch (error) {
    console.error('Failed to get head teacher managed courses:', error);
    throw error;
  }
}

export async function getHeadTeacherCourseTeachers(
  courseId: number,
  days: number = 30,
  startDate?: string,
  endDate?: string
): Promise<{
  course_id: number;
  course_title: string;
  date_range_start: string | null;
  date_range_end: string | null;
  teachers: Array<{
    teacher_id: number;
    teacher_name: string;
    email: string;
    last_activity_date: string | null;
    groups_count: number;
    students_count: number;
    checked_homeworks_count: number;
    total_submissions_count: number;
    feedbacks_given_count: number;
    avg_grading_time_hours: number | null;
    quizzes_graded_count: number;
    homeworks_checked_last_7_days: number;
    homeworks_checked_last_30_days: number;
  }>;
  daily_activity: Array<{ date: string; submissions_graded: number }>;
}> {
  try {
    const params: any = { days };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await api.get(`/head-teacher/course/${courseId}/teachers`, {
      params
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get course teacher statistics:', error);
    throw error;
  }
}

export async function getHeadTeacherTeacherDetails(courseId: number, teacherId: number, days: number = 30): Promise<{
  teacher_id: number;
  teacher_name: string;
  email: string;
  avatar_url: string | null;
  groups_count: number;
  students_count: number;
  grade_distribution: Array<{ score_range: string; count: number }>;
  activity_history: Array<{ date: string; submissions_graded: number }>;
  total_feedbacks: number;
  avg_score_given: number | null;
}> {
  try {
    const response = await api.get(`/head-teacher/course/${courseId}/teacher/${teacherId}/details`, {
      params: { days }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get teacher details:', error);
    throw error;
  }
}

export async function getHeadTeacherTeacherFeedbacks(
  courseId: number,
  teacherId: number,
  skip: number = 0,
  limit: number = 20
): Promise<{
  teacher_id: number;
  teacher_name: string;
  feedbacks: Array<{
    submission_id: number;
    student_name: string;
    assignment_title: string;
    score: number | null;
    max_score: number;
    feedback: string;
    graded_at: string;
  }>;
  total: number;
}> {
  try {
    const response = await api.get(
      `/head-teacher/course/${courseId}/teacher/${teacherId}/feedbacks`,
      { params: { skip, limit } }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to get teacher feedbacks:', error);
    throw error;
  }
}

export async function getHeadTeacherTeacherAssignments(
  courseId: number,
  teacherId: number,
  skip: number = 0,
  limit: number = 20
): Promise<{
  teacher_id: number;
  teacher_name: string;
  assignments: Array<{
    assignment_id: number;
    title: string;
    group_name: string;
    due_date: string | null;
    total_submissions: number;
    graded_submissions: number;
    created_at: string;
  }>;
  total: number;
}> {
  try {
    const response = await api.get(
      `/head-teacher/course/${courseId}/teacher/${teacherId}/assignments`,
      { params: { skip, limit } }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to get teacher assignments:', error);
    throw error;
  }
}
