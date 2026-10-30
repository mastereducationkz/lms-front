// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refreshUser = vi.fn(async () => undefined);
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ refreshUser }) }));
vi.mock('../../services/api/client', () => ({ ACCESS_REFUSED_EVENT: 'lms:access-refused' }));

import { useTrialStatusRefresh } from './useTrialStatusRefresh';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function Probe({ enabled }: { enabled: boolean }) {
  useTrialStatusRefresh(enabled);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T07:00:00Z'));
  refreshUser.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useTrialStatusRefresh', () => {
  it('re-reads the user when the API refuses something, at most once every 10 s', () => {
    act(() => root.render(<Probe enabled />));
    window.dispatchEvent(new Event('lms:access-refused'));
    window.dispatchEvent(new Event('lms:access-refused'));
    expect(refreshUser).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-10-30T07:00:11Z'));
    window.dispatchEvent(new Event('focus'));
    expect(refreshUser).toHaveBeenCalledTimes(2);
  });

  it('does nothing for someone without a trial', () => {
    act(() => root.render(<Probe enabled={false} />));
    window.dispatchEvent(new Event('lms:access-refused'));
    window.dispatchEvent(new Event('focus'));
    expect(refreshUser).not.toHaveBeenCalled();
  });
});
