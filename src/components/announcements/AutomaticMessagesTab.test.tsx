// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin' } }) };
});
vi.mock('../Toast', () => ({ toast: vi.fn() }));

const getAutomaticMessages = vi.fn();
vi.mock('../../services/api/announcements', () => ({ getAutomaticMessages: (...a: unknown[]) => getAutomaticMessages(...a) }));

import { AutomaticMessagesTab } from './AutomaticMessagesTab';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const item = (id: number, over: Record<string, unknown> = {}) => ({
  id, kind: 'weekly_test', key: `digest:weekly_test:1:${id}`, chat_id: 3, chat_title: 'NUET October 1 2026', chat_type: 'supergroup',
  text: `Тест недели №${id}`, status: 'sent', error: null, telegram_message_id: id, attempts: 1, acting_user: 'bot',
  sent_at: '2026-10-10T07:00:00Z', created_at: '2026-10-10T07:00:00Z', ...over,
});

let root: Root | null = null;
let host: HTMLDivElement;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 400)); });
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<AutomaticMessagesTab />); });
  await settle();
}
beforeEach(() => {
  getAutomaticMessages.mockReset();
  getAutomaticMessages.mockResolvedValue({ total: 2, items: [item(2), item(1, { kind: 'homework', chat_title: 'June 7 IELTS', text: 'Новое домашнее задание', status: 'failed', error: '502: Bad Gateway' })] });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const setSelect = async (id: string, value: string) => {
  const el = host.querySelector(`#${id}`) as HTMLSelectElement;
  await act(async () => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await settle();
};

describe('automatic messages tab', () => {
  it('shows the last week of everything the bot posted, newest first, with kind, chat, status and text', async () => {
    await show();
    expect(getAutomaticMessages).toHaveBeenCalledWith(expect.objectContaining({ days: 7, limit: 50, offset: 0 }));
    expect(host.textContent).toContain('Тест недели №2');
    expect(host.textContent).toContain('Weekly test');
    expect(host.textContent).toContain('NUET October 1 2026');
    expect(host.textContent).toContain('Homework notices');
    expect(host.textContent).toContain('502: Bad Gateway');
    expect(host.textContent).toContain('Showing 2 of 2');
  });

  it('asks again for the kind that was chosen', async () => {
    await show();
    await setSelect('auto-kind', 'homework');
    expect(getAutomaticMessages).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'homework', offset: 0 }));
  });

  it('asks again for another period and for failures only', async () => {
    await show();
    await setSelect('auto-days', '30');
    expect(getAutomaticMessages).toHaveBeenLastCalledWith(expect.objectContaining({ days: 30 }));
    await setSelect('auto-status', 'failed');
    expect(getAutomaticMessages).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('loads the next page under the first and stops when everything is shown', async () => {
    getAutomaticMessages.mockResolvedValueOnce({ total: 3, items: [item(3), item(2)] }).mockResolvedValueOnce({ total: 3, items: [item(1)] });
    await show();
    expect(host.textContent).toContain('Showing 2 of 3');
    const more = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Load more')!;
    await act(async () => { more.click(); });
    await settle();
    expect(getAutomaticMessages).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 2 }));
    expect(host.textContent).toContain('Тест недели №1');
    expect(host.textContent).toContain('Showing 3 of 3');
    expect(Array.from(host.querySelectorAll('button')).some((b) => b.textContent === 'Load more')).toBe(false);
  });

  it('says so when nothing matches', async () => {
    getAutomaticMessages.mockResolvedValue({ total: 0, items: [] });
    await show();
    expect(host.textContent).toContain('No automatic messages match these filters.');
  });

  it('a long text is clipped and opens on a click', async () => {
    const long = 'Строка\n'.repeat(12);
    getAutomaticMessages.mockResolvedValue({ total: 1, items: [item(1, { text: long })] });
    await show();
    const toggle = () => Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Show more' || b.textContent === 'Show less')!;
    expect(toggle().textContent).toBe('Show more');
    await act(async () => { toggle().click(); });
    expect(toggle().textContent).toBe('Show less');
  });

  it('a short text has nothing to open', async () => {
    await show();
    expect(Array.from(host.querySelectorAll('button')).some((b) => b.textContent === 'Show more')).toBe(false);
  });
});
