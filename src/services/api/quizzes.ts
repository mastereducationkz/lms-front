import { api } from './client';

export async function fetchQuizzes() {
  console.warn('fetchQuizzes is not implemented in the backend yet');
  return [
    {
      id: 1,
      title: 'Sample Quiz',
      question_media: ["pdf", "jpg", "png", "gif", "webp", "mp3", "wav", "ogg", "m4a"]
    }
  ];
}

export async function fetchQuizById(quizId: string): Promise<any> {
  console.warn('fetchQuizById is not implemented in the backend yet');
  return {
    id: quizId,
    title: 'Sample Quiz',
    description: 'This quiz functionality needs to be implemented',
    questions: []
  };
}

export function getQuizAttemptsLeft(_quizId: string): number {
  console.warn('getQuizAttemptsLeft is not implemented');
  return 3;
}

export async function submitQuiz(_quizId: string, _answers: any, score: number): Promise<any> {
  console.warn('submitQuiz is not implemented in the backend yet');
  return { success: true, score: score };
}

export async function saveQuizAttempt(attemptData: {
  step_id: number;
  course_id: number;
  lesson_id: number;
  quiz_title?: string;
  total_questions: number;
  correct_answers?: number;
  score_percentage?: number;
  answers?: string;
  time_spent_seconds?: number;
  is_graded?: boolean;
  is_draft?: boolean;
  current_question_index?: number;
}): Promise<any> {
  try {
    const response = await api.post('/progress/quiz-attempt', attemptData);
    return response.data;
  } catch (error) {
    console.error('Failed to save quiz attempt:', error);
    throw error;
  }
}

export async function updateQuizAttempt(attemptId: number, updateData: {
  answers?: string;
  current_question_index?: number;
  time_spent_seconds?: number;
  is_draft?: boolean;
  correct_answers?: number;
  score_percentage?: number;
  is_graded?: boolean;
  total_questions?: number;
}): Promise<any> {
  try {
    const response = await api.patch(`/progress/quiz-attempts/${attemptId}`, updateData);
    return response.data;
  } catch (error) {
    console.error('Failed to update quiz attempt:', error);
    throw error;
  }
}

export async function gradeQuizAttempt(attemptId: number, gradeData: {
  score_percentage: number;
  correct_answers: number;
  feedback?: string;
}): Promise<any> {
  try {
    const response = await api.put(`/progress/quiz-attempts/${attemptId}/grade`, gradeData);
    return response.data;
  } catch (error) {
    console.error('Failed to grade quiz attempt:', error);
    throw error;
  }
}

export async function deleteQuizAttempt(attemptId: number): Promise<void> {
  try {
    await api.delete(`/progress/quiz-attempts/${attemptId}`);
  } catch (error) {
    console.error('Failed to delete quiz attempt:', error);
    throw error;
  }
}

export async function getUngradedQuizAttempts(): Promise<any[]> {
  try {
    const response = await api.get('/progress/quiz-attempts/ungraded');
    return response.data;
  } catch (error) {
    console.error('Failed to get ungraded quiz attempts:', error);
    throw error;
  }
}

export async function getGradedQuizAttempts(): Promise<any[]> {
  try {
    const response = await api.get('/progress/quiz-attempts/ungraded?graded=true');
    return response.data;
  } catch (error) {
    console.error('Failed to get graded quiz attempts:', error);
    throw error;
  }
}

export async function getLessonQuizSummary(lessonId: string): Promise<any> {
  try {
    const response = await api.get(`/progress/lessons/${lessonId}/quiz-summary`);
    return response.data;
  } catch (error) {
    console.error('Failed to get lesson quiz summary:', error);
    throw error;
  }
}

export async function getStepQuizAttempts(stepId: number): Promise<any[]> {
  try {
    const response = await api.get(`/progress/quiz-attempts/step/${stepId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get quiz attempts:', error);
    throw error;
  }
}

export async function getCourseQuizAttempts(courseId: number): Promise<any[]> {
  try {
    const response = await api.get(`/progress/quiz-attempts/course/${courseId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get course quiz attempts:', error);
    throw error;
  }
}

export async function getCourseQuizAnalytics(courseId: number): Promise<any> {
  try {
    const response = await api.get(`/progress/quiz-attempts/analytics/course/${courseId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get course quiz analytics:', error);
    throw error;
  }
}

export async function getStudentQuizAnalytics(studentId: number, courseId?: number): Promise<any> {
  try {
    const url = courseId
      ? `/progress/quiz-attempts/analytics/student/${studentId}?course_id=${courseId}`
      : `/progress/quiz-attempts/analytics/student/${studentId}`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Failed to get student quiz analytics:', error);
    throw error;
  }
}
