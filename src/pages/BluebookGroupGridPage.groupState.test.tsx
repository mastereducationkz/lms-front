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
vi.mock('../services/api/exams', () => ({
  getBluebookGroups: (...a: unknown[]) => getBluebookGroups(...a),
  getBluebookGrid: (...a: unknown[]) => getBluebookGrid(...a),
  exportBluebookGrid: vi.fn(),
}));

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
    expect(host.querySelector('#bb-group option')?.textContent).toBe('SAT - Old · finished');
    expect(getBluebookGrid).toHaveBeenLastCalledWith(9);
  });
});
