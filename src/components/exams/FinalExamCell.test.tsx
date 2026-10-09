// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { FinalExamScore, FinalExamWhen } from './FinalExamCell';
import type { BluebookFinalExam } from '../../lib/bluebookFinalExam';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function show(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
  return host;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const result: BluebookFinalExam = {
  total_score: 1400, verbal_score: 700, math_score: 700, test_date: '2026-10-03',
  planned_test_date: null, status: 'verified', change_vs_baseline: 150,
};
const planned: BluebookFinalExam = {
  total_score: null, verbal_score: null, math_score: null, test_date: null,
  planned_test_date: '2026-10-17', status: null, change_vs_baseline: null,
};

describe('FinalExamScore', () => {
  it('shows the total with the change chip and Verbal / Math under it', async () => {
    await show(<FinalExamScore final={result} />);
    const lines = Array.from(host.querySelectorAll('[data-line]')).map((n) => n.textContent);
    expect(lines).toEqual(['1400+150', 'V 700 · M 700']);
  });

  it('a dash while there is no result, planned date or not', async () => {
    await show(<FinalExamScore final={planned} />);
    expect(host.textContent).toBe('–');
    await act(async () => { root!.render(<FinalExamScore final={null} />); });
    expect(host.textContent).toBe('–');
  });
});

describe('FinalExamWhen', () => {
  it('shows the date and marks a verified result', async () => {
    await show(<FinalExamWhen final={result} />);
    const lines = Array.from(host.querySelectorAll('[data-line]')).map((n) => n.textContent);
    expect(lines).toEqual(['03.10.2026', 'verified']);
  });

  it('marks an unverified result', async () => {
    await show(<FinalExamWhen final={{ ...result, status: 'reported' }} />);
    const lines = Array.from(host.querySelectorAll('[data-line]')).map((n) => n.textContent);
    expect(lines).toEqual(['03.10.2026', 'unverified']);
  });

  it('shows the planned date, labelled, when there is no result', async () => {
    await show(<FinalExamWhen final={planned} />);
    expect(host.textContent).toBe('planned 17.10.2026');
  });

  it('a dash when there is nothing at all', async () => {
    await show(<FinalExamWhen final={null} />);
    expect(host.textContent).toBe('–');
  });
});
