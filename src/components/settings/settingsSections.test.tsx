// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { logout } = vi.hoisted(() => ({ logout: vi.fn(async () => undefined) }));
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  const auth = { user: { id: 7, role: 'student' }, logout };
  // useT reads the context itself (lib/i18n/react), so the default export is the context.
  return { useAuth: () => auth, default: createContext(auth) };
});
vi.mock('../../services/api/auth', () => ({ changePassword: vi.fn() }));
vi.mock('../../services/sessions', () => ({ signOutOtherDevices: vi.fn() }));
vi.mock('../../services/api/notificationCenter', () => ({ getNotificationSettings: vi.fn(), saveNotificationSettings: vi.fn() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { toast } from 'sonner';
import { changePassword } from '../../services/api/auth';
import { signOutOtherDevices } from '../../services/sessions';
import { getNotificationSettings, saveNotificationSettings, type NotificationSettings } from '../../services/api/notificationCenter';
import SecuritySection from './SecuritySection';
import NotificationsSection from './NotificationsSection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function mount(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={node} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}
const type = async (id: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.clearAllMocks();
});

describe('Security: change password (owner Q18)', () => {
  // A block body: a function returned from beforeEach would run as the test's teardown.
  beforeEach(() => {
    vi.mocked(changePassword).mockResolvedValue({ detail: 'ok' });
  });

  it('a new password signs this device out too: says so, logs out, goes to sign-in', async () => {
    await mount(<SecuritySection />);
    await type('pw-current', 'old-pass1');
    await type('pw-new', 'new-pass2');
    await type('pw-confirm', 'new-pass2');
    await act(async () => button('Change password').click());
    expect(changePassword).toHaveBeenCalledWith('old-pass1', 'new-pass2');
    expect(toast.success).toHaveBeenCalledWith('Password changed', expect.objectContaining({ description: expect.stringContaining('every device') }));
    expect(logout).toHaveBeenCalled();
    expect(host.textContent).toContain('login page');
  });

  it('keeps the policy: no digit, no submit', async () => {
    await mount(<SecuritySection />);
    await type('pw-current', 'old-pass1');
    await type('pw-new', 'nodigitshere');
    await type('pw-confirm', 'nodigitshere');
    expect(button('Change password').disabled).toBe(true);
  });

  it('a refused change stays on the page', async () => {
    vi.mocked(changePassword).mockImplementation(async () => {
      throw new Error('Current password is incorrect');
    });
    await mount(<SecuritySection />);
    await type('pw-current', 'wrong-1');
    await type('pw-new', 'new-pass2');
    await type('pw-confirm', 'new-pass2');
    await act(async () => button('Change password').click());
    expect(toast.error).toHaveBeenCalledWith('Current password is incorrect');
    expect(logout).not.toHaveBeenCalled();
  });

  it('«Sign out other devices» reports how many ended', async () => {
    vi.mocked(signOutOtherDevices).mockResolvedValue(2);
    await mount(<SecuritySection />);
    await act(async () => button('Sign out other devices').click());
    expect(signOutOtherDevices).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Signed out of 2 other sessions');
  });
});

describe('Notifications: per event × channel', () => {
  const doc = (email: boolean): NotificationSettings => ({
    language: 'en',
    channels: { in_app: { available: true }, email: { available: true }, telegram: { available: false }, push: { available: false }, web_push: { available: false } },
    events: [
      {
        key: 'lesson_starting',
        label: 'Lesson starting soon',
        description: '30 minutes before each lesson.',
        channels: {
          in_app: { enabled: true, default: true, switchable: false },
          email: { enabled: email, default: true, switchable: true },
          telegram: { enabled: true, default: true, switchable: true },
        },
      },
    ],
    quiet_hours: { enabled: false, start: '22:00', end: '08:00', timezone: 'Asia/Almaty' },
  });
  const emailBox = () => host.querySelector<HTMLButtonElement>('#n-lesson_starting-email-w')!;

  it('a flip sends only that switch and keeps the server’s answer', async () => {
    vi.mocked(getNotificationSettings).mockResolvedValue(doc(true));
    vi.mocked(saveNotificationSettings).mockResolvedValue(doc(false));
    await mount(<NotificationsSection />);
    expect(emailBox().getAttribute('data-state')).toBe('checked');
    await act(async () => emailBox().click());
    expect(saveNotificationSettings).toHaveBeenCalledWith({ events: { lesson_starting: { email: false } } });
    expect(emailBox().getAttribute('data-state')).toBe('unchecked');
  });

  it('a refused save puts the switch back', async () => {
    vi.mocked(getNotificationSettings).mockResolvedValue(doc(true));
    vi.mocked(saveNotificationSettings).mockImplementation(async () => {
      throw new Error('500');
    });
    await mount(<NotificationsSection />);
    await act(async () => emailBox().click());
    expect(emailBox().getAttribute('data-state')).toBe('checked');
    expect(toast.error).toHaveBeenCalled();
  });

  it('quiet hours start off and save when switched on', async () => {
    vi.mocked(getNotificationSettings).mockResolvedValue(doc(true));
    vi.mocked(saveNotificationSettings).mockImplementation(async (u) => ({ ...doc(true), quiet_hours: u.quiet_hours! }));
    await mount(<NotificationsSection />);
    const quiet = host.querySelector<HTMLButtonElement>('#quiet-on')!;
    expect(quiet.getAttribute('data-state')).toBe('unchecked');
    await act(async () => quiet.click());
    expect(saveNotificationSettings).toHaveBeenCalledWith({ quiet_hours: { enabled: true, start: '22:00', end: '08:00', timezone: 'Asia/Almaty' } });
    expect(host.querySelector('#quiet-start')).not.toBeNull();
  });
});
