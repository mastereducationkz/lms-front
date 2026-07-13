import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  buildCacheKey,
  clearCache,
  getCached,
  getInflight,
  getTtlForUrl,
  invalidateForMutation,
  isCacheableGet,
  setCached,
  trackInflight,
} from './cache';

const RAW_API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
let API_BASE_URL = RAW_API_BASE_URL;
if (typeof window !== 'undefined') {
  const isHttps = window.location.protocol === 'https:';
  if (/^http:\/\/lmsapi\.mastereducation\.kz/.test(RAW_API_BASE_URL)) {
    API_BASE_URL = RAW_API_BASE_URL.replace('http://', 'https://');
  } else if (isHttps && RAW_API_BASE_URL.startsWith('http://')) {
    API_BASE_URL = RAW_API_BASE_URL.replace('http://', 'https://');
  }
}

export class CookieUtils {
  static setCookie(name: string, value: string, days: number = 7): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax${window.location.protocol === 'https:' ? ';Secure' : ''}`;
  }

  static getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  static deleteCookie(name: string): void {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;SameSite=Lax${window.location.protocol === 'https:' ? ';Secure' : ''}`;
  }
}

class TokenManager {
  private accessToken: string | null;
  private refreshToken: string | null;

  constructor() {
    this.migrateFromLocalStorage();
    this.accessToken = CookieUtils.getCookie('access_token');
    this.refreshToken = CookieUtils.getCookie('refresh_token');
  }

  private migrateFromLocalStorage(): void {
    const oldAccessToken = localStorage.getItem('access_token');
    const oldRefreshToken = localStorage.getItem('refresh_token');
    if (oldAccessToken && oldRefreshToken) {
      CookieUtils.setCookie('access_token', oldAccessToken, 7);
      CookieUtils.setCookie('refresh_token', oldRefreshToken, 30);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('current_user');
      console.info('🔄 Токены перенесены из localStorage в cookies');
    }
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    CookieUtils.setCookie('access_token', accessToken, 7);
    CookieUtils.setCookie('refresh_token', refreshToken, 30);
  }

  getAccessToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = CookieUtils.getCookie('access_token');
    }
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    if (!this.refreshToken) {
      this.refreshToken = CookieUtils.getCookie('refresh_token');
    }
    return this.refreshToken;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    CookieUtils.deleteCookie('access_token');
    CookieUtils.deleteCookie('refresh_token');
    CookieUtils.deleteCookie('current_user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
    clearCache();
  }

  isAuthenticated() {
    const token = this.getAccessToken();
    return !!token;
  }
}

const tokenManager = new TokenManager();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type RefreshWaiter = {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}

let isRefreshing = false
let refreshSubscribers: RefreshWaiter[] = []
let isAuthFailureHandled = false

function onRefreshed(token: string): void {
  refreshSubscribers.forEach(({ resolve }) => resolve(token))
  refreshSubscribers = []
}

function onRefreshFailed(err: unknown): void {
  refreshSubscribers.forEach(({ reject }) => reject(err))
  refreshSubscribers = []
}

function addRefreshSubscriber(waiter: RefreshWaiter): void {
  refreshSubscribers.push(waiter)
}

/** Backend down / restarting — do not wipe cookies. */
function isTransientRefreshFailure(err: unknown): boolean {
  const e = err as { response?: { status?: number }; code?: string }
  if (!e?.response) {
    return true
  }
  const s = e.response.status
  return s === 502 || s === 503 || s === 504 || s === 429
}

/** Invalid or revoked refresh — user must log in again. */
function isAuthRefreshRejected(err: unknown): boolean {
  const e = err as { response?: { status?: number } }
  const s = e?.response?.status
  return s === 401 || s === 403
}

async function postRefreshWithRetries(refreshToken: string) {
  const delaysMs = [400, 1200, 2500]
  let lastErr: unknown
  for (let attempt = 0; attempt < delaysMs.length + 1; attempt++) {
    try {
      return await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { withCredentials: true, timeout: 25000 }
      )
    } catch (err) {
      lastErr = err
      const canRetry = attempt < delaysMs.length && isTransientRefreshFailure(err)
      if (canRetry) {
        await sleep(delaysMs[attempt] ?? 2000)
        continue
      }
      throw err
    }
  }
  throw lastErr
}

/**
 * OIDC sessions keep no LMS refresh token (the LMS /auth/refresh only understands its own HS256
 * tokens). When such a session's access token expires, renew it via the IdP instead of dead-ending.
 * Dynamically imported to avoid a static import cycle (oidc.ts imports tokenManager from here).
 */
async function tryOidcSilentRenew(): Promise<string | null> {
  try {
    const mod = await import('../oidc')
    return await mod.trySilentRenewAccessToken()
  } catch {
    return null
  }
}

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/login')
  );
}

