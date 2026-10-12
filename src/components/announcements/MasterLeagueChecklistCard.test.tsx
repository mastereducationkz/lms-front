// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin' } }) };
});
const get = vi.fn();
vi.mock('../../services/api/client', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

import { setActiveLocale } from '../../lib/i18n';
import { MasterLeagueChecklistCard } from './MasterLeagueChecklistCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SERVER_ORDER = ['chat_found', 'one_active_row', 'supergroup', 'bot_admin', 'approved', 'linked', 'teacher_email'];
const group = (id: number, name: string, done: string[], over: Record<string, boolean | null> = {}, extra: Record<string, unknown> = {}) => {
  const steps = SERVER_ORDER.map((key) => ({ key, label: `Метка ${key}`, ok: key in over ? over[key] : done.includes(key), hint: `Подсказка ${key}` }));
  return { id, name, teacher_name: 'Ayanat', ready: steps.every((s) => s.ok === true), steps, ...extra };
};
const checklist = (groups: unknown[], registry_error: string | null = null) => ({ data: { registry_error, groups } });

let root: Root | null = null;
let host: HTMLDivElement;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function show(props: Parameters<typeof MasterLeagueChecklistCard>[0] = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MasterLeagueChecklistCard {...props} />); });
  await settle();
}
const rerender = async (props: Parameters<typeof MasterLeagueChecklistCard>[0]) => {
  await act(async () => { root!.render(<MasterLeagueChecklistCard {...props} />); });
  await settle();
};
const click = async (el: Element | null | undefined) => {
  await act(async () => { (el as HTMLElement).click(); });
  await settle();
};
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(label));

beforeEach(() => {
  get.mockReset();
  setActiveLocale('en');
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  setActiveLocale('en');
});

