// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveApi } from './api';
import type { LiveState } from './types';
import { useLiveLesson } from './useLiveLesson';

// A student's live page while a deploy drops the API: the refresh fails for a while, the page says
// "Reconnecting…" and comes back by itself; only a gap longer than ~25 s becomes an error, and
// that error clears on the next refresh that works.
const state = (version: number) => ({ version, server_now: new Date().toISOString(), activity: null, timer: null }) as unknown as LiveState;
const down = () => Promise.reject(new TypeError('Failed to fetch'));

let host: HTMLDivElement;
let root: Root;
let seen: { reconnecting: boolean; error: string | null; version: number | null };

function Probe({ api }: { api: LiveApi }) {
  const live = useLiveLesson({ eventId: 7, api });
  seen = { reconnecting: live.reconnecting, error: live.error, version: live.state?.version ?? null };
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useLiveLesson over a blip', () => {
  it('says "Reconnecting…" through a 20 s gap and recovers without a reload', async () => {
    const stateCall = vi.fn<() => Promise<LiveState>>()
      .mockImplementationOnce(down).mockImplementationOnce(down).mockImplementationOnce(down)
      .mockImplementation(() => Promise.resolve(state(2)));
    const api = { state: stateCall } as unknown as LiveApi;
    await act(async () => root.render(<Probe api={api} />));
    expect(seen).toMatchObject({ reconnecting: true, error: null, version: null });
    await advance(1_000);
    await advance(2_000);
    expect(seen.reconnecting).toBe(true);
    await advance(3_000);
    expect(seen).toMatchObject({ reconnecting: false, error: null, version: 2 });
  });

  it('calls a long outage an error in plain words, and clears it on the next good refresh', async () => {
    let up = false;
    const api = { state: vi.fn(() => (up ? Promise.resolve(state(5)) : down())) } as unknown as LiveApi;
    await act(async () => root.render(<Probe api={api} />));
    await advance(26_000);
    expect(seen.reconnecting).toBe(false);
    expect(seen.error).toBe('Couldn’t reach the server. Try again.');
    up = true;
    await advance(5_000);
    expect(seen).toMatchObject({ reconnecting: false, error: null, version: 5 });
  });
});
