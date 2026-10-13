// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getResultConsent: vi.fn(), answerResultConsent: vi.fn() }));
vi.mock('@/services/api/masterLeague', () => api);
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: { id: 7, role: 'student' } }) };
});
vi.mock('@/lib/i18n/react', async () => {
  const actual = await vi.importActual<typeof import('@/lib/i18n/react')>('@/lib/i18n/react');
  const { t } = await vi.importActual<typeof import('@/lib/i18n')>('@/lib/i18n');
  return { ...actual, useLocale: () => 'ru', useT: () => (key: never, params?: never) => t(key, params, 'ru') };
});

import LeagueResultConsent from './LeagueResultConsent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ask = { state: 'ask', result_total: 1520, decision: null, can_answer: true };
let root: Root | null = null;
let host: HTMLDivElement;
async function mount(enabled = true) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LeagueResultConsent enabled={enabled} />));
}
const text = () => host.textContent ?? '';
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
const click = (el: Element) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe('the result question, mounted', () => {
  it('asks nothing of the server before the exam is over (not enabled)', async () => {
    await mount(false);
    expect(api.getResultConsent).not.toHaveBeenCalled();
    expect(host.innerHTML).toBe('');
  });

  it('shows nothing while loading and when there is no verified result or the call failed', async () => {
    api.getResultConsent.mockReturnValue(new Promise(() => {}));
    await mount();
    expect(host.innerHTML).toBe('');
    act(() => root?.unmount());
    host.remove();
    api.getResultConsent.mockResolvedValue(null);
    await mount();
    expect(host.innerHTML).toBe('');
  });

  it('asks, and a double click is one answer', async () => {
    api.getResultConsent.mockResolvedValue(ask);
    let resolve!: (v: unknown) => void;
    api.answerResultConsent.mockReturnValue(new Promise((r) => { resolve = r; }));
    await mount();
    expect(text()).toContain('Ваш результат записан: 1520');
    const yes = button('Да, поздравьте');
    await click(yes);
    await click(yes);
    expect(api.answerResultConsent).toHaveBeenCalledTimes(1);
    expect(api.answerResultConsent).toHaveBeenCalledWith('yes');
    await act(async () => resolve({ ...ask, state: 'yes', decision: 'yes' }));
    expect(text()).toContain('Договорились');
    expect(button('Передумали? Не публиковать')).toBeTruthy();
  });

  it('no is a plain no, and can be changed back by the student', async () => {
    api.getResultConsent.mockResolvedValue(ask);
    api.answerResultConsent.mockResolvedValueOnce({ ...ask, state: 'no', decision: 'no' });
    await mount();
    await click(button('Нет, спасибо'));
    expect(api.answerResultConsent).toHaveBeenCalledWith('no');
    expect(text()).toContain('ничего не появится');
    api.answerResultConsent.mockResolvedValueOnce({ ...ask, state: 'yes', decision: 'yes' });
    await click(button('Всё-таки поздравьте меня'));
    expect(api.answerResultConsent).toHaveBeenLastCalledWith('yes');
    expect(text()).toContain('Договорились');
  });

  it('keeps the question open and says so when the answer could not be saved', async () => {
    api.getResultConsent.mockResolvedValue(ask);
    api.answerResultConsent.mockRejectedValue(new Error('500'));
    await mount();
    await click(button('Да, поздравьте'));
    expect(text()).toContain('Не получилось сохранить ответ');
    expect(button('Да, поздравьте').disabled).toBe(false);
    api.answerResultConsent.mockResolvedValue({ ...ask, state: 'yes', decision: 'yes' });
    await click(button('Да, поздравьте'));
    expect(text()).toContain('Договорились');
    expect(text()).not.toContain('Не получилось');
  });
});
