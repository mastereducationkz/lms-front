// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { PastPaperReviewPanel } from './PastPaperReviewPanel';
import type { PastPaperTaskStatus } from '../../services/api/pastPapers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function show(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const status: PastPaperTaskStatus = {
  task_id: 't1', paper_id: 7, paper_title: 'Practice Test 7', is_partial: false, state: 'completed',
  before_assigned: false, started_at: '2026-10-12T08:00:00Z', completed_at: '2026-10-12T10:00:00Z', is_estimate: true,
  rw: { correct: 40, total: 54, scaled_estimate: 680 }, math: { correct: 30, total: 44, scaled_estimate: 660 },
  total_scaled_estimate: 1340,
  weakest_domains: [{ section: 'math', domain: 'Geometry', correct: 2, total: 8 }, { section: 'rw', domain: 'Boundaries', correct: 3, total: 9 }],
  paper_path: '/past-papers/7', results_path: '/past-papers/7/results',
  review_url: 'https://admin.mastereducation.kz/students/55/past-paper/7',
  history: [{ completed_at: '2026-09-01T10:00:00Z', total_scaled_estimate: 1200, rw: null, math: null }],
};

describe('PastPaperReviewPanel', () => {
  it('shows the estimate, the sections, the weakest topics and a new-tab link to the full review', async () => {
    await show(<PastPaperReviewPanel paperTitle="Practice Test 7" status={status} />);
    expect(host.querySelector('[data-line="estimate"]')?.textContent).toBe('≈1340 (estimate)');
    expect(host.querySelector('[data-line="sections"]')?.textContent).toBe('RW 40/54 · Math 30/44');
    expect(host.textContent).toContain('Geometry: 2/8');
    const link = host.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toContain('Open full review on SAT');
    expect(link.getAttribute('href')).toBe('https://admin.mastereducation.kz/students/55/past-paper/7');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('lists an earlier, reset attempt with its estimate label', async () => {
    await show(<PastPaperReviewPanel paperTitle="Practice Test 7" status={status} />);
    const lines = Array.from(host.querySelectorAll('[data-testid="history-line"]')).map((n) => n.textContent);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/≈1200 \(estimate\)$/);
  });

  it('no review link until the paper is done, and it says "Paper not done yet"', async () => {
    await show(<PastPaperReviewPanel paperTitle="Practice Test 7" status={{ ...status, state: 'not_started', review_url: null, history: [] }} />);
    expect(host.textContent).toContain('Paper not done yet');
    expect(host.querySelector('a')).toBeNull();
  });

  it('a started, unfinished paper says since when', async () => {
    await show(<PastPaperReviewPanel paperTitle="Practice Test 7" status={{ ...status, state: 'in_progress', review_url: null, history: [] }} />);
    expect(host.textContent).toContain('in progress on the platform since');
  });
});
