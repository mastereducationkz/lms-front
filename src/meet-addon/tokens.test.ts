import { describe, expect, it } from 'vitest';
import { REFRESH_KEY, TokenStore, type StorageLike } from './tokens';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const throwing: StorageLike = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

describe('TokenStore', () => {
  it('keeps the access token in memory only and the refresh token in storage', () => {
    const storage = memoryStorage();
    const store = new TokenStore(() => storage);
    store.set('access-1', 'refresh-1');
    expect(store.accessToken).toBe('access-1');
    expect(store.refreshToken).toBe('refresh-1');
    expect([...storage.data.entries()]).toEqual([[REFRESH_KEY, 'refresh-1']]);
  });

  it('finds the refresh token again after a reload (a new store over the same storage)', () => {
    const storage = memoryStorage();
    new TokenStore(() => storage).set('a', 'r');
    const reloaded = new TokenStore(() => storage);
    expect(reloaded.accessToken).toBeNull();
    expect(reloaded.refreshToken).toBe('r');
  });

  it('works for the life of the page when storage throws', () => {
    const store = new TokenStore(() => throwing);
    store.set('a', 'r');
    expect(store.accessToken).toBe('a');
    expect(store.refreshToken).toBe('r');
    store.clear();
    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
  });

  it('works when there is no storage at all', () => {
    const store = new TokenStore(() => null);
    store.set('a', 'r');
    expect(store.refreshToken).toBe('r');
  });

  it('clear forgets both tokens everywhere', () => {
    const storage = memoryStorage();
    const store = new TokenStore(() => storage);
    store.set('a', 'r');
    store.clear();
    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(storage.data.size).toBe(0);
  });
});
