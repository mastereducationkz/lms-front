// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage, mount, settle, text, unmount } from '../publicWebinarsTestKit';

vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear() },
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const updateUser = vi.fn();
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { useAuth: () => ({ updateUser }), default: createContext(undefined) };
});
const redeem = vi.fn();
vi.mock('../../services/api/trainingCopy', () => ({ redeemTrainingLink: (t: string) => redeem(t) }));

const { default: TrainingLoginPage } = await import('./TrainingLoginPage');

async function open(search: string, strict = false) {
  window.history.replaceState(null, '', `/training-login${search}`);
  const tree = (
    <MemoryRouter initialEntries={[`/training-login${search}`]}>
      <Routes>
        <Route path="/training-login" element={<TrainingLoginPage />} />
        <Route path="/attendance" element={<p>ATTENDANCE PAGE</p>} />
        <Route path="/dashboard" element={<p>DASHBOARD PAGE</p>} />
      </Routes>
    </MemoryRouter>
  );
  const React = await import('react');
  await mount(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
  await settle();
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  redeem.mockReset();
  updateUser.mockReset();
});
afterEach(async () => { await unmount(); vi.unstubAllGlobals(); });

describe('/training-login', () => {
  it('spends the link once, signs in and goes to the path prod chose', async () => {
    redeem.mockResolvedValue({ user: { id: 1 }, path: '/attendance', task: null });
    await open('?t=JWT', true);                       // StrictMode renders the effect twice: still one redeem
    expect(redeem).toHaveBeenCalledTimes(1);
    expect(redeem).toHaveBeenCalledWith('JWT');
    expect(updateUser).toHaveBeenCalledWith({ id: 1 });
    expect(text()).toContain('ATTENDANCE PAGE');
  });

  it('takes the token out of the address bar before anything else', async () => {
    redeem.mockReturnValue(new Promise(() => undefined));
    await open('?t=JWT');
    expect(window.location.search).toBe('');
    expect(text()).toContain('Opening the practice copy');
  });

  it('shows one sentence, no password form, when the link is refused', async () => {
    redeem.mockRejectedValue({ response: { status: 401 } });
    await open('?t=USED');
    expect(text()).toContain('This link has expired');
    expect(text()).toContain('Open practice copy');
    expect(document.querySelector('input')).toBeNull();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('does not call the server without a token', async () => {
    await open('');
    expect(redeem).not.toHaveBeenCalled();
    expect(text()).toContain('This link has expired');
  });
});
