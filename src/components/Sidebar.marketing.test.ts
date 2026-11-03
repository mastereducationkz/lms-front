// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

// Sidebar imports the axios client, which reads stored tokens on import.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear() },
  });
});

const { getNavigationItems } = await import('./Sidebar');
const { t } = await import('../lib/i18n');

const paths = (role: string) => getNavigationItems((k, p) => t(k, p, 'en'), role, 0)
  .filter(([, , , , roles]) => roles === null || (roles as string[]).includes(role))
  .map(([to]) => to);

describe('the marketing role in the sidebar', () => {
  it('sees only the trial links page', () => {
    expect(paths('marketing')).toEqual(['/admin/trial-links']);
  });
  it('admins and head curators see it next to Trial Access', () => {
    expect(paths('admin')).toContain('/admin/trial-links');
    expect(paths('head_curator')).toContain('/admin/trial-links');
    expect(paths('teacher')).not.toContain('/admin/trial-links');
  });
});
