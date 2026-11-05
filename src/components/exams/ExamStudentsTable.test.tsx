// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

// The row cells import the exams API, which builds the axios client (localStorage at module scope).
vi.mock('../../services/api/client', () => ({ api: {} }));

import { ExamStudentsTable, ROW_CHUNK } from './ExamStudentsTable';
import type { ExamResultRow } from '../../services/api/exams';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mkRow = (i: number): ExamResultRow => ({
  student: { student_id: i, full_name: `Student ${i}`, student_phone: null, telegram_tag: null, parent_full_name: null, parent_phone: null },
  group_id: 1, group_name: 'G', planned_test_date: null, ask_result_on: null, triage_status: 'pending',
  marketing_eligible: false, marketing_basis: [], marketing_threshold: null, marketing_test_date: null,
  attempts: [], result: null,
} as unknown as ExamResultRow);

const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => mkRow(i + 1));
const noop = () => {};
const actions = { onHistory: noop, onRecord: noop, onBreakdown: noop, onTestimonial: noop, onReschedule: noop, onChanged: noop, onError: noop };

let root: Root | null = null;
let host: HTMLDivElement;
const tree = (rows: ExamResultRow[], resetKey: unknown = 'a') => (
  <ExamStudentsTable rows={rows} examType="sat" canWrite={false} testimonials={{}} rescheduling={null} resetKey={resetKey} {...actions} />
);
async function show(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
}
const bodyRows = () => host.querySelectorAll('tbody tr').length;
const showMoreButton = () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Show more');

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('ExamStudentsTable', () => {
  it('draws only the first chunk of a long list and says how many there are in all', async () => {
    await show(tree(rowsOf(ROW_CHUNK * 3 + 7)));
    expect(bodyRows()).toBe(ROW_CHUNK);
    expect(host.textContent).toContain(`Showing ${ROW_CHUNK} of ${ROW_CHUNK * 3 + 7}`);
    expect(host.textContent).toContain('Student 1');
    expect(host.textContent).not.toContain(`Student ${ROW_CHUNK + 1}`);
  });

  it('«Show more» reveals the next chunk and goes away once everything is drawn', async () => {
    await show(tree(rowsOf(ROW_CHUNK + 30)));
    await act(async () => { showMoreButton()!.click(); });
    expect(bodyRows()).toBe(ROW_CHUNK + 30);
    expect(showMoreButton()).toBeUndefined();
    expect(host.textContent).not.toContain('Showing');
  });

  it('a short list has no footer at all', async () => {
    await show(tree(rowsOf(5)));
    expect(bodyRows()).toBe(5);
    expect(showMoreButton()).toBeUndefined();
  });

  it('starts again from the first chunk when the filters change, but keeps its place when only the rows reload', async () => {
    const rows = rowsOf(ROW_CHUNK * 2);
    await show(tree(rows, 'filters-1'));
    await act(async () => { showMoreButton()!.click(); });
    expect(bodyRows()).toBe(ROW_CHUNK * 2);

    await act(async () => { root!.render(tree(rowsOf(ROW_CHUNK * 2), 'filters-1')); });   // a refetch after an edit
    expect(bodyRows()).toBe(ROW_CHUNK * 2);

    await act(async () => { root!.render(tree(rowsOf(ROW_CHUNK * 2), 'filters-2')); });   // a new filter set
    expect(bodyRows()).toBe(ROW_CHUNK);
  });
});
