// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getPastPaperStatus = vi.fn();
vi.mock('../services/api/pastPapers', () => ({ getPastPaperStatus: (...a: unknown[]) => getPastPaperStatus(...a) }));

import { REFOCUS_REFETCH_MS, usePastPaperStatus } from './usePastPaperStatus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let seen: ReturnType<typeof usePastPaperStatus> | null = null;
function Probe({ id, student }: { id: number | null; student?: number | null }) {
  seen = usePastPaperStatus(id, student);
  return null;
}
async function mount(id: number | null = 5, student?: number | null) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<Probe id={id} student={student} />); });
}
const setVisibility = async (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-26T10:00:00Z'));
  getPastPaperStatus.mockReset();
  getPastPaperStatus.mockResolvedValue({ past_paper_only: false, tasks: [] });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  seen = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('usePastPaperStatus', () => {
  it('reads the status once on mount, for the student when given', async () => {
    await mount(5, 42);
    expect(getPastPaperStatus).toHaveBeenCalledTimes(1);
    expect(getPastPaperStatus).toHaveBeenCalledWith(5, 42);
    expect(seen?.status).toEqual({ past_paper_only: false, tasks: [] });
  });

  it('requests nothing without an assignment id', async () => {
    await mount(null);
    expect(getPastPaperStatus).not.toHaveBeenCalled();
  });

  it('reads again when the tab becomes visible, but not more than once per 10 s', async () => {
    await mount();
    await setVisibility('visible');
    expect(getPastPaperStatus).toHaveBeenCalledTimes(1); // too soon after the first read

    vi.setSystemTime(Date.now() + REFOCUS_REFETCH_MS + 1);
    await setVisibility('visible');
    expect(getPastPaperStatus).toHaveBeenCalledTimes(2);

    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(getPastPaperStatus).toHaveBeenCalledTimes(2); // focus right after is throttled too

    vi.setSystemTime(Date.now() + REFOCUS_REFETCH_MS + 1);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(getPastPaperStatus).toHaveBeenCalledTimes(3);
  });

  it('does not read while the tab is hidden', async () => {
    await mount();
    vi.setSystemTime(Date.now() + REFOCUS_REFETCH_MS + 1);
    await setVisibility('hidden');
    expect(getPastPaperStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps the card on screen when the quiet refresh fails', async () => {
    await mount();
    getPastPaperStatus.mockRejectedValue(new Error('offline'));
    vi.setSystemTime(Date.now() + REFOCUS_REFETCH_MS + 1);
    await setVisibility('visible');
    expect(getPastPaperStatus).toHaveBeenCalledTimes(2);
    expect(seen?.failed).toBe(false);
    expect(seen?.status).not.toBeNull();
  });

  it('stops listening after unmount', async () => {
    await mount();
    await act(async () => { root!.unmount(); });
    root = null;
    vi.setSystemTime(Date.now() + REFOCUS_REFETCH_MS + 1);
    await setVisibility('visible');
    expect(getPastPaperStatus).toHaveBeenCalledTimes(1);
  });
});
