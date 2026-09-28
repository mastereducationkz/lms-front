import { API_BASE } from './config';
import { tokens as defaultTokens, type TokenStore } from './tokens';

/**
 * The panel's HTTP client: fetch with `Authorization: Bearer`, never cookies (the iframe has none
 * worth sending, and Marketplace rules require working with third-party cookies off).
 *
 * A 401 refreshes once through `POST /auth/refresh` (one refresh at a time, shared by every
 * request that hit the 401) and retries. When the refresh fails too the session is gone:
 * `SessionLost` tells the panel to sign in again.
 */

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export class SessionLost extends Error {
  constructor() {
    super('The Meet panel is signed out');
  }
}

type RefreshOutcome = 'ok' | 'dead' | 'unavailable';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface ClientOptions {
  base?: string;
  tokens?: TokenStore;
  fetch?: FetchLike;
}

async function detail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.message === 'string') return body.message;
  } catch {
    /* no JSON body */
  }
  return `Request failed (${response.status})`;
}

export function createClient(options: ClientOptions = {}) {
  const base = options.base ?? API_BASE;
  const store = options.tokens ?? defaultTokens;
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  let refreshing: Promise<RefreshOutcome> | null = null;

  async function refresh(): Promise<RefreshOutcome> {
    const refreshToken = store.refreshToken;
    if (!refreshToken) return 'dead';
    try {
      const response = await doFetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: 'omit',
      });
      // 401/403: the chain is dead. Anything else (a restart, a 502) keeps the token for later.
      if (response.status === 401 || response.status === 403) return 'dead';
      if (!response.ok) return 'unavailable';
      const data = await response.json();
      if (typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string') return 'unavailable';
      store.set(data.access_token, data.refresh_token);
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }

  function refreshOnce(): Promise<RefreshOutcome> {
    if (!refreshing) {
      refreshing = refresh().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  /** Refresh, or throw what the panel should do about a refresh that did not work. */
  async function mustRefresh(): Promise<void> {
    const outcome = await refreshOnce();
    if (outcome === 'ok') return;
    if (outcome === 'dead') {
      store.clear();
      throw new SessionLost();
    }
    throw new ApiError(503, 'The LMS is not reachable right now');
  }

  async function send(path: string, init: RequestInit, auth: boolean): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (auth && store.accessToken) headers.set('Authorization', `Bearer ${store.accessToken}`);
    return doFetch(`${base}${path}`, { ...init, headers, credentials: 'omit' });
  }

  /** An authenticated call; JSON in, JSON (or null for 204) out. */
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!store.accessToken && !store.refreshToken) throw new SessionLost();
    if (!store.accessToken) await mustRefresh();
    let response = await send(path, init, true);
    if (response.status === 401) {
      await mustRefresh();
      response = await send(path, init, true);
      if (response.status === 401) {
        store.clear();
        throw new SessionLost();
      }
    }
    if (!response.ok) throw new ApiError(response.status, await detail(response));
    if (response.status === 204) return null as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  /** A call made before there is a session (the handoff's create and redeem). */
  async function anonymous<T>(path: string, body: unknown): Promise<{ status: number; data: T | null }> {
    const response = await send(path, { method: 'POST', body: JSON.stringify(body ?? {}) }, false);
    let data: T | null = null;
    try {
      data = (await response.json()) as T;
    } catch {
      data = null;
    }
    return { status: response.status, data };
  }

  return { request, anonymous, tokens: store };
}

export type ApiClient = ReturnType<typeof createClient>;

export const client = createClient();
