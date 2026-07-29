import { api } from './client';

export interface FavoriteStepItem {
  id: number;
  step_id: number;
  lesson_id: number;
  course_id: number;
  course_title: string;
  lesson_title: string;
  order_index: number;
  step_title: string;
  content_type: string;
  created_at: string | null;
}

export async function addFavoriteStep(stepId: number): Promise<FavoriteStepItem> {
  try {
    const response = await api.post('/favorite-steps', { step_id: stepId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to save page to favorites');
  }
}

export async function removeFavoriteStep(stepId: number): Promise<void> {
  try {
    await api.delete(`/favorite-steps/${stepId}`);
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to remove page from favorites');
  }
}

export async function getFavoriteSteps(): Promise<FavoriteStepItem[]> {
  try {
    const response = await api.get('/favorite-steps');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to load saved pages');
  }
}

export async function checkStepIsFavorite(
  stepId: number
): Promise<{ is_favorite: boolean; favorite_id: number | null }> {
  try {
    const response = await api.get(`/favorite-steps/check/${stepId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to check favorite status');
  }
}
