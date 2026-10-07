// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ status: 'default' as string | null, role: 'student' }));
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext({ user: { id: 1, role: 'student' } }), useAuth: () => ({ user: { id: 1, role: h.role } }) };
});
vi.mock('../../lib/i18n/react', async () => {
  const actual = await vi.importActual<typeof import('../../lib/i18n/react')>('../../lib/i18n/react');
  const { t } = await vi.importActual<typeof import('../../lib/i18n')>('../../lib/i18n');
  const locale = () => (h.role === 'curator' ? 'ru' : 'en');
  return { ...actual, useLocale: locale, useT: () => (key: never, params?: never) => t(key, params, locale()) };
});
vi.mock('../../services/webPush', () => ({ usePushStatus: () => h.status, enablePush: vi.fn(), disablePush: vi.fn() }));
vi.mock('../pwa/useInstallFlow', async () => {
  const { installCopy } = await vi.importActual<typeof import('../pwa/installCopy')>('../pwa/installCopy');
  return {
    useInstallFlow: () => ({
      snapshot: { platform: { platform: 'android' } },
      t: installCopy(h.role === 'curator' ? 'ru' : 'en'),
      start: vi.fn(),
      sheet: null,
      oneTap: false,
    }),
  };
});

import PushSection from './PushSection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<PushSection />));
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  Object.assign(h, { status: 'default', role: 'student' });
});

describe('Settings → Push on this device', () => {
  it('is about every notification switched on for Push, not only lesson reminders', async () => {
    await mount();
    expect(host.textContent).toContain('Notifications on this device');
    expect(host.textContent).toContain('the events you switch on for Push above');
    expect(host.textContent).toContain('Off on this device.');
    expect(host.textContent).not.toContain('Lesson reminders are on');
  });

  it('a refusal says how to allow it again', async () => {
    h.status = 'denied';
    await mount();
    expect(host.textContent).toContain('Notifications are blocked');
    expect(host.textContent).toContain('App info → Notifications');
  });

  it('an iPhone tab keeps the install-first note', async () => {
    h.status = 'needs-install';
    await mount();
    expect(host.textContent).toContain('On iPhone, notifications come through the installed app.');
  });

  it('curators read it in Russian', async () => {
    h.role = 'curator';
    await mount();
    expect(host.textContent).toContain('Уведомления на этом устройстве');
  });
});
