import { describe, expect, it } from 'vitest';
import { finalExamView, type BluebookFinalExam } from './bluebookFinalExam';

const result: BluebookFinalExam = {
  total_score: 1400, verbal_score: 700, math_score: 700, test_date: '2026-10-03',
  planned_test_date: null, status: 'verified', change_vs_baseline: 150,
};

describe('finalExamView', () => {
  it('is empty without a result or a planned date', () => {
    expect(finalExamView(null)).toEqual({ kind: 'none' });
    expect(finalExamView(undefined)).toEqual({ kind: 'none' });
  });

  it('a result: the total, Verbal and Math under it, the date, the change', () => {
    expect(finalExamView(result)).toEqual({
      kind: 'result', total: '1400', detail: 'V 700 · M 700', date: '03.10.2026', verified: true, change: '150',
    });
  });

  it('a total without sections has no detail line', () => {
    const view = finalExamView({ ...result, verbal_score: null, math_score: null });
    expect(view).toMatchObject({ kind: 'result', detail: null });
  });

  it('only a verified status counts as verified', () => {
    expect(finalExamView({ ...result, status: 'reported' })).toMatchObject({ verified: false });
    expect(finalExamView({ ...result, status: null })).toMatchObject({ verified: false });
  });

  it('keeps a negative or missing change as sent', () => {
    expect(finalExamView({ ...result, change_vs_baseline: -50 })).toMatchObject({ change: '-50' });
    expect(finalExamView({ ...result, change_vs_baseline: null })).toMatchObject({ change: null });
  });

  it('with no result the planned date stands in', () => {
    const planned: BluebookFinalExam = {
      total_score: null, verbal_score: null, math_score: null, test_date: null,
      planned_test_date: '2026-10-17', status: null, change_vs_baseline: null,
    };
    expect(finalExamView(planned)).toEqual({ kind: 'planned', date: '17.10.2026' });
  });

  it('a malformed date is shown as sent rather than dropped', () => {
    expect(finalExamView({ ...result, test_date: 'soon' })).toMatchObject({ date: 'soon' });
  });
});