function handleAuthFailureOnce(): void {
  if (isAuthFailureHandled) return;
  isAuthFailureHandled = true;
  tokenManager.clearTokens();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

/**
 * Install SWR cache hooks on the axios instance.
 *
 * GET requests: served from in-memory cache when fresh, deduped while in-flight,
 * and stored after a successful response.
 *
 * Mutating requests (POST/PUT/PATCH/DELETE): pass through unchanged, then
 * invalidate related cache keys after the response.
 *
 * Bypass per call via `{ cache: false }` on the request config; override TTL
 * with `{ cache: { ttl: ms } }`.
 */
type CacheConfig = { cache?: boolean | { ttl?: number } };

const buildSyntheticResponse = <T,>(
  data: T,
  url: string,
  config: Record<string, unknown>,
): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK (cache)',
  headers: {},
  config: { ...config, url } as never,
  request: undefined as never,
});

const originalGet = api.get.bind(api);
api.get = (async (url: string, config?: Record<string, unknown> & CacheConfig) => {
  if (!isCacheableGet('get', url, config)) {
    return originalGet(url, config as never);
  }
  const key = buildCacheKey(url, config as never);
  const cached = getCached(key);
  if (cached !== undefined) {
    return buildSyntheticResponse(cached, url, config ?? {});
  }
  const inflight = getInflight<AxiosResponse>(key);
  if (inflight) {
    return inflight;
  }
  const ttl = getTtlForUrl(url, config as never);
  const promise = originalGet(url, config as never).then((response) => {
    if (response && response.status >= 200 && response.status < 300) {
      setCached(key, response.data, ttl);
    }
    return response;
  });
  return trackInflight(key, promise);
}) as typeof api.get;

const wrapMutation = <K extends 'post' | 'put' | 'patch' | 'delete',>(method: K) => {
  const original = (api[method] as (...args: unknown[]) => Promise<AxiosResponse>).bind(api);
  (api[method] as unknown) = async (...args: unknown[]) => {
    const response = await original(...args);
    const url = args[0];
    if (typeof url === 'string') {
      invalidateForMutation(url);
    }
    return response;
  };
};

wrapMutation('post');
wrapMutation('put');
wrapMutation('patch');
wrapMutation('delete');

export { clearCache };

api.interceptors.request.use(
  (config) => {
    // Let the browser set multipart/form-data with a boundary. Default JSON Content-Type
    // breaks FormData uploads; setting multipart manually without a boundary also breaks them.
    if (config.data instanceof FormData) {
      const headers = config.headers
      if (headers && typeof (headers as { delete?: (k: string) => void }).delete === 'function') {
        ;(headers as { delete: (k: string) => void }).delete('Content-Type')
      } else if (headers && typeof headers === 'object') {
        delete (headers as Record<string, unknown>)['Content-Type']
      }
    }
    const token = tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Logout handler set by auth module to avoid circular dependency
let logoutHandler: (() => Promise<void>) | null = null;
export function setLogoutHandler(handler: () => Promise<void>) {
  logoutHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isAuthEndpoint(originalRequest.url) || originalRequest.skipAuthRefresh) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          addRefreshSubscriber({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      isRefreshing = true

      try {
        const refreshToken = tokenManager.getRefreshToken()
        if (!refreshToken) {
          // No LMS refresh token: for an OIDC session, renew through the IdP and retry.
          const oidcToken = await tryOidcSilentRenew()
          if (oidcToken) {
            tokenManager.setTokens(oidcToken, '')
            isRefreshing = false
            isAuthFailureHandled = false
            onRefreshed(oidcToken)
            originalRequest.headers.Authorization = `Bearer ${oidcToken}`
            return api(originalRequest)
          }
          throw new Error('Missing refresh token')
        }

        const response = await postRefreshWithRetries(refreshToken)

        const { access_token, refresh_token } = response.data
        tokenManager.setTokens(access_token, refresh_token)

        isRefreshing = false
        isAuthFailureHandled = false
        onRefreshed(access_token)

        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        isRefreshing = false
        onRefreshFailed(refreshError)

        const transient = isTransientRefreshFailure(refreshError)
        const rejected = isAuthRefreshRejected(refreshError)

        if (rejected || (!transient && refreshError instanceof Error && refreshError.message === 'Missing refresh token')) {
          if (logoutHandler) {
            try {
              await logoutHandler()
            } catch {
              // Ignore logout handler failures during auth failure handling.
            }
          }
          handleAuthFailureOnce()
        } else {
          originalRequest._retry = false
        }

        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error);
  }
);

export { api, tokenManager, API_BASE_URL };
