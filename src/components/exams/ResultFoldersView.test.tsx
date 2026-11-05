// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

const getResultFolders = vi.fn();
const getFolderResults = vi.fn();
const exportFolderResults = vi.fn();
const onExport = vi.fn();
vi.mock('../../services/api/examFolders', () => ({
  getResultFolders: (f: unknown) => getResultFolders(f),
  getFolderResults: (f: unknown) => getFolderResults(f),
  exportFolderResults: (f: unknown) => exportFolderResults(f),
}));
vi.mock('../../services/api/exams', () => ({ getExamGroups: () => Promise.resolve([]) }));

import { ResultFoldersView } from './ResultFoldersView';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const all = { key: 'all', exam_type: 'all', test_date: null, total: 4, with_proof: 3, unconfirmed: 1, reported: 4, verified: 0, rejected: 0 };

let root: Root | null = null;
let host: HTMLDivElement;
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(400); });
const lastFilters = (fn: { mock: { calls: unknown[][] } }) => fn.mock.calls[fn.mock.calls.length - 1][0] as Record<string, unknown>;
const chip = () => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Only with a screenshot'))!;

beforeEach(async () => {
  vi.useFakeTimers();
  getResultFolders.mockResolvedValue({ folders: [], all, curators: [] });
  getFolderResults.mockResolvedValue({ rows: [], total: 0 });
  exportFolderResults.mockResolvedValue(new Blob(['x']));
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<ResultFoldersView canWrite={false} onExport={onExport} />); });
  await settle();
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ResultFoldersView screenshot filter', () => {
  it('labels the select «Result screenshot»', () => {
    expect(host.querySelector('label[for="ef-proof"]')?.textContent).toBe('Result screenshot');
  });

  it('the quick chip is off at first and does not narrow anything', () => {
    expect(chip().getAttribute('aria-pressed')).toBe('false');
    expect(lastFilters(getFolderResults)).not.toHaveProperty('proof');
  });

  it('one click narrows folders, table and counts to results with a screenshot; a second click clears it', async () => {
    await act(async () => { chip().click(); });
    await settle();
    expect(chip().getAttribute('aria-pressed')).toBe('true');
    expect(lastFilters(getResultFolders)).toMatchObject({ proof: 'with' });
    expect(lastFilters(getFolderResults)).toMatchObject({ proof: 'with' });

    await act(async () => { chip().click(); });
    await settle();
    expect(chip().getAttribute('aria-pressed')).toBe('false');
    expect(lastFilters(getFolderResults)).not.toHaveProperty('proof');
  });

  it('keeps the other filters when the chip is toggled', async () => {
    const box = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => { box.click(); });
    await act(async () => { chip().click(); });
    await settle();
    expect(lastFilters(getFolderResults)).toMatchObject({ proof: 'with', unconfirmedOnly: true });
  });

  it('hands the page header what it would export: the folder, its count, and a run() that uses the filters', async () => {
    getFolderResults.mockResolvedValue({ rows: [], total: 7 });
    await act(async () => { chip().click(); });
    await settle();
    const action = onExport.mock.calls[onExport.mock.calls.length - 1][0];
    expect(action).toMatchObject({ scope: 'All results · 7 results', count: 7, busy: false });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    await act(async () => { action.run(); });
    expect(exportFolderResults).toHaveBeenCalledWith(expect.objectContaining({ proof: 'with' }));
  });

  it('has no export button of its own any more, and clears the header when it goes away', async () => {
    expect([...host.querySelectorAll('button')].some((b) => /export/i.test(b.textContent ?? ''))).toBe(false);
    await act(async () => { root!.unmount(); });
    root = null;
    expect(onExport.mock.calls[onExport.mock.calls.length - 1][0]).toBeNull();
  });
});
