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

const row = (id: number, name: string, active: boolean) => ({
  student: { student_id: id, full_name: name, email: null, phone_number: null, telegram_tag: null, parent_full_name: null, parent_phone: null },
  student_is_active: active,
  group_id: 1, group_name: 'SAT - Daniil', group_is_finished: false, planned_test_date: null, ask_result_on: null,
  triage_status: 'unscheduled', result: null, attempts: [], marketing_eligible: false, marketing_basis: [], marketing_threshold: 1400,
});

const tags = () => Array.from(host.querySelectorAll('[title="This account is deactivated."]'));

const checkbox = () => Array.from(host.querySelectorAll('label'))
  .find((l) => l.textContent === 'Show inactive students')!.querySelector('input') as HTMLInputElement;

describe('exam-results page: Show inactive students', () => {
  it('starts off, so the first request does not ask for inactive accounts', async () => {
    role = 'admin';
    await show();
    expect(checkbox().checked).toBe(false);
    expect(getExamResults).toHaveBeenLastCalledWith(expect.not.objectContaining({ includeInactive: expect.anything() }));
  });

  it('turning it on reloads the list with includeInactive, and a deactivated row says so', async () => {
    role = 'admin';
    getExamResults.mockResolvedValue([row(1, 'Aidar Live', true)]);
    await show();
    expect(tags()).toHaveLength(0);
    getExamResults.mockResolvedValue([row(1, 'Aidar Live', true), row(2, 'Aidar Twin', false)]);
    await act(async () => { checkbox().click(); });
    await settle();
    expect(getExamResults).toHaveBeenLastCalledWith(expect.objectContaining({ includeInactive: true }));
    expect(host.textContent).toContain('Aidar Twin');
    // exactly one tag, and it sits on the twin's row: the live row carries none
    expect(tags()).toHaveLength(1);
    expect(tags()[0].closest('tr')!.textContent).toContain('Aidar Twin');
  });

  it('turning it off again drops the parameter', async () => {
    role = 'admin';
    await show();
    await act(async () => { checkbox().click(); });
    await settle();
    await act(async () => { checkbox().click(); });
    await settle();
    expect(getExamResults).toHaveBeenLastCalledWith(expect.not.objectContaining({ includeInactive: expect.anything() }));
  });
});
