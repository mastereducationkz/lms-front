import { beforeEach, describe, expect, it, vi } from 'vitest';

// `./client` touches `document`/`localStorage` at module scope, which vitest's node environment doesn't have.
vi.mock('./client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  tokenManager: { setTokens: vi.fn(), isAuthenticated: vi.fn(), getAccessToken: vi.fn(), clearTokens: vi.fn() },
  API_BASE_URL: 'http://api.test',
  CookieUtils: { getCookie: vi.fn(() => null), setCookie: vi.fn() },
  setLogoutHandler: vi.fn(),
  clearCache: vi.fn(),
}));
vi.mock('axios', () => ({ default: { post: vi.fn() } }));

import axios from 'axios';
import { setActiveLocale } from '../../lib/i18n/locale';
import { login } from './auth';

const post = axios.post as unknown as ReturnType<typeof vi.fn>;

const closedByExpiry = () => ({
  response: {
    status: 400,
    data: {
      detail: 'Your access to the platform ended on 6 Nov 2026. To renew it, message the manager on Telegram: @master_education_manager',
      reason_code: 'access_expired',
      reason_details: { date: '2026-11-06' },
    },
  },
});

beforeEach(() => post.mockReset());

describe('signing in after the access ended', () => {
  it('tells a Russian-speaking device the day and the manager, in Russian', async () => {
    setActiveLocale('ru'); // the sign-in page speaks the language last used on this device
    post.mockRejectedValueOnce(closedByExpiry());
    await expect(login('a@b.kz', 'pw')).rejects.toThrow(
      'Ваш доступ к платформе закончился 6 ноября 2026. Чтобы продлить, напишите менеджеру в Telegram: @master_education_manager',
    );
  });

  it('and an English one in English', async () => {
    setActiveLocale('en');
    post.mockRejectedValueOnce(closedByExpiry());
    await expect(login('a@b.kz', 'pw')).rejects.toThrow(
      'Your access to the platform ended on 6 November 2026. To renew it, message the manager on Telegram: @master_education_manager',
    );
  });

  it('leaves every other refusal exactly as the server worded it', async () => {
    setActiveLocale('ru');
    post.mockRejectedValueOnce({ response: { status: 400, data: { detail: 'Account is inactive' } } });
    await expect(login('a@b.kz', 'pw')).rejects.toThrow('Account is inactive');
    post.mockRejectedValueOnce({ response: { status: 400, data: { detail: 'Invalid credentials' } } });
    await expect(login('a@b.kz', 'pw')).rejects.toThrow('Invalid credentials');
  });
});
