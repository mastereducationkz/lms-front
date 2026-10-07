// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The card inside the installed app (standalone): «Turn on notifications». The pieces around it
// (pacing, the one-prompt gate, the push service) are tested on their own; here they're stubs.
const h = vi.hoisted(() => ({
  role: 'student',
  status: 'default' as string | null,
  allowed: true,
  enablePush: vi.fn(async () => 'granted'),
  dismissPushNudge: vi.fn(),
  noteShown: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  const ctx = createContext({ user: { id: 1, role: 'student' } });
  return { default: ctx, useAuth: () => ({ user: { id: 1, role: h.role } }) };
});
vi.mock('../../lib/i18n/react', async () => {
  const actual = await vi.importActual<typeof import('../../lib/i18n/react')>('../../lib/i18n/react');
  return { ...actual, useLocale: () => (h.role === 'curator' || h.role === 'head_curator' ? 'ru' : 'en') };
});
vi.mock('../../services/pwaInstall', () => ({
  usePwaInstall: () => ({
    platform: { platform: 'ios-safari', shareInMoreMenu: false, iosBrowser: 'safari', inAppName: null },
    displayMode: 'standalone',
    canPrompt: false,
    installedHere: false,
    user: { id: 1, role: h.role },
    nudge: {},
  }),
  installNudgeVisible: () => false,
  pushNudgeVisible: (s: { displayMode: string }) => s.displayMode === 'standalone',
  dismissInstallNudge: vi.fn(),
  dismissPushNudge: h.dismissPushNudge,
  trackPwa: vi.fn(),
  promptInstall: vi.fn(),
  markInstalledByHand: vi.fn(),
}));
vi.mock('../../services/webPush', () => ({ usePushStatus: () => h.status, enablePush: h.enablePush }));
vi.mock('./useDashboardPrompt', () => ({ useDashboardPrompt: () => ({ allowed: h.allowed, noteShown: h.noteShown }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { toast } from 'sonner';
import InstallAppCard from './InstallAppCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function mount(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(node));
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.clearAllMocks();
  Object.assign(h, { role: 'student', status: 'default', allowed: true });
});

describe('«Turn on notifications» inside the installed app', () => {
  it('students: about notifications in general, and one tap turns push on', async () => {
    await mount(<InstallAppCard />);
    expect(host.textContent).toContain('Turn on notifications');
    expect(host.textContent).toContain('Lesson reminders, new homework, grades and messages');
    const turnOn = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Turn on')!;
    await act(async () => turnOn.click());
    expect(h.enablePush).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Notifications are on for this device');
    expect(h.noteShown).toHaveBeenCalled();
  });

  it('teachers get the one-line version', async () => {
    h.role = 'teacher';
    await mount(<InstallAppCard variant="teacher" />);
    expect(host.textContent).toContain('Get notifications on this device');
  });

  it('curators read it in Russian (staff dashboards: push only)', async () => {
    h.role = 'curator';
    await mount(<InstallAppCard variant="teacher" only="push" />);
    expect(host.textContent).toContain('Получайте уведомления на этом устройстве');
    expect(host.textContent).toContain('Включить');
  });

  it('never once subscribed, refused, unsupported or still checking', async () => {
    for (const status of ['granted', 'denied', 'unsupported', 'needs-install', null]) {
      h.status = status;
      await mount(<InstallAppCard />);
      expect(host.textContent).toBe('');
      act(() => root?.unmount());
      host.remove();
    }
  });

  it('waits its turn behind the one-prompt gate', async () => {
    h.allowed = false;
    await mount(<InstallAppCard />);
    expect(host.textContent).toBe('');
  });

  it('a refusal in the permission dialog snoozes the card and points to Settings', async () => {
    h.enablePush.mockResolvedValueOnce('denied');
    await mount(<InstallAppCard />);
    const turnOn = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Turn on')!;
    await act(async () => turnOn.click());
    expect(toast).toHaveBeenCalledWith('Notifications are blocked. You can allow them in Settings.');
    expect(h.dismissPushNudge).toHaveBeenCalled();
  });

  it('«Not now» snoozes it', async () => {
    await mount(<InstallAppCard />);
    const notNow = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Not now')!;
    await act(async () => notNow.click());
    expect(h.dismissPushNudge).toHaveBeenCalled();
  });
});
