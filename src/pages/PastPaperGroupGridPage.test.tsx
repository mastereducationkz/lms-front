// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'teacher' } }) };
});

const getBluebookGroups = vi.fn();
vi.mock('../services/api/exams', () => ({ getBluebookGroups: (...a: unknown[]) => getBluebookGroups(...a) }));
const getPastPaperGrid = vi.fn();
vi.mock('../services/api/pastPapers', () => ({ getPastPaperGrid: (...a: unknown[]) => getPastPaperGrid(...a) }));

import PastPaperGroupGridPage from './PastPaperGroupGridPage';
import type { PastPaperGrid } from '../services/api/pastPapers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<PastPaperGroupGridPage />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
beforeEach(() => {
  getBluebookGroups.mockReset();
  getPastPaperGrid.mockReset();
  getBluebookGroups.mockResolvedValue([{ id: 3, name: 'SAT - Daniil', program_type: 'sat', teacher_id: 2, teacher_name: null, is_finished: false }]);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const grid: PastPaperGrid = {
  group: { id: 3, name: 'SAT - Daniil' },
  papers: [
    { paper_id: 7, paper_title: 'Practice Test 7', is_partial: false, assignment_ids: [11], due_date: '2026-10-28T12:00:00Z' },
    { paper_id: 9, paper_title: 'Math drill', is_partial: true, assignment_ids: [12], due_date: null },
  ],
  rows: [
    { student_id: 1, name: 'Aigerim S.', cells: {
      '7': { state: 'completed', total_scaled_estimate: 1340, rw: { correct: 40, total: 54, scaled_estimate: 680 }, math: { correct: 30, total: 44, scaled_estimate: 660 }, before_assigned: true, late: true },
      '9': { state: 'completed', total_scaled_estimate: null, rw: null, math: { correct: 15, total: 22, scaled_estimate: null }, before_assigned: false, late: false },
    } },
    { student_id: 2, name: 'Bolat K.', cells: {
      '7': { state: 'in_progress', total_scaled_estimate: null, rw: null, math: null, before_assigned: false, late: false },
      '9': { state: 'not_started', total_scaled_estimate: null, rw: null, math: null, before_assigned: false, late: false },
    } },
    { student_id: 3, name: 'Dana T.', cells: {} },
  ],
};

describe('PastPaperGroupGridPage', () => {
  it('opens the first group and renders papers as columns, students as rows', async () => {
    getPastPaperGrid.mockResolvedValue(grid);
    await show();
    expect(getPastPaperGrid).toHaveBeenCalledWith(3);
    const heads = Array.from(host.querySelectorAll('th')).map((n) => n.textContent);
    expect(heads.some((h) => h?.includes('Practice Test 7'))).toBe(true);
    expect(heads.some((h) => h?.includes('Math drill') && h.includes('Partial'))).toBe(true);
    expect(host.textContent).toContain('never used for rankings');
    expect(Array.from(host.querySelectorAll('tbody tr')).map((r) => r.querySelector('td')?.textContent)).toEqual(['Aigerim S.', 'Bolat K.', 'Dana T.']);
  });

  it('a finished paper shows the labelled estimate with late and before-assigned markers', async () => {
    getPastPaperGrid.mockResolvedValue(grid);
    await show();
    const cell = host.querySelector('tbody tr td:nth-child(2)')!;
    expect(cell.querySelector('[data-line="estimate"]')?.textContent).toBe('≈1340 (estimate)');
    expect(cell.querySelector('[data-line="sections"]')?.textContent).toBe('RW 40/54 · Math 30/44');
    expect(cell.textContent).toContain('Late');
    expect(cell.textContent).toContain('Before assigned');
  });

  it('a partial paper shows correct/total and no scaled figure', async () => {
    getPastPaperGrid.mockResolvedValue(grid);
    await show();
    const cell = host.querySelector('tbody tr td:nth-child(3)')!;
    expect(cell.querySelector('[data-line="partial"]')?.textContent).toBe('Correct 15/22');
    expect(cell.textContent).not.toContain('≈');
  });

  it('in-progress and not-started cells are told apart, and a missing cell reads as not started', async () => {
    getPastPaperGrid.mockResolvedValue(grid);
    await show();
    const rows = Array.from(host.querySelectorAll('tbody tr'));
    expect(rows[1].querySelector('td:nth-child(2) [data-state]')?.getAttribute('data-state')).toBe('in_progress');
    expect(rows[1].querySelector('td:nth-child(3) [data-state]')?.getAttribute('data-state')).toBe('not_started');
    expect(rows[2].querySelector('td:nth-child(2) [data-state]')?.getAttribute('data-state')).toBe('not_started');
  });

  it('says so when no past paper was given to the group', async () => {
    getPastPaperGrid.mockResolvedValue({ ...grid, papers: [], rows: [] });
    await show();
    expect(host.textContent).toContain('No SAT past papers have been given to this group as homework yet.');
  });

  it('a group the user cannot see is a plain message, not a crash', async () => {
    getPastPaperGrid.mockRejectedValue({ response: { status: 403 } });
    await show();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
});
