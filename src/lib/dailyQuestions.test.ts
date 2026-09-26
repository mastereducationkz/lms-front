import { describe, expect, it } from 'vitest';
import {
  collectUsableQuestions,
  dailyQuestionsView,
  shouldCacheRecommendations,
  usableQuestions,
} from './dailyQuestions';
import type { DailyQuestionItem, DailyQuestionsRecommendations } from '../types';

function question(overrides: Partial<DailyQuestionItem> = {}): DailyQuestionItem {
  return {
    questionId: 1,
    text: 'What is 2 + 2?',
    primaryTag: 'algebra',
    difficulty: 'easy',
    ...overrides,
  };
}

function recs(overrides: Partial<DailyQuestionsRecommendations> = {}): DailyQuestionsRecommendations {
  return {
    email: 'student@example.com',
    studentName: 'Student',
    ...overrides,
  };
}

describe('usableQuestions / shouldCacheRecommendations', () => {
  it('is 0 and uncacheable for null or undefined recommendations', () => {
    expect(usableQuestions(null)).toBe(0);
    expect(usableQuestions(undefined)).toBe(0);
    expect(shouldCacheRecommendations(null)).toBe(false);
    expect(shouldCacheRecommendations(undefined)).toBe(false);
  });

  it('is 0 and uncacheable for the new backend\'s empty 200 shape', () => {
    // mathRecommendations/verbalRecommendations null or missing questions entirely.
    const empty = recs({ mathRecommendations: undefined, verbalRecommendations: undefined });
    expect(usableQuestions(empty)).toBe(0);
    expect(shouldCacheRecommendations(empty)).toBe(false);

    const emptyLists = recs({
      mathRecommendations: { questions: [], reasoning: '' },
      verbalRecommendations: { questions: [], reasoning: '' },
    });
    expect(usableQuestions(emptyLists)).toBe(0);
    expect(shouldCacheRecommendations(emptyLists)).toBe(false);
  });

  it('is 0 and uncacheable when every question fails the validity filter', () => {
    const allInvalid = recs({
      mathRecommendations: {
        questions: [
          question({ text: '' }),
          question({ text: '\\\\' }),
          question({ text: '\\' }),
          question({ text: '//' }),
          question({ text: '   ' }),
        ],
        reasoning: '',
      },
    });
    expect(usableQuestions(allInvalid)).toBe(0);
    expect(shouldCacheRecommendations(allInvalid)).toBe(false);
  });

  it('counts a question with valid text as usable and cacheable', () => {
    const withText = recs({
      mathRecommendations: { questions: [question()], reasoning: '' },
    });
    expect(usableQuestions(withText)).toBe(1);
    expect(shouldCacheRecommendations(withText)).toBe(true);
  });

  it('counts an image-only question (no valid text) as usable', () => {
    const withImage = recs({
      verbalRecommendations: {
        questions: [question({ text: '', imageUrl: 'https://example.com/q.png' })],
        reasoning: '',
      },
    });
    expect(usableQuestions(withImage)).toBe(1);
    expect(shouldCacheRecommendations(withImage)).toBe(true);
  });

  it('does not count a question whose imageUrl is the literal string "None"', () => {
    const noneImage = recs({
      mathRecommendations: { questions: [question({ text: '', imageUrl: 'None' })], reasoning: '' },
    });
    expect(usableQuestions(noneImage)).toBe(0);
  });

  it('combines math + verbal counts and drops only the invalid ones', () => {
    const mixed = recs({
      mathRecommendations: { questions: [question({ questionId: 1 }), question({ questionId: 2, text: '' })], reasoning: '' },
      verbalRecommendations: { questions: [question({ questionId: 3 }), question({ questionId: 4, text: '\\' })], reasoning: '' },
    });
    expect(usableQuestions(mixed)).toBe(2);
    expect(collectUsableQuestions(mixed).map((q) => q.questionId)).toEqual([1, 3]);
  });

  it('tags collected questions with their section', () => {
    const mixed = recs({
      mathRecommendations: { questions: [question({ questionId: 1 })], reasoning: '' },
      verbalRecommendations: { questions: [question({ questionId: 2 })], reasoning: '' },
    });
    const collected = collectUsableQuestions(mixed);
    expect(collected).toEqual([
      { ...question({ questionId: 1 }), section: 'math' },
      { ...question({ questionId: 2 }), section: 'verbal' },
    ]);
  });
});

describe('dailyQuestionsView', () => {
  const base = { loading: false, errorStatus: null, questionsCount: 0, completedToday: false };

  it('shows loading first, regardless of everything else', () => {
    expect(dailyQuestionsView({ ...base, loading: true, errorStatus: 404, completedToday: true, questionsCount: 5 })).toBe('loading');
  });

  it('maps a 404 (old backend, no SAT data) to empty', () => {
    expect(dailyQuestionsView({ ...base, errorStatus: 404 })).toBe('empty');
  });

  it('maps a 200 with zero usable questions (new backend) to empty', () => {
    expect(dailyQuestionsView({ ...base, errorStatus: null, questionsCount: 0 })).toBe('empty');
  });

  it('maps a 500 (a real failure) to error, not empty', () => {
    expect(dailyQuestionsView({ ...base, errorStatus: 500 })).toBe('error');
  });

  it('maps any other non-404 error status to error', () => {
    expect(dailyQuestionsView({ ...base, errorStatus: -1 })).toBe('error');
  });

  it('shows results once completed today, even with zero questions on this render', () => {
    expect(dailyQuestionsView({ ...base, completedToday: true, questionsCount: 0 })).toBe('results');
  });

  it('shows results even if an error status is somehow still set once completed', () => {
    expect(dailyQuestionsView({ ...base, completedToday: true, errorStatus: 404 })).toBe('results');
  });

  it('shows questions when there are some and nothing else is wrong', () => {
    expect(dailyQuestionsView({ ...base, questionsCount: 3 })).toBe('questions');
  });
});
