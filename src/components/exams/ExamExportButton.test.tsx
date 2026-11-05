// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});
// The header's deep-link dialog imports the exams API, which builds the axios client.
vi.mock('../../services/api/client', () => ({ api: {} }));

import { ExamViewHeader } from './ExamViewHeader';
import type { ExportAction } from './ExamExportButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function show(view: 'students' | 'folders', action: ExportAction | null) {
  if (!root) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  await act(async () => { root!.render(<ExamViewHeader view={view} onView={() => {}} action={action} />); });
}
const btn = () => host.querySelector('[data-testid="exam-export"]') as HTMLButtonElement;
const caption = () => btn().parentElement!.querySelector('span[aria-live]')!.textContent;

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('the header export button', () => {
  it('is the same element in both views and carries the live scope', async () => {
    const run = vi.fn();
    await show('students', { scope: '1 240 students', count: 1240, busy: false, run });
    const first = btn();
    expect(first.textContent).toContain('Export to Excel');
    expect(first.getAttribute('aria-label')).toBe('Export to Excel: 1 240 students');
    expect(caption()).toBe('1 240 students');
    await act(async () => { first.click(); });
    expect(run).toHaveBeenCalledTimes(1);

    await show('folders', { scope: 'SAT · Oct 3 · 98 results', count: 98, busy: false, run });
    expect(btn()).toBe(first);
    expect(btn().getAttribute('aria-label')).toBe('Export to Excel: SAT · Oct 3 · 98 results');
    expect(caption()).toBe('SAT · Oct 3 · 98 results');
    expect(btn().disabled).toBe(false);
  });

  it('stays visible but disabled, with the reason, when there is nothing to export', async () => {
    await show('students', { scope: '0 students', count: 0, busy: false, run: vi.fn() });
    expect(btn().disabled).toBe(true);
    expect(btn().title).toBe('Nothing to export');
    expect(caption()).toBe('Nothing to export');
  });

  it('shows the running state inside the same button and blocks a second click', async () => {
    const run = vi.fn();
    await show('folders', { scope: 'All results · 5 results', count: 5, busy: true, run });
    expect(btn().textContent).toContain('Exporting…');
    expect(btn().disabled).toBe(true);
    await act(async () => { btn().click(); });
    expect(run).not.toHaveBeenCalled();
  });

  it('is present and disabled while the view has not reported yet or is still counting', async () => {
    await show('folders', null);
    expect(btn().disabled).toBe(true);
    await show('folders', { scope: 'All results · 0 results', count: null, busy: false, run: vi.fn() });
    expect(btn().disabled).toBe(true);
    expect(btn().title).toBe('');
  });
});
