/**
 * The panel's own session: an access token in memory and a refresh token in localStorage.
 *
 * Inside Meet the panel is a cross-site iframe, so its localStorage is partitioned under
 * meet.google.com: it survives reloads and new meetings, and never mixes with the LMS tab's
 * cookies. Storage can also be missing or throw (blocked site data, private windows), so every
 * access is guarded; without it the panel still works for the life of the page.
 */

export const REFRESH_KEY = 'lms-meet-addon.refresh-token';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export class TokenStore {
  private access: string | null = null;
  private refreshInMemory: string | null = null;

  constructor(private readonly storage: () => StorageLike | null = defaultStorage) {}

  get accessToken(): string | null {
    return this.access;
  }

  get refreshToken(): string | null {
    try {
      const stored = this.storage()?.getItem(REFRESH_KEY);
      if (stored) return stored;
    } catch {
      /* storage refused: fall back to this page's copy */
    }
    return this.refreshInMemory;
  }

  set(access: string, refresh: string): void {
    this.access = access;
    this.refreshInMemory = refresh;
    try {
      this.storage()?.setItem(REFRESH_KEY, refresh);
    } catch {
      /* kept in memory only */
    }
  }

  clear(): void {
    this.access = null;
    this.refreshInMemory = null;
    try {
      this.storage()?.removeItem(REFRESH_KEY);
    } catch {
      /* nothing stored, nothing to remove */
    }
  }
}

export const tokens = new TokenStore();
