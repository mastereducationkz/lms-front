// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear() },
  });
});

const post = vi.fn();
vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { ...real, default: Object.assign(real.default, { post: (...a: unknown[]) => post(...a) }) };
});
const setTokens = vi.fn();
const me = { id: 3, role: 'curator' };
vi.mock('./auth', () => ({ getCurrentUser: vi.fn(async () => me) }));

const { redeemTrainingLink, safePath } = await import('./trainingCopy');
const client = await import('./client');

beforeEach(() => { post.mockReset(); setTokens.mockReset(); vi.spyOn(client.tokenManager, 'setTokens').mockImplementation(setTokens); });

describe('safePath', () => {
  it('keeps paths on this site and nothing else', () => {
    expect(safePath('/attendance')).toBe('/attendance');
    expect(safePath('/')).toBe('/');
    for (const bad of ['//evil.example', '/\\evil', 'https://evil.example', 'attendance', '', null, undefined, 5]) {
      expect(safePath(bad)).toBe('/dashboard');
    }
  });
});

describe('redeemTrainingLink', () => {
  it('posts the token, stores the tokens, loads the user and returns the path', async () => {
    post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r', type: 'bearer', path: '/attendance', task: 'curator.task.attendance' } });
    const result = await redeemTrainingLink('JWT');
    expect(post.mock.calls[0][0]).toMatch(/\/training-copy\/login$/);
    expect(post.mock.calls[0][1]).toEqual({ t: 'JWT' });
    expect(setTokens).toHaveBeenCalledWith('a', 'r');
    expect(result).toEqual({ user: me, path: '/attendance', task: 'curator.task.attendance' });
  });

  it('never trusts a path that leaves the site', async () => {
    post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r', path: '//evil.example' } });
    expect((await redeemTrainingLink('JWT')).path).toBe('/dashboard');
  });

  it('stores nothing when the server refuses', async () => {
    post.mockRejectedValue({ response: { status: 401 } });
    await expect(redeemTrainingLink('JWT')).rejects.toBeTruthy();
    expect(setTokens).not.toHaveBeenCalled();
  });
});
