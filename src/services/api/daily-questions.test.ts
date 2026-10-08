import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ default: { post }, api: { post } }));

import { completeDailyQuestions } from './daily-questions';

beforeEach(() => post.mockReset().mockResolvedValue({ data: { message: 'ok', completed_today: true } }));

// Every completion until 2026-10-09 paid the 10-star minimum: the browser nested the score inside
// questions_data, and the server read it from the top level.
describe('completeDailyQuestions', () => {
  it('sends the score where the server reads it, and keeps the whole record', async () => {
    const record = { answers: { a: 'B' }, score: 7, total_questions: 10, questions: [{ questionId: 'a' }] };
    await completeDailyQuestions(record);
    expect(post).toHaveBeenCalledWith('/daily-questions/complete', { questions_data: record, score: 7, total_questions: 10 });
  });

  it('sends a score of zero, not nothing', async () => {
    await completeDailyQuestions({ answers: {}, score: 0, total_questions: 5 });
    expect(post.mock.calls[0][1]).toMatchObject({ score: 0, total_questions: 5 });
  });

  it('sends no score when the record has none', async () => {
    await completeDailyQuestions({ answers: {} });
    expect(post.mock.calls[0][1]).toEqual({ questions_data: { answers: {} }, score: undefined, total_questions: undefined });
    await completeDailyQuestions();
    expect(post.mock.calls[1][1]).toEqual({ questions_data: null, score: undefined, total_questions: undefined });
  });
});
