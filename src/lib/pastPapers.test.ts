import { describe, expect, it } from 'vitest';
import { hasPastPaperTask, isPastPaperOnly, pastPaperDueDateMissing, sectionTotals } from './pastPapers';

const paper = { task_type: 'sat_past_paper_task' };
const text = { task_type: 'text_task' };

describe('past paper homework rules', () => {
  it('spots a past-paper task, and a homework made only of them', () => {
    expect(hasPastPaperTask([text, paper])).toBe(true);
    expect(hasPastPaperTask([text])).toBe(false);
    expect(isPastPaperOnly([paper, paper])).toBe(true);
    expect(isPastPaperOnly([paper, text])).toBe(false);
    expect(isPastPaperOnly([])).toBe(false);
  });

  it('needs a due date only when a past paper is in the homework', () => {
    expect(pastPaperDueDateMissing({ group_ids: [1] }, [text])).toBe(false);
    expect(pastPaperDueDateMissing({ group_ids: [1] }, [paper])).toBe(true);
  });

  it('accepts the shared due date or one per group', () => {
    expect(pastPaperDueDateMissing({ due_date: '2026-11-01T10:00:00Z', group_ids: [1, 2] }, [paper])).toBe(false);
    expect(pastPaperDueDateMissing({ due_date_mapping: { 1: 'x', 2: 'y' }, group_ids: [1, 2] }, [paper])).toBe(false);
    expect(pastPaperDueDateMissing({ due_date_mapping: { 1: 'x' }, group_ids: [1, 2] }, [paper])).toBe(true);
  });

  it('adds up the sections a paper has', () => {
    expect(sectionTotals({ correct: 40, total: 54, scaled_estimate: 700 }, { correct: 30, total: 44, scaled_estimate: 650 })).toEqual({ correct: 70, total: 98 });
    expect(sectionTotals(null, { correct: 5, total: 22, scaled_estimate: null })).toEqual({ correct: 5, total: 22 });
  });
});
