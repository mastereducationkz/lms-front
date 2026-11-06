// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let role = 'teacher';
// useT() and the page read AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role } }) };
});

const getBluebookGroups = vi.fn();
const getBluebookGrid = vi.fn();
const downloadBluebookReport = vi.fn();
vi.mock('../services/api/exams', () => ({
  getBluebookGroups: (...a: unknown[]) => getBluebookGroups(...a),
  getBluebookGrid: (...a: unknown[]) => getBluebookGrid(...a),
  exportBluebookGrid: vi.fn(),
  downloadBluebookReport: (...a: unknown[]) => downloadBluebookReport(...a),
}));

import { dropdownText, dropdownValue } from '@/test/dropdown';
import BluebookGroupGridPage from './BluebookGroupGridPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<BluebookGroupGridPage />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
beforeEach(() => {
  getBluebookGroups.mockReset();
  getBluebookGrid.mockReset();
  getBluebookGroups.mockResolvedValue([{ id: 1, name: 'SAT - Daniil', program_type: 'sat', teacher_id: 2, teacher_name: null, is_finished: false }]);
  getBluebookGrid.mockReturnValue(new Promise(() => {}));
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const pressed = () => Array.from(host.querySelectorAll('[role="group"] button'))
  .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

describe('Bluebook page group state', () => {
  it('a teacher starts on the running groups', async () => {
    role = 'teacher';
    await show();
    expect(getBluebookGroups).toHaveBeenCalledWith(undefined, 'running');
    expect(pressed()).toEqual(['Running']);
  });

  it('a head curator starts on all groups', async () => {
    role = 'head_curator';
    await show();
    expect(getBluebookGroups).toHaveBeenCalledWith(undefined, 'all');
    expect(pressed()).toEqual(['All']);
  });

  it('choosing Finished asks for the finished groups, tags them, and opens the first one', async () => {
    role = 'teacher';
    await show();
    getBluebookGroups.mockResolvedValue([{ id: 9, name: 'SAT - Old', program_type: 'sat', teacher_id: 2, teacher_name: null, is_finished: true }]);
    const finished = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Finished')!;
    await act(async () => { finished.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(getBluebookGroups).toHaveBeenLastCalledWith(undefined, 'finished');
    expect(dropdownText(host.querySelector('#bb-group'))).toBe('SAT - Old · finished');
    expect(dropdownValue(host.querySelector('#bb-group'))).toBe('9');
    expect(getBluebookGrid).toHaveBeenLastCalledWith(9);
  });

  it('offers the PDF report only on cells that have one, and downloads it under a readable name', async () => {
    role = 'teacher';
    const col = (n: number) => ({
      key: `t${n}`, label: `Bluebook #${n}`, test_number: n, assignment_id: 100 + n, due_date: null,
      week_number: null, is_baseline: false, is_assigned: true,
    });
    const cell = (reportId: number | null) => ({
      state: 'submitted', verbal_score: 600, math_score: 700, total_score: 1300, taken_at: null,
      screenshot_url: null, source: 'homework', report_assignment_id: reportId, delta: null, trend: null,
    });
    const stat = { submitted_count: 1, expected_count: 1, completion_rate: 1, mean_total: null, median_total: null, mean_verbal: null, mean_math: null };
    getBluebookGrid.mockResolvedValue({
      group_id: 1, group_name: 'SAT - Daniil', teacher_name: null, start_date: null, finish_date: null,
      columns: [col(7), col(8)],
      rows: [{
        student_id: 55, full_name: 'Иванов Иван', display_id: null, email: null,
        cells: { t7: cell(107), t8: cell(null) },
        submitted_count: 2, assigned_count: 2, best_total: 1300, latest_total: 1300, average_total: 1300,
        baseline_total: null, improvement_from_baseline: null, final_exam: null,
      }],
      column_stats: { t7: stat, t8: stat },
      group_stats: {
        student_count: 1, tests_assigned: 2, tests_available: 8, submitted_count: 2, expected_count: 2,
        completion_rate: 1, average_latest_total: 1300, median_latest_total: 1300, average_best_total: 1300,
        highest_total: 1300, lowest_latest_total: 1300, average_improvement: null, improved_count: 0,
        declined_count: 0, students_with_no_results: 0,
      },
    });
    downloadBluebookReport.mockResolvedValue(undefined);
    await show();
    const buttons = Array.from(host.querySelectorAll('button[title="Download the College Board PDF report"]'));
    expect(buttons).toHaveLength(1);
    await act(async () => { (buttons[0] as HTMLButtonElement).click(); });
    expect(downloadBluebookReport).toHaveBeenCalledWith(107, 55, 'Bluebook-7_Иванов-Иван.pdf');
  });
});
