import type { DailyQuestionItem, DailyQuestionsRecommendations } from '../types';

export type QuestionWithSection = DailyQuestionItem & { section: 'math' | 'verbal' };

// A question the SAT platform sent back with no usable content (blank text, a bare
// LaTeX escape, and no image) — the same filter DailyQuestionsPopup has always applied
// before adding a question to the on-screen list.
function isUsableQuestion(q: DailyQuestionItem): boolean {
  const hasValidText = !!q.text && q.text !== '\\\\' && q.text !== '\\' && q.text !== '//' && q.text.trim() !== '';
  const hasImage = !!q.imageUrl && q.imageUrl !== 'None';
  return hasValidText || hasImage;
}

/** Combines math + verbal recommendations into one list, dropping unusable questions. */
export function collectUsableQuestions(
  recs: DailyQuestionsRecommendations | null | undefined,
): QuestionWithSection[] {
  if (!recs) return [];
  const math = recs.mathRecommendations?.questions ?? [];
  const verbal = recs.verbalRecommendations?.questions ?? [];
  return [
    ...math.filter(isUsableQuestion).map((q) => ({ ...q, section: 'math' as const })),
    ...verbal.filter(isUsableQuestion).map((q) => ({ ...q, section: 'verbal' as const })),
  ];
}

export function usableQuestions(recs: DailyQuestionsRecommendations | null | undefined): number {
  return collectUsableQuestions(recs).length;
}

/**
 * Whether a recommendations response is worth caching for the rest of the day. A student
 * with no SAT data yet gets an empty shape back (old backend: never reaches here, it 404s
 * instead; new backend: 200 with mathRecommendations/verbalRecommendations null or
 * question-less) — caching that would leave the dialog blank all day even after the
 * student takes a test, so an empty response must never be written.
 */
export function shouldCacheRecommendations(recs: DailyQuestionsRecommendations | null | undefined): boolean {
  return usableQuestions(recs) > 0;
}

export type DailyQuestionsView = 'loading' | 'empty' | 'error' | 'questions' | 'results';

export interface DailyQuestionsViewInput {
  loading: boolean;
  /** HTTP status of the last failed fetch, or null when the last attempt didn't fail. */
  errorStatus: number | null;
  questionsCount: number;
  completedToday: boolean;
}

/**
 * Classifies what the dialog body should show. A 404 (old backend) and a 200 with zero
 * usable questions (new backend) both mean the same thing to a student — "no SAT data
 * yet" — so both land on 'empty', never on the generic error view. `completedToday` wins
 * over everything else: once a student has answered today, show their results even if
 * the questions list is empty on this render (e.g. a reload with no cached questions).
 */
export function dailyQuestionsView({
  loading,
  errorStatus,
  questionsCount,
  completedToday,
}: DailyQuestionsViewInput): DailyQuestionsView {
  if (loading) return 'loading';
  if (completedToday) return 'results';
  if (errorStatus === 404) return 'empty';
  if (errorStatus != null) return 'error';
  if (questionsCount === 0) return 'empty';
  return 'questions';
}
