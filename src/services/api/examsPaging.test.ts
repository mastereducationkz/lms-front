import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const put = vi.fn();
vi.mock('./client', () => ({
  api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) },
}));

import { EXAM_RESULTS_PAGE, addResultSections, getAllExamResults } from './exams';

const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ student: { student_id: from + i } }));
const offsets = () => get.mock.calls.map((c) => (c[1] as { params: { offset: number; limit: number } }).params);

beforeEach(() => { get.mockReset(); put.mockReset(); });

describe('getAllExamResults (November 2026: one 500-row page hid 79 of 98 «03.10» sitters)', () => {
  it('reads page after page until a short one', async () => {
    get.mockResolvedValueOnce({ data: rows(EXAM_RESULTS_PAGE) })
      .mockResolvedValueOnce({ data: rows(EXAM_RESULTS_PAGE, EXAM_RESULTS_PAGE) })
      .mockResolvedValueOnce({ data: rows(389, 2 * EXAM_RESULTS_PAGE) });
    const all = await getAllExamResults({ examType: 'sat', groupState: 'all', exactDate: '2026-10-03' });
    expect(all).toHaveLength(2 * EXAM_RESULTS_PAGE + 389);
    expect(offsets().map((p) => [p.offset, p.limit])).toEqual([
      [0, EXAM_RESULTS_PAGE], [EXAM_RESULTS_PAGE, EXAM_RESULTS_PAGE], [2 * EXAM_RESULTS_PAGE, EXAM_RESULTS_PAGE],
    ]);
    expect(get.mock.calls[0][1]).toMatchObject({ params: { exact_date: '2026-10-03', group_state: 'all' } });
  });

  it('stops after one call when everything fits', async () => {
    get.mockResolvedValueOnce({ data: rows(3) });
    expect(await getAllExamResults({ examType: 'sat' })).toHaveLength(3);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('addResultSections', () => {
  it('puts the breakdown on the result', async () => {
    put.mockResolvedValueOnce({ data: { id: 7 } });
    await addResultSections(7, { verbal_score: 720, math_score: 730 });
    expect(put).toHaveBeenCalledWith('/exams/results/7/sections', { verbal_score: 720, math_score: 730 });
  });
});
