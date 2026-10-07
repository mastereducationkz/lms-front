// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../types';

const h = vi.hoisted(() => ({ save: vi.fn(), toastError: vi.fn(), released: true }));
vi.mock('../../lib/i18n/release', () => ({ languageSwitchEnabled: () => h.released }));
vi.mock('../../services/api/auth', () => ({ saveUiLanguage: (language: 'en' | 'ru') => h.save(language) }));
vi.mock('../../services/api/uiState', () => ({ saveLookupLang: vi.fn(async () => ({})) }));
vi.mock('sonner', () => ({ toast: { error: h.toastError } }));
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext, useContext } = await import('react');
  const Ctx = createContext<unknown>(null);
  return { default: Ctx, useAuth: () => useContext(Ctx) };
});

import AuthContext from '../../contexts/AuthContext';
import LanguageSection from './LanguageSection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Person = Pick<User, 'id' | 'role' | 'ui_language'>;

function Harness({ initial }: { initial: Person }) {
  const [user, setUser] = useState<Person>(initial);
  const value = { user, updateUser: (next: Person) => setUser(next) } as never;
  return (
    <AuthContext.Provider value={value}>
      <LanguageSection />
      <output>{user.ui_language ?? 'role default'}</output>
    </AuthContext.Provider>
  );
}

let root: Root | null = null;
let host: HTMLDivElement;
async function mount(initial: Person) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<Harness initial={initial} />));
}
const radio = (name: string) => [...host.querySelectorAll('[role=radio]')].find((b) => b.textContent === name) as HTMLButtonElement;
const saved = () => host.querySelector('output')!.textContent;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  h.save.mockReset();
  h.toastError.mockReset();
  h.released = true;
});

describe('Settings → App language', () => {
  it('only shows the language until the switch is released', async () => {
    h.released = false;
    await mount({ id: '4', role: 'curator' });
    expect(radio('English')).toBeUndefined();
    expect(host.textContent).toContain('Скоро его можно будет сменить здесь.');
  });

  it('starts on the role’s language and switches a student to Russian', async () => {
    h.save.mockImplementation(async (language: string) => ({ id: 1, role: 'student', ui_language: language }));
    await mount({ id: '1', role: 'student' });
    expect(radio('English').getAttribute('aria-checked')).toBe('true');
    expect(host.textContent).toContain('Language & Look Up');

    await act(async () => radio('Русский').click());
    expect(h.save).toHaveBeenCalledWith('ru');
    expect(saved()).toBe('ru');
    expect(radio('Русский').getAttribute('aria-checked')).toBe('true');
    expect(host.textContent).toContain('Язык и перевод слов');
  });

  it('lets a curator choose English', async () => {
    h.save.mockImplementation(async (language: string) => ({ id: 2, role: 'curator', ui_language: language }));
    await mount({ id: '2', role: 'curator' });
    expect(radio('Русский').getAttribute('aria-checked')).toBe('true');

    await act(async () => radio('English').click());
    expect(h.save).toHaveBeenCalledWith('en');
    expect(host.textContent).toContain('Language & Look Up');
  });

  it('puts the old language back when saving fails', async () => {
    h.save.mockRejectedValue(new Error('offline'));
    await mount({ id: '3', role: 'teacher' });

    await act(async () => radio('Русский').click());
    expect(saved()).toBe('role default');
    expect(radio('English').getAttribute('aria-checked')).toBe('true');
    expect(h.toastError).toHaveBeenCalledWith('Couldn’t save your language. Try again.');
  });
});
