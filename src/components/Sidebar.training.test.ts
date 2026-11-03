// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear() },
  });
});

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function navigation(trainingBuild: boolean) {
  vi.resetModules();
  vi.stubEnv('VITE_APP_ENV', trainingBuild ? 'training' : 'production');
  const { getNavigationItems } = await import('./Sidebar');
  const { t } = await import('../lib/i18n');
  return (role: string) => getNavigationItems((k, p) => t(k, p, 'en'), role, 0)
    .filter(([, , , , roles]) => roles === null || (roles as string[]).includes(role))
    .map(([to]) => to);
}

describe('the practice inbox link', () => {
  it('is in the sidebar of every role in the training build, marketing included', async () => {
    const paths = await navigation(true);
    for (const role of ['admin', 'teacher', 'head_teacher', 'curator', 'head_curator']) {
      expect(paths(role)).toContain('/inbox');
    }
    expect(paths('marketing')).toEqual(['/admin/trial-links', '/inbox']);
  }, 30_000);

  it('does not exist in the production build', async () => {
    const paths = await navigation(false);
    for (const role of ['admin', 'teacher', 'curator']) {
      expect(paths(role)).not.toContain('/inbox');
    }
    expect(paths('marketing')).toEqual(['/admin/trial-links']);
  }, 30_000);
});