describe('Master League Telegram checklist card', () => {
  it('reads the live checklist without the request cache', async () => {
    get.mockResolvedValue(checklist([]));
    await show();
    expect(get).toHaveBeenCalledWith('/master-league/telegram-checklist', { cache: false });
  });

  it('says it is checking while the first answer is on its way', async () => {
    get.mockReturnValue(new Promise(() => undefined));
    await show();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Checking the Master League chats');
  });

  it('renders nothing when no Master League group is live', async () => {
    get.mockResolvedValue(checklist([]));
    await show();
    expect(host.innerHTML).toBe('');
  });

  it('shows progress, the step to do now with its exact fix, and holds the later steps back', async () => {
    get.mockResolvedValue(checklist([group(376, 'Master League Dreamville', ['chat_found', 'one_active_row', 'teacher_email'])]));
    await show();
    expect(host.textContent).toContain('Master League Dreamville');
    expect(host.textContent).toContain('Teacher: Ayanat');
    expect(host.textContent).toContain('Steps done: 3 of 7');
    expect(host.textContent).toContain('Next: Bot is a chat administrator');

    const items = [...host.querySelectorAll('ol > li')];
    expect(items).toHaveLength(7);
    expect(host.querySelectorAll('ol')).toHaveLength(1);
    const current = host.querySelector('[aria-current="step"]')!;
    expect(current.textContent).toContain('Bot is a chat administrator');
    expect(current.textContent).toContain('make the bot an administrator of “Master League Dreamville”');
    expect(current.textContent).toContain('Do this now');
    // Later steps say what they wait for, not what to do.
    const supergroup = items.find((li) => li.textContent?.includes('Telegram made the chat a supergroup'))!;
    expect(supergroup.textContent).toContain('After: Bot is a chat administrator');
    expect(supergroup.textContent).not.toContain('Nothing to do but wait');
    // A finished step says so to a screen reader.
    expect(items[0].textContent).toContain('Done');
  });

  it('takes the approval step to the Groups tab', async () => {
    const onOpenGroups = vi.fn();
    get.mockResolvedValue(checklist([group(1, 'Master League KOD', ['chat_found', 'one_active_row', 'bot_admin', 'supergroup', 'teacher_email'])]));
    await show({ onOpenGroups });
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Approve “Master League KOD” in the Groups tab');
    await click(button('Open the Groups tab'));
    expect(onOpenGroups).toHaveBeenCalledTimes(1);
  });

  it('folds a finished group away and shows it as all set', async () => {
    get.mockResolvedValue(checklist([
      group(1, 'Master League KOD', SERVER_ORDER),
      group(2, 'Master League Dreamville', ['chat_found']),
    ]));
    await show();
    const details = host.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('All set');
    expect(host.querySelectorAll('section')).toHaveLength(1);
  });

  it('marks the chat steps as not checked, not failed, while Support is down', async () => {
    const down = { chat_found: null, one_active_row: null, supergroup: null, bot_admin: null, approved: null } as const;
    get.mockResolvedValue(checklist([group(1, 'Master League KOD', ['teacher_email'], down)], 'Support is unavailable'));
    await show();
    expect(host.textContent).toContain('Support is not answering');
    expect(host.textContent).toContain('Support is unavailable');
    expect(host.textContent).toContain('Not checked');
    expect(host.textContent).toContain('Steps done: 1 of 7');
    expect(host.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('names what failed, with the backend’s reason, and tries again on request', async () => {
    get.mockRejectedValueOnce({ response: { data: { detail: 'Not enough permissions' } } });
    get.mockResolvedValueOnce(checklist([group(1, 'Master League KOD', ['chat_found'])]));
    await show();
    const alert = host.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Could not load the Master League checklist.');
    expect(alert.textContent).toContain('Not enough permissions');

    await click(button('Try again'));
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Steps done: 1 of 7');
  });

  it('keeps the last result on screen when a refresh fails', async () => {
    get.mockResolvedValueOnce(checklist([group(1, 'Master League KOD', ['chat_found'])]));
    get.mockRejectedValueOnce(new Error('Network Error'));
    await show();
    await click(button('Refresh'));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Network Error');
    expect(host.textContent).toContain('Steps done: 1 of 7');
  });

  it('refreshes on demand and when the links below change', async () => {
    get.mockResolvedValue(checklist([group(1, 'Master League KOD', ['chat_found'])]));
    await show({ refreshKey: 0 });
    expect(get).toHaveBeenCalledTimes(1);
    await click(button('Refresh'));
    expect(get).toHaveBeenCalledTimes(2);
    await rerender({ refreshKey: 1 });
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('lets only the newest answer win when two reads overlap', async () => {
    let slow!: (v: unknown) => void;
    get.mockReturnValueOnce(new Promise((resolve) => { slow = resolve; }));
    get.mockResolvedValueOnce(checklist([group(1, 'Master League KOD', ['chat_found', 'one_active_row'])]));
    await show();
    await rerender({ refreshKey: 1 });
    expect(host.textContent).toContain('Steps done: 2 of 7');
    await act(async () => { slow(checklist([group(1, 'Master League KOD', [])])); });
    expect(host.textContent).toContain('Steps done: 2 of 7');
  });

  it('speaks Russian to a Russian reader', async () => {
    setActiveLocale('ru');
    get.mockResolvedValue(checklist([group(1, 'Master League KOD', ['chat_found', 'one_active_row', 'teacher_email'])]));
    await show();
    expect(host.textContent).toContain('Master League: настройка Telegram');
    expect(host.textContent).toContain('Готово шагов: 3 из 7');
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('сделайте бота администратором чата «Master League KOD»');
  });

  it('shows the server’s own words for a step it has no copy for', async () => {
    const g = group(1, 'Master League KOD', SERVER_ORDER);
    g.ready = false;
    g.steps.push({ key: 'future_step', label: 'Новый шаг', ok: false, hint: 'Сделайте то-то' });
    get.mockResolvedValue(checklist([g]));
    await show();
    const current = host.querySelector('[aria-current="step"]')!;
    expect(current.textContent).toContain('Новый шаг');
    expect(current.textContent).toContain('Сделайте то-то');
  });
});
