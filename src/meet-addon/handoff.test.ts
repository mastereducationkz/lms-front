import { describe, expect, it } from 'vitest';
import { openSignInPopup, POPUP_FEATURES, POPUP_NAME, runHandoff, type HandoffState, type PopupLike } from './handoff';
import { TokenStore } from './tokens';

const CREATED = { handoff_id: 'h'.repeat(24), poll_secret: 's3cret', link_url: 'https://lms.test/meet-addon/link?h=hhhh', expires_in: 10 };

type Answer = { status: number; data: unknown } | Error;

const last = <T,>(items: T[]): T => items[items.length - 1];

/** A clock that only moves when the handoff sleeps, and a client answering from a script. */
function setup(redeems: Answer[], create: Answer = { status: 201, data: CREATED }) {
  let now = 0;
  const calls: { path: string; body: unknown }[] = [];
  const tokens = new TokenStore(() => null);
  const client = {
    tokens,
    anonymous: async (path: string, body: unknown) => {
      calls.push({ path, body });
      const answer = path === '/auth/addon-handoff' ? create : redeems.shift() ?? { status: 200, data: { status: 'pending' } };
      if (answer instanceof Error) throw answer;
      return answer as { status: number; data: never };
    },
  };
  const states: HandoffState[] = [];
  const popup: PopupLike & { closedCount: number } = {
    location: { href: '' },
    closedCount: 0,
    close() { this.closedCount += 1; },
  };
  const deps = { client, popup, now: () => now, sleep: async (ms: number) => { now += ms; }, pollMs: 2000 };
  return { deps, calls, states, tokens, popup, onState: (s: HandoffState) => states.push(s) };
}

describe('runHandoff', () => {
  it('points the popup at the link, polls until approved and keeps the tokens', async () => {
    const t = setup([
      { status: 200, data: { status: 'pending' } },
      { status: 200, data: { status: 'approved', access_token: 'A', refresh_token: 'R', token_type: 'bearer' } },
    ]);
    expect(await runHandoff('abc-defg-hij', t.deps, t.onState)).toBe('approved');
    expect(t.calls[0]).toEqual({ path: '/auth/addon-handoff', body: { meeting_code: 'abc-defg-hij' } });
    expect(t.calls.slice(1)).toEqual([
      { path: `/auth/addon-handoff/${CREATED.handoff_id}/redeem`, body: { poll_secret: 's3cret' } },
      { path: `/auth/addon-handoff/${CREATED.handoff_id}/redeem`, body: { poll_secret: 's3cret' } },
    ]);
    expect(t.popup.location.href).toBe(CREATED.link_url);
    expect(t.popup.closedCount).toBe(1);
    expect(t.tokens.accessToken).toBe('A');
    expect(t.tokens.refreshToken).toBe('R');
    expect(t.states.map((s) => s.kind)).toEqual(['starting', 'waiting', 'approved']);
  });

  it('stops on a denial and keeps nothing', async () => {
    const t = setup([{ status: 200, data: { status: 'denied' } }]);
    expect(await runHandoff(null, t.deps, t.onState)).toBe('denied');
    expect(t.tokens.refreshToken).toBeNull();
    expect(last(t.states)).toEqual({ kind: 'denied' });
  });

  it('expires when the backend forgets the handoff', async () => {
    const t = setup([{ status: 404, data: null }]);
    expect(await runHandoff(null, t.deps, t.onState)).toBe('expired');
    expect(last(t.states)).toEqual({ kind: 'expired' });
  });

  it('expires when nobody answers before the link runs out', async () => {
    const t = setup([]);
    expect(await runHandoff(null, t.deps, t.onState)).toBe('expired');
    // 10 s at a 2 s rhythm: five polls, then it gives up.
    expect(t.calls.length).toBe(1 + 5);
  });

  it('rides out a network blip and a 503 while polling', async () => {
    const t = setup([
      new Error('offline'),
      { status: 503, data: { detail: 'down' } },
      { status: 200, data: { status: 'approved', access_token: 'A', refresh_token: 'R' } },
    ]);
    expect(await runHandoff(null, t.deps, t.onState)).toBe('approved');
  });

  it('shows the link to click when the browser blocked the popup', async () => {
    const t = setup([{ status: 200, data: { status: 'approved', access_token: 'A', refresh_token: 'R' } }]);
    expect(await runHandoff(null, { ...t.deps, popup: null }, t.onState)).toBe('approved');
    expect(t.states[1]).toEqual({ kind: 'waiting', linkUrl: CREATED.link_url, popupBlocked: true });
  });

  it.each([
    [429, 'Too many sign-in attempts'],
    [503, 'unavailable'],
  ])('a create answered %s closes the popup and says why', async (status, text) => {
    const t = setup([], { status, data: { detail: 'x' } });
    expect(await runHandoff(null, t.deps, t.onState)).toBe('error');
    expect(t.popup.closedCount).toBe(1);
    const final = last(t.states);
    expect(final.kind).toBe('error');
    expect(final.kind === 'error' && final.message).toContain(text);
  });

  it('a create that never reached the LMS closes the popup', async () => {
    const t = setup([], new Error('offline'));
    expect(await runHandoff(null, t.deps, t.onState)).toBe('error');
    expect(t.popup.closedCount).toBe(1);
  });

  it('stops quietly when the panel is torn down', async () => {
    const controller = new AbortController();
    const t = setup([]);
    const run = runHandoff(null, { ...t.deps, signal: controller.signal }, t.onState);
    controller.abort();
    expect(await run).toBe('cancelled');
    expect(t.tokens.refreshToken).toBeNull();
  });
});

describe('openSignInPopup', () => {
  it('opens an empty named popup synchronously', () => {
    const seen: unknown[] = [];
    const fake = ((...args: unknown[]) => { seen.push(args); return { location: { href: '' }, close() {} }; }) as unknown as typeof window.open;
    expect(openSignInPopup(fake)).not.toBeNull();
    expect(seen).toEqual([['', POPUP_NAME, POPUP_FEATURES]]);
  });

  it('is null when the browser blocks it or throws', () => {
    expect(openSignInPopup((() => null) as unknown as typeof window.open)).toBeNull();
    expect(openSignInPopup((() => { throw new Error('blocked'); }) as unknown as typeof window.open)).toBeNull();
  });
});
