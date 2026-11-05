// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, text, unmount } from '../pages/publicWebinarsTestKit';

vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear() },
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => { await unmount(); vi.unstubAllEnvs(); vi.resetModules(); });

async function banner(path = '/dashboard', locale: 'en' | 'ru' = 'en') {
  vi.resetModules();
  (await import('../lib/i18n/locale')).setActiveLocale(locale);
  const { default: TrainingBanner } = await import('./TrainingBanner');
  await mount(<MemoryRouter initialEntries={[path]}><TrainingBanner /></MemoryRouter>);
}

describe('the training banner', () => {
  it('is on screen in the training build, with the commit', async () => {
    vi.stubEnv('VITE_APP_ENV', 'training');
    vi.stubEnv('VITE_STAGING_COMMIT', 'abcdef0123456789');
    await banner();
    expect(text()).toBe('TRAINING COPY · nothing you do here leaves it · abcdef0');
    expect(document.querySelector('[role=status]')).not.toBeNull();
    expect(document.querySelector('[data-training-banner]')).not.toBeNull(); // the recorder hides the banner by this attribute
  });

  it('says it without a commit when the build has none, never «unknown»', async () => {
    vi.stubEnv('VITE_APP_ENV', 'training');
    vi.stubEnv('VITE_STAGING_COMMIT', '');
    await banner();
    expect(text()).toBe('TRAINING COPY · nothing you do here leaves it');
    expect(text()).not.toContain('unknown');
  });

  it('is hidden on the sign-in page, which says what it is itself', async () => {
    vi.stubEnv('VITE_APP_ENV', 'training');
    vi.stubEnv('VITE_STAGING_COMMIT', 'abcdef0123456789');
    await banner('/training-login');
    expect(text()).toBe('');
  });

  it('speaks Russian to a person who reads Russian', async () => {
    vi.stubEnv('VITE_APP_ENV', 'training');
    vi.stubEnv('VITE_STAGING_COMMIT', 'abcdef0123456789');
    await banner('/dashboard', 'ru');
    expect(text()).toBe('ТРЕНАЖЁР · учебная копия · сообщения никуда не уходят · abcdef0');
  });

  it('is not there in production or staging builds', async () => {
    for (const env of ['production', 'staging', '']) {
      vi.stubEnv('VITE_APP_ENV', env);
      await banner();
      expect(text()).toBe('');
      await unmount();
    }
  });
});
