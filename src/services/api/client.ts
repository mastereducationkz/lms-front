import axios, { AxiosInstance } from 'axios';

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
  }

  isAuthenticated() {
    const token = this.getAccessToken();
    return !!token;
  }
}

const tokenManager = new TokenManager();

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let isAuthFailureHandled = false;

function onRefreshed(token: string): void {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
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

api.interceptors.request.use(
  (config) => {
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
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = tokenManager.getRefreshToken();
        if (!refreshToken) {
          throw new Error('Missing refresh token');
        }

        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { withCredentials: true }
        );

        const { access_token, refresh_token } = response.data;
        tokenManager.setTokens(access_token, refresh_token);

        isRefreshing = false;
        isAuthFailureHandled = false;
        onRefreshed(access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        if (logoutHandler) {
          try {
            await logoutHandler();
          } catch {
            // Ignore logout handler failures during auth failure handling.
          }
        }
        handleAuthFailureOnce();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { api, tokenManager, API_BASE_URL };
