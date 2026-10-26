// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});
const openPlatformPage = vi.fn();
vi.mock('../../lib/platformLinks', () => ({ openPlatformPage: (...a: unknown[]) => openPlatformPage(...a) }));

import { PastPaperTaskCard } from './PastPaperTaskCard';
import type { PastPaperTaskStatus } from '../../services/api/pastPapers';

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
  openPlatformPage.mockReset();
});

const base: PastPaperTaskStatus = {
  task_id: 't1', paper_id: 7, paper_title: 'Practice Test 7', is_partial: false, state: 'not_started',
  before_assigned: false, started_at: null, completed_at: null, is_estimate: true, rw: null, math: null,
  total_scaled_estimate: null, weakest_domains: [], paper_path: '/past-papers/7', results_path: null, review_url: null, history: [],
};
const done: PastPaperTaskStatus = {
  ...base, state: 'completed', completed_at: '2026-10-12T10:00:00Z', total_scaled_estimate: 1340,
  rw: { correct: 40, total: 54, scaled_estimate: 680 }, math: { correct: 30, total: 44, scaled_estimate: 660 },
  results_path: '/past-papers/7/results',
};
const button = (label: string) => Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(label));

describe('PastPaperTaskCard', () => {
  it('not started: a Start button that opens the paper on SAT', async () => {
    await show(<PastPaperTaskCard paperId={7} paperTitle="Practice Test 7" status={base} />);
    expect(host.textContent).toContain('Not started');
    expect(host.textContent).toContain("Can't open it? Tell your curator");
    await act(async () => { button('Start on SAT')!.click(); });
    expect(openPlatformPage).toHaveBeenCalledWith('sat', '/past-papers/7');
  });

  it('in progress: Continue, with the date it was started', async () => {
    await show(<PastPaperTaskCard paperId={7} paperTitle="Practice Test 7" status={{ ...base, state: 'in_progress', started_at: '2026-10-20T08:00:00Z' }} />);
    expect(host.textContent).toContain('In progress on the platform since');
    expect(button('Continue on SAT')).toBeDefined();
    expect(button('Start on SAT')).toBeUndefined();
  });

  it('completed: the score is labelled an estimate, sections show x/54 and x/44, results open on SAT', async () => {
    await show(<PastPaperTaskCard paperId={7} paperTitle="Practice Test 7" status={done} />);
    expect(host.querySelector('[data-line="estimate"]')?.textContent).toBe('≈1340 (estimate)');
    expect(host.querySelector('[data-line="sections"]')?.textContent).toBe('RW 40/54 · Math 30/44');
    expect(button('Start on SAT')).toBeUndefined();
    expect(host.textContent).not.toContain("Can't open it?");
    await act(async () => { button('See results')!.click(); });
    expect(openPlatformPage).toHaveBeenCalledWith('sat', '/past-papers/7/results');
  });

  it('completed before the homework existed: says so, with the date', async () => {
    await show(<PastPaperTaskCard paperId={7} paperTitle="Practice Test 7" status={{ ...done, before_assigned: true }} />);
    expect(host.textContent).toMatch(/Done before it was assigned \(.*2026.*\)/);
  });

  it('a partial paper shows correct/total only, never a scaled score', async () => {
    const partial = { ...done, is_partial: true, total_scaled_estimate: null, rw: { correct: 18, total: 27, scaled_estimate: null }, math: null };
    await show(<PastPaperTaskCard paperId={7} paperTitle="Drill" isPartial status={partial} />);
    expect(host.querySelector('[data-line="partial"]')?.textContent).toBe('Correct 18/27');
    expect(host.querySelector('[data-line="estimate"]')).toBeNull();
    expect(host.textContent).not.toContain('≈');
    expect(host.textContent).toContain('Partial');
  });

  it('reset on SAT: waits for a new attempt and offers to start again', async () => {
    await show(<PastPaperTaskCard paperId={7} paperTitle="Practice Test 7" status={{ ...base, state: 'reset_waiting' }} />);
    expect(host.textContent).toContain('Reset on SAT — waiting for a new attempt');
    expect(button('Start on SAT')).toBeDefined();
  });

  it('when the status cannot be read, the paper still opens from what the homework stored', async () => {
    const onRetry = vi.fn();
    await show(<PastPaperTaskCard paperId={7} paperTitle="Practice Test 7" status={null} failed onRetry={onRetry} />);
    expect(host.textContent).toContain('Practice Test 7');
    expect(host.textContent).toContain("Couldn't check this paper's status");
    await act(async () => { button('Start on SAT')!.click(); });
    expect(openPlatformPage).toHaveBeenCalledWith('sat', '/past-papers/7');
    await act(async () => { button('Retry')!.click(); });
    expect(onRetry).toHaveBeenCalled();
  });
});
