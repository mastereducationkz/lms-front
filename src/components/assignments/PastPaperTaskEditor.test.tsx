// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import PastPaperTaskEditor from './PastPaperTaskEditor';
import type { PastPaperCatalog } from '../../services/api/pastPapers';

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

const catalog: PastPaperCatalog = {
  enabled: true,
  available: true,
  papers: [
    { id: 7, title: 'Practice Test 7', test_date: '2025-03-08', is_partial: false, is_prediction: false, module_count: 4, groups: [{ group_id: 1, done: 3, in_progress: 2, total: 12 }, { group_id: 2, done: 0, in_progress: 0, total: 8 }] },
    { id: 9, title: 'Math-only drill', test_date: null, is_partial: true, is_prediction: true, module_count: 2, groups: [] },
  ],
};
const state = (over: Partial<{ catalog: PastPaperCatalog | null; loading: boolean; failed: boolean }> = {}) => ({
  catalog, loading: false, failed: false, reload: vi.fn(), ...over,
});

describe('PastPaperTaskEditor', () => {
  it('lists the papers with badges and per-group "already done" counts', async () => {
    await show(<PastPaperTaskEditor content={{}} onContentChange={vi.fn()} catalogState={state()} groupIds={[1, 2]} groupNames={{ 1: 'SAT A', 2: 'SAT B' }} />);
    const text = host.textContent ?? '';
    expect(text).toContain('Practice Test 7');
    expect(text).toContain('Partial');
    expect(text).toContain('Prediction');
    const counts = Array.from(host.querySelectorAll('[data-testid="group-count"]')).map((n) => n.textContent);
    expect(counts).toEqual(['SAT A: already done by 3 of 12 · in progress: 2', 'SAT B: already done by 0 of 8']);
  });

  it('picking a paper writes paper_id, paper_title and is_partial', async () => {
    const onContentChange = vi.fn();
    await show(<PastPaperTaskEditor content={{}} onContentChange={onContentChange} catalogState={state()} groupIds={[1]} />);
    const drill = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Math-only drill'))!;
    await act(async () => { drill.click(); });
    expect(onContentChange).toHaveBeenCalledWith({ paper_id: 9, paper_title: 'Math-only drill', is_partial: true });
  });

  it('filters the list by the search text', async () => {
    await show(<PastPaperTaskEditor content={{}} onContentChange={vi.fn()} catalogState={state()} groupIds={[1]} />);
    const input = host.querySelector('input[type="search"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setValue.call(input, 'drill'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    const titles = Array.from(host.querySelectorAll('li button')).map((b) => b.textContent);
    expect(titles).toHaveLength(1);
    expect(titles[0]).toContain('Math-only drill');
  });

  it('is hidden while the feature is switched off', async () => {
    await show(<PastPaperTaskEditor content={{}} onContentChange={vi.fn()} catalogState={state({ catalog: { ...catalog, enabled: false } })} groupIds={[1]} />);
    expect(host.innerHTML).toBe('');
  });

  it('says so, with a retry, when SAT\'s list cannot be read', async () => {
    const s = state({ catalog: { enabled: true, available: false, papers: [] } });
    await show(<PastPaperTaskEditor content={{}} onContentChange={vi.fn()} catalogState={s} groupIds={[1]} />);
    expect(host.textContent).toContain("can't be loaded right now");
    const retry = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Try again')!;
    await act(async () => { retry.click(); });
    expect(s.reload).toHaveBeenCalled();
  });
});
