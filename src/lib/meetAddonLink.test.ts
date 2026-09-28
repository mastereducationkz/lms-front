import { describe, expect, it } from 'vitest';
import {
  handoffIdFrom, mayUsePanel, POST_LOGIN_KEY, rememberLinkForLogin, stateFromError, stateFromInfo, takeLinkAfterLogin,
  type HandoffInfo,
} from './meetAddonLink';

const info = (over: Partial<HandoffInfo> = {}): HandoffInfo => ({
  status: 'pending', meeting_code: 'abc-defg-hij', expires_in: 240, same_network: true, ...over,
});
const ID = 'A'.repeat(24);

function memorySession() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
}

describe('the sign-in popup', () => {
  it('asks to allow a pending request from the same network', () => {
    expect(stateFromInfo(info())).toEqual({ kind: 'ask', info: info() });
  });

  it('warns, and offers only «Deny», for a request from another network', () => {
    expect(stateFromInfo(info({ same_network: false }))).toEqual({ kind: 'other_network', info: info({ same_network: false }) });
  });

  it('says a request was already answered', () => {
    expect(stateFromInfo(info({ status: 'approved' }))).toEqual({ kind: 'answered' });
    expect(stateFromInfo(info({ status: 'denied' }))).toEqual({ kind: 'answered' });
    expect(stateFromError(409, 'This sign-in request was already answered.')).toEqual({ kind: 'answered' });
  });

  it('says an expired link has expired (the 404 body carries no detail)', () => {
    expect(stateFromError(404, null)).toEqual({ kind: 'expired' });
  });

  it('tells a staff-only refusal from an other-network refusal', () => {
    expect(stateFromError(403, 'The Meet panel is for LMS staff accounts.')).toEqual({ kind: 'staff_only' });
    const other = 'This request came from a different network than the Meet panel. Approve it on the computer where Meet is open.';
    expect(stateFromError(403, other)).toEqual({ kind: 'error', message: other });
  });

  it('turns an outage and anything else into a readable error', () => {
    expect(stateFromError(503, 'x')).toMatchObject({ kind: 'error', message: expect.stringContaining('unavailable') });
    expect(stateFromError(null, null)).toMatchObject({ kind: 'error' });
  });

  it('only teachers, head teachers and admins may connect the panel', () => {
    expect(['teacher', 'head_teacher', 'admin', ' Teacher '].map(mayUsePanel)).toEqual([true, true, true, true]);
    expect(['curator', 'head_curator', 'student', 'parent', '', null, undefined].map(mayUsePanel)).toEqual(Array(7).fill(false));
  });

  it('reads only a well-formed handoff id from the URL', () => {
    expect(handoffIdFrom(`?h=${ID}`)).toBe(ID);
    expect(handoffIdFrom('?h=short')).toBeNull();
    expect(handoffIdFrom('?h=../../etc')).toBeNull();
    expect(handoffIdFrom('')).toBeNull();
  });
});

describe('carrying the link across an SSO login', () => {
  it('comes back once, to the same link', () => {
    const store = memorySession();
    rememberLinkForLogin(`/meet-addon/link?h=${ID}`, store, 1000);
    expect(takeLinkAfterLogin(store, 2000)).toBe(`/meet-addon/link?h=${ID}`);
    expect(takeLinkAfterLogin(store, 2000)).toBeNull();
  });

  it('never remembers or returns any other address', () => {
    const store = memorySession();
    rememberLinkForLogin('/dashboard', store, 0);
    rememberLinkForLogin('https://evil.test/meet-addon/link?h=' + ID, store, 0);
    expect(store.data.size).toBe(0);
    store.setItem(POST_LOGIN_KEY, JSON.stringify({ path: '//evil.test', at: 0 }));
    expect(takeLinkAfterLogin(store, 1)).toBeNull();
  });

  it('forgets a link older than ten minutes', () => {
    const store = memorySession();
    rememberLinkForLogin(`/meet-addon/link?h=${ID}`, store, 0);
    expect(takeLinkAfterLogin(store, 10 * 60 * 1000 + 1)).toBeNull();
  });

  it('survives a storage that throws', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(() => rememberLinkForLogin(`/meet-addon/link?h=${ID}`, broken)).not.toThrow();
    expect(takeLinkAfterLogin(broken)).toBeNull();
  });
});
