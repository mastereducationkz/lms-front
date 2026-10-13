// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getTelegramStatus: vi.fn(),
  createTelegramLink: vi.fn(),
  unlinkTelegram: vi.fn(),
}));
vi.mock('../../services/api/notificationCenter', () => api);
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: { id: 7, role: 'student' } }) };
});
vi.mock('@/lib/i18n/react', async () => {
  const actual = await vi.importActual<typeof import('@/lib/i18n/react')>('@/lib/i18n/react');
  const { t } = await vi.importActual<typeof import('@/lib/i18n')>('@/lib/i18n');
  return { ...actual, useLocale: () => 'ru', useT: () => (key: never, params?: never) => t(key, params, 'ru') };
});

import { POLL_MS, WAIT_MS } from '@/lib/telegramLink';
import { SNOOZE_DAYS, THANKS_MS } from '@/lib/leagueTelegram';
import LeagueTelegramLine from './LeagueTelegramLine';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const status = (over = {}) => ({
  status: 'unlinked', linked: false, blocked: false, muted: false, telegram_username: null, linked_at: null, stale: false, ...over,
});
const LINKED = status({ status: 'linked', linked: true });
const LINK = 'https://t.me/MasterEduBot?start=abc';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
  };
}

let root: Root | null = null;
let host: HTMLDivElement;
async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LeagueTelegramLine userId={7} />));
}
const text = () => host.textContent ?? '';
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
const click = (el: Element) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 13, 10, 0, 0)));
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
  Object.values(api).forEach((fn) => fn.mockReset());
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.useRealTimers();
});

describe('the Connect Telegram line, mounted', () => {
  it('shows nothing while the status loads', async () => {
    api.getTelegramStatus.mockReturnValue(new Promise(() => {}));
    await mount();
    expect(host.innerHTML).toBe('');
  });

  it('shows nothing when the status call fails, and nothing when Support could not be reached', async () => {
    api.getTelegramStatus.mockRejectedValue(new Error('network'));
    await mount();
    expect(host.innerHTML).toBe('');
    act(() => root?.unmount());
    host.remove();
    api.getTelegramStatus.mockResolvedValue(status({ stale: true }));
    await mount();
    expect(host.innerHTML).toBe('');
  });

  it('shows nothing to someone who blocked the bot: never nag', async () => {
    api.getTelegramStatus.mockResolvedValue(status({ status: 'blocked', blocked: true }));
    await mount();
    expect(host.innerHTML).toBe('');
  });

  it('shows nothing, and stops asking, for someone already connected', async () => {
    api.getTelegramStatus.mockResolvedValue(LINKED);
    await mount();
    expect(host.innerHTML).toBe('');
    act(() => root?.unmount());
    host.remove();
    await mount();
    expect(api.getTelegramStatus).toHaveBeenCalledTimes(1);
    expect(host.innerHTML).toBe('');
  });

  it('offers once the status is known and there is no link', async () => {
    api.getTelegramStatus.mockResolvedValue(status());
    await mount();
    expect(text()).toContain('Подключить Telegram');
    expect(text()).toContain('Не сейчас');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('«Не сейчас» hides it at once and for seven days, with no server call in between', async () => {
    api.getTelegramStatus.mockResolvedValue(status());
    await mount();
    await click(button('Не сейчас'));
    expect(host.innerHTML).toBe('');
    act(() => root?.unmount());
    host.remove();
    vi.setSystemTime(Date.now() + (SNOOZE_DAYS - 1) * 86_400_000);
    await mount();
    expect(host.innerHTML).toBe('');
    expect(api.getTelegramStatus).toHaveBeenCalledTimes(1);
    act(() => root?.unmount());
    host.remove();
    vi.setSystemTime(Date.now() + 2 * 86_400_000);
    await mount();
    expect(text()).toContain('Подключить Telegram');
    expect(api.getTelegramStatus).toHaveBeenCalledTimes(2);
  });

  it('connect makes one link however many times it is clicked, then offers it as a real anchor', async () => {
    api.getTelegramStatus.mockResolvedValue(status());
    let resolve!: (v: unknown) => void;
    api.createTelegramLink.mockReturnValue(new Promise((r) => { resolve = r; }));
    await mount();
    const connect = button('Подключить Telegram');
    await click(connect);
    await click(connect);
    await click(connect);
    expect(api.createTelegramLink).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ deep_link: LINK }));
    const anchor = host.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe(LINK);
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toContain('noopener');
    expect(text()).toContain('Откройте Telegram и нажмите Start');
  });

  it('polls until Start, thanks the student, and is gone for good after a few seconds', async () => {
    api.getTelegramStatus.mockResolvedValue(status());
    api.createTelegramLink.mockResolvedValue({ deep_link: LINK });
    await mount();
    await click(button('Подключить Telegram'));
    api.getTelegramStatus.mockResolvedValue(status({ status: 'pending' }));
    await tick(POLL_MS);
    expect(text()).toContain('Откройте Telegram и нажмите Start');
    api.getTelegramStatus.mockResolvedValue(LINKED);
    await tick(POLL_MS);
    expect(text()).toContain('Готово, Telegram подключён. Спасибо');
    expect(host.querySelector('button')).toBeNull();
    await tick(THANKS_MS);
    expect(host.innerHTML).toBe('');
    // and next time it never even asks
    act(() => root?.unmount());
    host.remove();
    api.getTelegramStatus.mockClear();
    await mount();
    expect(api.getTelegramStatus).not.toHaveBeenCalled();
  });

  it('suggests a fresh link when Start never came', async () => {
    api.getTelegramStatus.mockResolvedValue(status({ status: 'pending' }));
    api.createTelegramLink.mockResolvedValue({ deep_link: LINK });
    await mount();
    await click(button('Подключить Telegram'));
    await tick(WAIT_MS + POLL_MS);
    expect(text()).toContain('Не дождались');
    expect(button('Подключить Telegram')).toBeTruthy();
  });

  it('says so, and offers again, when the server gives no Telegram link', async () => {
    api.getTelegramStatus.mockResolvedValue(status());
    api.createTelegramLink.mockResolvedValue({ deep_link: 'https://evil.example/x' });
    await mount();
    await click(button('Подключить Telegram'));
    expect(text()).toContain('Не получилось');
    expect(host.querySelector('a')).toBeNull();
    expect(button('Подключить Telegram').disabled).toBe(false);
  });
});
