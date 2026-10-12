// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin' } }) };
});
const toast = vi.fn();
vi.mock('../Toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));

const getAnnouncements = vi.fn();
const getAnnouncement = vi.fn();
const recallAnnouncement = vi.fn();
// Only what the tab calls: the real module pulls in the HTTP client, which touches localStorage on load.
vi.mock('../../services/api/announcements', () => ({
  getAnnouncements: (...a: unknown[]) => getAnnouncements(...a),
  getAnnouncement: (...a: unknown[]) => getAnnouncement(...a),
  recallAnnouncement: (...a: unknown[]) => recallAnnouncement(...a),
  cancelAnnouncement: vi.fn(),
}));

import { HistoryTab } from './HistoryTab';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

/**
 * LMS-BACKEND-10: Support now answers a recall at once with `recalling` and deletes in the background.
 * The tab has to show that, keep itself fresh, and say the result once when it is done.
 */
const announcement = (status: string, over: Record<string, unknown> = {}) => ({
  id: 38, body: 'Занятия переносятся', status, created_by_email: 'head@mastereducation.kz', created_by_name: 'Head',
  pin: false, silent: false, target_all_students: false, scheduled_for: null, total_count: 3, sent_count: 3, failed_count: 0,
  started_at: new Date().toISOString(), finished_at: new Date().toISOString(), recalled_at: null, created_at: new Date().toISOString(),
  images: [], ...over,
});
const detail = (status: string, targets: Array<Record<string, unknown>> = []) => ({ ...announcement(status), targets });

let root: Root | null = null;
let host: HTMLDivElement;
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<HistoryTab onSendAgain={vi.fn()} />); });
}
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  toast.mockReset();
  getAnnouncements.mockReset();
  getAnnouncement.mockReset();
  recallAnnouncement.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('recalling an announcement from the History tab', () => {
  it('says the recall has started, shows it as recalling, and reports the result once when it finishes', async () => {
    getAnnouncements.mockResolvedValue({ announcements: [announcement('sent')], total: 1 });
    recallAnnouncement.mockResolvedValue(detail('recalling'));
    await show();
    await tick(0);

    const button = host.querySelector('button[aria-label="Recall"]') ?? host.querySelector('button[aria-label*="ecall"]');
    expect(button, 'the recall button is offered on a sent announcement').toBeTruthy();
    getAnnouncements.mockResolvedValue({ announcements: [announcement('recalling')], total: 1 });
    await act(async () => { (button as HTMLButtonElement).click(); });
    await tick(0);

    expect(recallAnnouncement).toHaveBeenCalledWith(38);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Recall started'), 'info');
    expect(host.textContent).toContain('Recalling…');
    expect(host.querySelector('button[aria-label*="ecall"]'), 'it cannot be asked for again meanwhile').toBeNull();

    // The worker finishes; the next poll sees `recalled`, and the sender is told once, with the result.
    getAnnouncements.mockResolvedValue({ announcements: [announcement('recalled')], total: 1 });
    getAnnouncement.mockResolvedValue(detail('recalled', [{ id: 1, error: null }, { id: 2, error: "recall: message can't be deleted for everyone" }, { id: 3, error: null }]));
    await tick(5000);

    expect(toast).toHaveBeenLastCalledWith('Recalled, but 1 chat could not be cleared', 'info');
    await tick(15000);
    expect(toast.mock.calls.filter((c) => String(c[0]).startsWith('Recalled'))).toHaveLength(1);
  });

  it('keeps polling for as long as the recall runs, and stops when it is over', async () => {
    getAnnouncements.mockResolvedValue({ announcements: [announcement('recalling')], total: 1 });
    await show();
    await tick(0);
    const afterLoad = getAnnouncements.mock.calls.length;

    await tick(5000);
    await tick(5000);
    expect(getAnnouncements.mock.calls.length).toBe(afterLoad + 2);

    getAnnouncements.mockResolvedValue({ announcements: [announcement('recalled')], total: 1 });
    await tick(5000);
    const settled = getAnnouncements.mock.calls.length;
    await tick(20000);
    expect(getAnnouncements.mock.calls.length).toBe(settled);
  });

  it('still handles a Support that answers only when the recall is done', async () => {
    getAnnouncements.mockResolvedValue({ announcements: [announcement('sent')], total: 1 });
    recallAnnouncement.mockResolvedValue(detail('recalled', [{ id: 1, error: null }]));
    await show();
    await tick(0);

    await act(async () => { (host.querySelector('button[aria-label*="ecall"]') as HTMLButtonElement).click(); });
    await tick(0);

    expect(toast).toHaveBeenCalledWith('Announcement recalled', 'success');
    expect(toast).not.toHaveBeenCalledWith(expect.stringContaining('Recall started'), expect.anything());
  });
});
