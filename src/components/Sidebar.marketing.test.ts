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

const paths = (role: string, trainingOn = true) => getNavigationItems((k, p) => t(k, p, 'en'), role, 0, 0, false, 0, undefined, false, trainingOn)
  .filter(([, , , , roles]) => roles === null || (roles as string[]).includes(role))
  .map(([to]) => to);

describe('the marketing role in the sidebar', () => {
  it('sees the trial links page and staff training, nothing else', () => {
    expect(paths('marketing')).toEqual(['/admin/trial-links', '/training']);
  });
  it('admins and head curators see it next to Trial Access', () => {
    expect(paths('admin')).toContain('/admin/trial-links');
    expect(paths('head_curator')).toContain('/admin/trial-links');
    expect(paths('teacher')).not.toContain('/admin/trial-links');
  });
});

describe('staff training in the sidebar', () => {
  it('stays hidden for everyone until the backend says it is switched on', () => {
    for (const role of ['admin', 'teacher', 'head_teacher', 'curator', 'head_curator', 'marketing']) {
      expect(paths(role, false), role).not.toContain('/training');
    }
    expect(paths('marketing', false)).toEqual(['/admin/trial-links']);
  });

  it('is there for every staff role and never for students or parents', () => {
    for (const role of ['admin', 'teacher', 'head_teacher', 'curator', 'head_curator', 'marketing']) {
      expect(paths(role), role).toContain('/training');
    }
    for (const role of ['student', 'parent']) expect(paths(role), role).not.toContain('/training');
  });
});
