import axios from 'axios';
import type { User } from '../../types';
import { api, tokenManager, API_BASE_URL, CookieUtils, setLogoutHandler } from './client';

let currentUser: User | null = getCurrentUserFromStorage();

function getCurrentUserFromStorage(): User | null {
  try {
    let userData = CookieUtils.getCookie('current_user');
    if (!userData) {
      userData = localStorage.getItem('current_user');
      if (userData) {
        CookieUtils.setCookie('current_user', userData, 7);
        localStorage.removeItem('current_user');
        console.info('🔄 Данные пользователя перенесены в cookies');
      }
    }
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user: User | null): void {
  currentUser = user;
  const userData = JSON.stringify(user);
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
    throw new Error(error.response?.data?.detail || 'Login failed');
  }
}

export async function logout(): Promise<void> {
  try {
    if (tokenManager.isAuthenticated()) {
      await api.post('/auth/logout');
    }
  } catch (error) {
    console.warn('Logout request failed:', error);
  } finally {
    tokenManager.clearTokens();
    currentUser = null;
  }
}

// Register logout handler for token refresh interceptor
setLogoutHandler(logout);

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
    throw new Error(message);
  }
}

export async function updateProfile(userId: number, profileData: { name?: string; email?: string }): Promise<User> {
  try {
    const response = await api.put(`/users/${userId}`, profileData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to update profile');
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
