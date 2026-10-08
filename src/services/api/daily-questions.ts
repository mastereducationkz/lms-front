import type { DailyQuestionsStatus, DailyQuestionsRecommendations } from '../../types';
import { api } from './client';

export async function getDailyQuestionsStatus(): Promise<DailyQuestionsStatus> {
  try {
    const response = await api.get('/daily-questions/status');
    return response.data;
  } catch (error) {
    console.error('Failed to get daily questions status:', error);
    throw error;
  }
}

export async function getDailyQuestionsRecommendations(): Promise<DailyQuestionsRecommendations> {
  try {
    const response = await api.get('/daily-questions/recommendations');
    return response.data;
  } catch (error) {
    console.error('Failed to get daily question recommendations:', error);
    throw error;
  }
}

export async function completeDailyQuestions(questionsData?: Record<string, any>): Promise<{ message: string; completed_today: boolean }> {
  try {
    // The server reads the score from the top level of the body; sent only inside questions_data it
    // never arrived, and every completion paid the 10-star minimum.
    const response = await api.post('/daily-questions/complete', {
      questions_data: questionsData || null,
      score: questionsData?.score,
      total_questions: questionsData?.total_questions,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to complete daily questions:', error);
    throw error;
  }
}
