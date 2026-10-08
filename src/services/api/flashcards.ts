import { api } from './client';
import { apiError } from './apiError';

export async function addFavoriteFlashcard(data: {
  step_id: number;
  flashcard_id: string;
  lesson_id?: number;
  course_id?: number;
  flashcard_data: string;
}): Promise<any> {
  try {
    const response = await api.post('/flashcards/favorites', data);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to add flashcard to favorites');
  }
}

export async function getFavoriteFlashcards(): Promise<any[]> {
  try {
    const response = await api.get('/flashcards/favorites');
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to load favorite flashcards');
  }
}

export async function removeFavoriteFlashcard(favoriteId: number): Promise<void> {
  try {
    await api.delete(`/flashcards/favorites/${favoriteId}`);
  } catch (error: any) {
    throw apiError(error, 'Failed to remove flashcard from favorites');
  }
}

export async function removeFavoriteByCardId(stepId: number, flashcardId: string): Promise<void> {
  try {
    await api.delete(`/flashcards/favorites/by-card/${stepId}/${flashcardId}`);
  } catch (error: any) {
    throw apiError(error, 'Failed to remove flashcard from favorites');
  }
}

export async function checkIsFavorite(stepId: number, flashcardId: string): Promise<{ is_favorite: boolean; favorite_id: number | null }> {
  try {
    const response = await api.get(`/flashcards/favorites/check/${stepId}/${flashcardId}`);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to check favorite status');
  }
}

/** Saves a Look Up answer: `kind: 'word'` is a vocabulary card, `'phrase'` a phrase card whose
 * back is the translation and whose hard words ride along as glosses. */
export async function quickCreateFlashcard(data: {
  kind?: 'word' | 'phrase';
  word: string;
  translation: string;
  definition?: string;
  context?: string;
  phonetic?: string;
  lang?: 'ru' | 'kk';
  glosses?: Array<{ term: string; meaning: string; note: string }>;
}): Promise<{ success: boolean; message: string; flashcard_id: string; favorite_id: number }> {
  try {
    const response = await api.post('/flashcards/quick_create', data);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to create flashcard');
  }
}

export async function getVocabularyCards(): Promise<{
  vocabulary: Array<{
    id: number;
    flashcard_id: string;
    word: string;
    translation: string;
    definition: string | null;
    context: string | null;
    phonetic: string | null;
    kind: 'word' | 'phrase';
    lang: 'ru' | 'kk' | null;
    glosses: Array<{ term: string; meaning: string; note: string }>;
    created_at: string | null;
  }>;
  count: number;
}> {
  try {
    const response = await api.get('/flashcards/vocabulary');
    return response.data;
  } catch (error) {
    console.error('Failed to get vocabulary cards:', error);
    throw error;
  }
}
