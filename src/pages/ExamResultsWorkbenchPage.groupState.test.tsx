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

const getExamResults = vi.fn();
const getExamGroups = vi.fn();
vi.mock('../services/api/exams', () => ({
  getExamResults: (...a: unknown[]) => getExamResults(...a),
  getExamGroups: (...a: unknown[]) => getExamGroups(...a),
  getSatOfficialDates: vi.fn().mockResolvedValue({ dates: [] }),
  listTestimonials: vi.fn().mockResolvedValue([]),
  exportExamResults: vi.fn(),
  openResultProof: vi.fn(),
  updatePlannedDate: vi.fn(),
}));

import ExamResultsWorkbenchPage from './ExamResultsWorkbenchPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 400)); });
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<ExamResultsWorkbenchPage />); });
  await settle();
}
beforeEach(() => {
  getExamResults.mockReset();
  getExamGroups.mockReset();
  getExamResults.mockResolvedValue([]);
  getExamGroups.mockResolvedValue([
    { id: 1, name: 'SAT - Daniil', program_type: 'sat', teacher_id: 2, teacher_name: null, is_finished: false },
  ]);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const pressed = () => Array.from(host.querySelectorAll('[aria-label="Groups"] button'))
  .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

describe('exam-results page group state', () => {
  it('a teacher starts on the running groups, and the list and the picker both ask for them', async () => {
    role = 'teacher';
    await show();
    expect(pressed()).toEqual(['Running']);
    expect(getExamResults).toHaveBeenLastCalledWith(expect.objectContaining({ groupState: 'running' }));
    expect(getExamGroups).toHaveBeenLastCalledWith({ program: 'sat', groupState: 'running' });
  });

  it('an admin starts on everything, as before', async () => {
    role = 'admin';
    await show();
    expect(pressed()).toEqual(['All']);
    expect(getExamResults).toHaveBeenLastCalledWith(expect.objectContaining({ groupState: 'all' }));
  });

  it('choosing Finished reloads the rows and the picker, drops a picked group and tags finished options', async () => {
    role = 'teacher';
    await show();
    getExamGroups.mockResolvedValue([
      { id: 9, name: 'SAT - Old', program_type: 'sat', teacher_id: 2, teacher_name: 'T', is_finished: true },
    ]);
    const select = host.querySelector('#er-group') as HTMLSelectElement;
    await act(async () => { select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    const finished = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Finished')!;
    await act(async () => { finished.click(); });
    await settle();
    expect(getExamResults).toHaveBeenLastCalledWith(expect.objectContaining({ groupState: 'finished' }));
    expect(getExamResults).toHaveBeenLastCalledWith(expect.not.objectContaining({ groupId: expect.anything() }));
    expect(Array.from(host.querySelectorAll('#er-group option')).map((o) => o.textContent)).toContain('SAT - Old — T · finished');
  });

  it('a finished student row carries the finished tag next to the group', async () => {
    role = 'teacher';
    getExamResults.mockResolvedValue([{
      student: { student_id: 5, full_name: 'Aidar', email: null, phone_number: null, telegram_tag: null, parent_full_name: null, parent_phone: null },
      group_id: 9, group_name: 'SAT - Old', group_is_finished: true, planned_test_date: null, ask_result_on: null,
      triage_status: 'unscheduled', result: null, attempts: [], marketing_eligible: false, marketing_basis: [], marketing_threshold: 1400,
    }]);
    await show();
    expect(host.textContent).toContain('SAT - Old');
    expect(host.textContent).toContain('finished');
  });
});
