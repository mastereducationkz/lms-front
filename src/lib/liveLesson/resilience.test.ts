import { describe, expect, it, vi } from 'vitest';
import { createClient, type FetchLike } from '../../meet-addon/api';
import { panelRequester } from '../../meet-addon/live';
import { TokenStore } from '../../meet-addon/tokens';
import { liveApi } from './api';
import { LiveOffline, LiveRequestError, RECONNECT_BUDGET_MS, isTransient, liveErrorText, withReconnect } from './resilience';

// The live lesson over the Meet panel's client with a scripted fetch: what a teacher's tap meets
// while a deploy drops the API (the proxy's error page has no CORS headers: "Failed to fetch").
type Step = 'down' | number | [number, unknown];

function harness(steps: Step[]) {
  const calls: string[] = [];
  const fetch: FetchLike = async (url, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url.replace('https://api.test', '')}`);
    const step = steps.length > 1 ? steps.shift()! : steps[0];
    if (step === 'down') throw new TypeError('Failed to fetch');
    const [status, body] = Array.isArray(step) ? step : [step, { ok: true }];
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  const tokens = new TokenStore(() => null);
  tokens.set('A1', 'R1');
  const api = liveApi(panelRequester(createClient({ base: 'https://api.test', tokens, fetch })));
  // A virtual clock: every wait passes at once, but the 25-second window is kept honestly.
  let clock = 0;
  const waits: number[] = [];
  const time = { now: () => clock, sleep: async (ms: number) => { waits.push(ms); clock += ms; } };
  return { api, calls, waits, time };
}

describe('a live-lesson write over a blip', () => {
  it('waits a deploy out quietly and then just works', async () => {
    const { api, calls, waits, time } = harness(['down', 'down', 502, 200]);
    const reconnecting = vi.fn();
    await expect(withReconnect(() => api.close(7, 3), { ...time, onReconnecting: reconnecting })).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(4);
    expect(waits).toEqual([1_000, 2_000, 3_000]);
    expect(reconnecting.mock.calls).toEqual([[true], [false]]);
  });

  it('gives up after ~25 s with plain words, never the browser’s', async () => {
    const { api, waits, time } = harness(['down']);
    const failure = await withReconnect(() => api.timer(7, 'pause'), time).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(LiveOffline);
    expect(waits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(RECONNECT_BUDGET_MS);
    expect(waits.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(20_000);
    expect(liveErrorText(failure)).toBe('Couldn’t reach the server. Try again.');
    expect(liveErrorText(new TypeError('Failed to fetch'))).toBe('Couldn’t reach the server. Try again.');
  });

  it('never retries a refusal: a 409 is the server’s answer', async () => {
    const { api, calls, waits, time } = harness([[409, { detail: 'Answers are closed' }]]);
    const failure = await withReconnect(() => api.answer(7, 3, 1), time).catch((e: unknown) => e);
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
    expect(liveErrorText(failure)).toBe('Answers are closed');
  });

  it('doesn’t send an unsafe write twice when the first one landed', async () => {
    const { api, calls, time } = harness(['down', 200]);
    const landed = vi.fn(async () => true);
    await expect(withReconnect(() => api.pick(7), { ...time, landed })).resolves.toBeUndefined();
    expect(landed).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
  });

  it('sends an unsafe write again once fresh state shows it never landed', async () => {
    const { api, calls, time } = harness(['down', [200, { id: 9, user_id: 4 }]]);
    await expect(withReconnect(() => api.pick(7), { ...time, landed: async () => false })).resolves.toEqual({ id: 9, user_id: 4 });
    expect(calls.filter((c) => c.startsWith('POST'))).toHaveLength(2);
  });
});

describe('isTransient', () => {
  it('knows a lost connection or a proxy error page from a refusal', () => {
    expect(isTransient(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransient(new TypeError('Load failed'))).toBe(true);
    expect(isTransient(new LiveRequestError('Network Error', null))).toBe(true);
    expect(isTransient(new LiveRequestError('Bad gateway', 503))).toBe(true);
    expect(isTransient(Object.assign(new Error('x'), { status: 504 }))).toBe(true);
    expect(isTransient(new LiveRequestError('Answers are closed', 409))).toBe(false);
    expect(isTransient(new LiveRequestError('Server error', 500))).toBe(false);
    expect(isTransient(new LiveRequestError('Missing refresh token', undefined))).toBe(false);
    expect(isTransient(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('never shows transport wording as the message', () => {
    expect(liveErrorText(new LiveRequestError('Request failed with status code 500', 500))).toBe('That didn’t work. Try again.');
    expect(liveErrorText(new Error(''))).toBe('That didn’t work. Try again.');
  });
});
