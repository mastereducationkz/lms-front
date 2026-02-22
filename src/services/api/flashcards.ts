import { api } from './client';

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
    throw new Error(error.response?.data?.detail || 'Failed to add flashcard to favorites');
  }
}

export async function getFavoriteFlashcards(): Promise<any[]> {
  try {
    const response = await api.get('/flashcards/favorites');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to load favorite flashcards');
  }
}

export async function removeFavoriteFlashcard(favoriteId: number): Promise<void> {
  try {
    await api.delete(`/flashcards/favorites/${favoriteId}`);
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to remove flashcard from favorites');
  }
}

export async function removeFavoriteByCardId(stepId: number, flashcardId: string): Promise<void> {
  try {
    await api.delete(`/flashcards/favorites/by-card/${stepId}/${flashcardId}`);
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to remove flashcard from favorites');
  }
}

export async function checkIsFavorite(stepId: number, flashcardId: string): Promise<{ is_favorite: boolean; favorite_id: number | null }> {
  try {
    const response = await api.get(`/flashcards/favorites/check/${stepId}/${flashcardId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to check favorite status');
  }
}

export async function lookupWord(text: string, contextSentence?: string): Promise<{
  word: string;
  phonetic: string | null;
  part_of_speech: string | null;
  definition_en: string;
  translation_ru: string;
  synonyms: string[];
  usage_example: string | null;
  etymology: string | null;
}> {
  try {
    const response = await api.post('/ai-tools/lookup', {
      text,
      context_sentence: contextSentence
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to lookup word');
  }
}

export async function quickCreateFlashcard(data: {
  word: string;
  translation: string;
  definition?: string;
  context?: string;
  phonetic?: string;
}): Promise<{ success: boolean; message: string; flashcard_id: string; favorite_id: number }> {
  try {
    const response = await api.post('/flashcards/quick_create', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to create flashcard');
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
