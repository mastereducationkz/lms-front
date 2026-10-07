import axios from 'axios';
import type { User } from '../../types';
import { api, tokenManager, API_BASE_URL, CookieUtils, setLogoutHandler, clearCache } from './client';
import { t } from '../../lib/i18n';
import '@/lib/i18n/catalogs/sharedUi';

let currentUser: User | null = getCurrentUserFromStorage();

function getCurrentUserFromStorage(): User | null {
  try {
    let userData = CookieUtils.getCookie('current_user');
    if (!userData) {
      userData = localStorage.getItem('current_user');
      if (userData) {
        CookieUtils.setCookie('current_user', userData, 7);
        localStorage.removeItem('current_user');
        console.info('User data moved to cookies');
      }
    }
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user: User | null): void {
  currentUser = user;
  // ui_state grows with every dismissed tip and /auth/me always brings it fresh: keep it out of
  // the cookie, which must stay under the browser's 4 KB limit.
  const persisted = user ? { ...user } : null;
  if (persisted) delete persisted.ui_state;
  const userData = JSON.stringify(persisted);
  CookieUtils.setCookie('current_user', userData, 7);
  localStorage.removeItem('current_user');
}

export async function login(email: string, password: string): Promise<{ success: boolean; user: User }> {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });

    const { access_token, refresh_token } = response.data;
    tokenManager.setTokens(access_token, refresh_token);

    const user = await getCurrentUser();
    setCurrentUser(user);

    return { success: true, user };
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || t('sharedUi.auth.loginFailed'));
  }
}

export async function logout(): Promise<void> {
  try {
    if (tokenManager.isAuthenticated()) {
      const accessToken = tokenManager.getAccessToken();
      await axios.post(
        `${API_BASE_URL}/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
        }
      );
    }
  } catch (error) {
    console.warn('Logout request failed:', error);
  } finally {
    tokenManager.clearTokens();
    currentUser = null;
    clearCache();
  }
}

// Register logout handler for token refresh interceptor
setLogoutHandler(logout);

/**
 * Error thrown by getCurrentUser that preserves enough of the HTTP failure for
 * callers (AuthContext) to distinguish a genuine auth rejection (401/403 → log the
 * user out) from a transient/network/5xx blip (keep the session, retry). Collapsing
 * these into a bare Error is what caused valid sessions to be wiped on a backend hiccup.
 */
export type AuthRequestError = Error & {
  status?: number;
  isNetworkError: boolean;
};

export async function getCurrentUser(): Promise<User> {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const isNetwork = !error?.response;
    const detail = error?.response?.data?.detail;
    const message = isNetwork
      ? 'Network error while fetching current user'
      : status === 401
        ? 'Unauthorized'
        : detail || 'Failed to get current user';
    const wrapped = new Error(message) as AuthRequestError;
    wrapped.status = status;
    wrapped.isNetworkError = isNetwork;
    throw wrapped;
  }
}

/** The signed-in person's own UI language (Settings); null goes back to the role's default. */
export async function saveUiLanguage(language: 'en' | 'ru' | null): Promise<User> {
  const response = await api.put('/auth/me/language', { language });
  return response.data as User;
}

export async function updateProfile(userId: number, profileData: { name?: string; email?: string }): Promise<User> {
  try {
    const response = await api.put(`/users/${userId}`, profileData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to update profile');
  }
}

/** A student saves their orca avatar code, or null to go back to the automatic orca. */
export async function updateMyMascot(mascot: string | null): Promise<User> {
  try {
    const response = await api.put('/users/me/mascot', { mascot });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Could not save your orca');
  }
}

export async function forgotPassword(email: string): Promise<{ detail: string }> {
  // Unauthenticated; backend always returns a generic success (no user enumeration)
  const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
  return response.data;
}

export async function resetPassword(token: string, newPassword: string): Promise<{ detail: string }> {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
      token,
      new_password: newPassword,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to reset password');
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ detail: string }> {
  try {
    const response = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to change password');
  }
}

export function isAuthenticated(): boolean {
  return tokenManager.isAuthenticated();
}

export function getCurrentUserSync(): User | null {
  return currentUser;
}

export async function completeOnboarding(): Promise<User> {
  try {
    const response = await api.post('/users/complete-onboarding');
    return response.data;
  } catch (error) {
    console.error('Failed to complete onboarding:', error);
    throw new Error('Failed to complete onboarding');
  }
}
