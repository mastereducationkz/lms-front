/**
 * Guard rails for the answer keys a teacher saves in the quiz editor (owner decisions, 2026-10-09).
 *
 * A production audit found 88 of 2 912 choice questions whose key and flagged option disagree or
 * that flag nothing: the editor keeps the answer key as an index and never kept the per-option
 * `is_correct` flag in step with it. And for typed answers, a key like `4.666` (a cut-off 14/3)
 * was the most common reason a right answer, `4.67`, was marked wrong. These helpers are pure; the
 * editor only calls them.
 */
import { matchesAnyAnswer, numericValue, splitAlternatives } from '@/components/lesson/quiz/answerMatch';

const CHOICE_TYPES = ['single_choice', 'media_question', 'multiple_choice'];

interface ChoiceLike {
  question_type?: string;
  options?: { is_correct?: boolean }[] | null;
  correct_answer?: unknown;
}

/** The option indexes the answer key points at, or null when it points at none. */
function keyIndexes(question: ChoiceLike): number[] | null {
  const key = question.correct_answer;
  if (Array.isArray(key)) return key.filter((i): i is number => typeof i === 'number' && i >= 0);
  return typeof key === 'number' && key >= 0 ? [key] : null;
}

/**
 * True when some option is flagged correct and the flags are not the set the key points at. A question
 * with no flag at all is fine: the editor never sets one, and the grader reads only the key.
 */
export function flagsDisagreeWithKey(question: ChoiceLike): boolean {
  if (!CHOICE_TYPES.includes(question.question_type ?? '') || !question.options) return false;
  const flagged = question.options.flatMap((option, index) => (option?.is_correct ? [index] : []));
  if (flagged.length === 0) return false;
  const key = keyIndexes(question) ?? [];
  return flagged.length !== key.length || flagged.some((index) => !key.includes(index));
}

/** The question with its option flags set from the answer key, so the two can never drift apart. */
export function withFlagsFromKey<T extends ChoiceLike>(question: T): T {
  if (!CHOICE_TYPES.includes(question.question_type ?? '') || !question.options) return question;
  const key = keyIndexes(question);
  if (key === null) return question;
  return { ...question, options: question.options.map((option, index) => ({ ...option, is_correct: key.includes(index) })) };
}

/** Alternatives that look like a repeating decimal cut off (`4.666`): students round it (`4.67`). */
export function truncatedDecimalKeys(key: unknown): string[] {
  return splitAlternatives(key).filter((alternative) => /^[+-]?\d*\.\d*([1-9])\1{2,}$/.test(alternative));
}

const groupedThousands = (value: number, separator: string): string =>
  Math.abs(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    .replace(/^/, value < 0 ? '-' : '');

/**
 * The other ways of writing the key that the grader accepts, for a short line under the key inputs.
 * Candidates are built here, but every one is run through the real matcher before it is shown, so
 * the line cannot promise a form the grader would refuse.
 */
export function acceptedFormsPreview(key: unknown, limit = 6): string[] {
  const alternatives = splitAlternatives(key);
  const shown = new Set(alternatives.map((alternative) => alternative.toLowerCase()));
  const forms: string[] = [];
  const offer = (candidate: string) => {
    const lower = candidate.toLowerCase();
    if (!candidate || shown.has(lower) || !matchesAnyAnswer(key, candidate)) return;
    shown.add(lower);
    forms.push(candidate);
  };
  for (const alternative of alternatives) {
    const value = numericValue(alternative);
    if (value === null || !/^[+-]?[\d.,]+$/.test(alternative)) continue;
    if (alternative.startsWith('0.')) offer(alternative.slice(1));
    if (alternative.includes('.')) offer(alternative.replace('.', ','));
    if (Number.isInteger(value) && Math.abs(value) >= 1000 && /^[+-]?\d+$/.test(alternative)) {
      offer(groupedThousands(value, ','));
      offer(groupedThousands(value, ' '));
      offer(groupedThousands(value, '.'));
    }
  }
  return forms.slice(0, limit);
}
