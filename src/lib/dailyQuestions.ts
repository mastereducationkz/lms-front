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

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
export type OptionLetter = (typeof OPTION_LETTERS)[number];

export interface QuestionOption {
  letter: OptionLetter;
  text: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

/** An option image as the page may load it: https only (an http URL from behind the SAT
 *  proxy would be blocked as mixed content, so it is upgraded), anything else dropped. */
export function optionImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (url.startsWith('https://')) return url;
  if (url.startsWith('http://')) return 'https://' + url.slice('http://'.length);
  return null;
}

/** The options a question actually has, A–E. An option exists when it has text OR an image
 *  (SAT #65 allows image-only options), so a blank-text option with an image is kept. */
export function questionOptions(q: DailyQuestionItem): QuestionOption[] {
  const out: QuestionOption[] = [];
  for (const letter of OPTION_LETTERS) {
    const text = (q[`option${letter}` as keyof DailyQuestionItem] as string | null | undefined) ?? '';
    const imageUrl = optionImageUrl(q[`option${letter}ImageUrl` as keyof DailyQuestionItem]);
    if (!text.trim() && !imageUrl) continue;
    const alt = q[`option${letter}ImageAlt` as keyof DailyQuestionItem] as string | null | undefined;
    out.push({ letter, text, imageUrl, imageAlt: alt?.trim() || null });
  }
  return out;
}

/** Multiple choice when the SAT says so, or when the question has at least two options. */
export function isMultipleChoice(q: DailyQuestionItem): boolean {
  return !!q.isMultipleChoice || q.questionType === 'Multiple Choice' || questionOptions(q).length >= 2;
}

/** «reading_comprehension» → «Reading Comprehension». The SAT omits null fields from its JSON,
 *  so an untagged question arrives with no primaryTag at all (LMS-FRONT-7/8/9: `.replace` on
 *  undefined took the whole student dashboard down on iOS). */
export function formatTag(tag: unknown): string {
  if (typeof tag !== 'string' || !tag.trim()) return '';
  return tag.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function difficultyLabel(difficulty: unknown): string {
  switch (difficulty) {
    case 'easy': return 'Easy';
    case 'medium': return 'Medium';
    case 'hard': return 'Hard';
    default: return typeof difficulty === 'string' ? difficulty : '';
  }
}
