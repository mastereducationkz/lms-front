// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});
vi.mock('../../services/api', () => ({ default: {} }));
vi.mock('../../services/api/exams', () => ({ parseBluebookReport: vi.fn() }));
vi.mock('../../lib/platformLinks', () => ({ openPlatformPage: vi.fn() }));
const usePastPaperStatus = vi.fn();
vi.mock('../../hooks/usePastPaperStatus', () => ({ usePastPaperStatus: (...a: unknown[]) => usePastPaperStatus(...a) }));

import MultiTaskSubmission from './MultiTaskSubmission';

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
  usePastPaperStatus.mockReset();
});

const paperTask = { id: 'p1', task_type: 'sat_past_paper_task', title: 'Practice Test 7', order_index: 1, points: 10, content: { paper_id: 7, paper_title: 'Practice Test 7', is_partial: false } };
const textTask = { id: 'x1', task_type: 'text_task', title: 'Essay', order_index: 0, points: 10, content: {} };
const notDone = { status: { past_paper_only: false, tasks: [{ task_id: 'p1', paper_id: 7, paper_title: 'Practice Test 7', is_partial: false, state: 'not_started', before_assigned: false, started_at: null, completed_at: null, is_estimate: true, rw: null, math: null, total_scaled_estimate: null, weakest_domains: [], paper_path: '/past-papers/7', results_path: null, review_url: null, history: [] }] }, loading: false, failed: false, reload: vi.fn() };
const submit = () => Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Submit Assignment') as HTMLButtonElement | undefined;

describe('MultiTaskSubmission with a past paper', () => {
  it('mixed homework: Submit never waits for the paper (Q22)', async () => {
    usePastPaperStatus.mockReturnValue(notDone);
    await show(
      <MultiTaskSubmission
        assignment={{ id: 5, content: { tasks: [textTask, paperTask] } }}
        initialAnswers={{ tasks: { x1: { text_response: 'my essay' } } }}
        onSubmit={vi.fn()}
      />,
    );
    expect(host.textContent).toContain('Start on SAT');
    expect(submit()?.disabled).toBe(false);
  });

  it('asks for the status of its own homework only, and none for a student reading their own work', async () => {
    usePastPaperStatus.mockReturnValue(notDone);
    await show(<MultiTaskSubmission assignment={{ id: 5, content: { tasks: [paperTask, textTask] } }} onSubmit={vi.fn()} readOnly />);
    expect(usePastPaperStatus).toHaveBeenCalledWith(5, null);
  });

  it('a homework without a past paper requests nothing', async () => {
    usePastPaperStatus.mockReturnValue({ status: null, loading: false, failed: false, reload: vi.fn() });
    await show(<MultiTaskSubmission assignment={{ id: 6, content: { tasks: [textTask] } }} onSubmit={vi.fn()} />);
    expect(usePastPaperStatus).toHaveBeenCalledWith(null, null);
  });

  it('only past papers: no Submit button, a note that it submits itself', async () => {
    usePastPaperStatus.mockReturnValue({ ...notDone, status: { ...notDone.status, past_paper_only: true } });
    await show(<MultiTaskSubmission assignment={{ id: 5, content: { tasks: [paperTask] } }} onSubmit={vi.fn()} />);
    expect(submit()).toBeUndefined();
    expect(host.textContent).toContain('This homework submits itself when you finish the paper');
  });

  it('staff reading a student\'s work get the review panel, not the student card', async () => {
    usePastPaperStatus.mockReturnValue(notDone);
    await show(<MultiTaskSubmission assignment={{ id: 5, content: { tasks: [paperTask] } }} onSubmit={vi.fn()} readOnly studentId="42" />);
    expect(usePastPaperStatus).toHaveBeenCalledWith(5, 42);
    expect(host.textContent).toContain('Paper not done yet');
    expect(host.textContent).not.toContain('Start on SAT');
  });
});
