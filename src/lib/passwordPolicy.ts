// The password rule every form checks before it submits, mirroring the server's
// src/utils/password_policy.py: 8–128 characters, at least one digit, not only spaces.
// The server also refuses the most common passwords; that message comes back from the API.
// Messages are the server's own (serverErrors.password_*), in the reader's UI language.
import '@/lib/i18n/catalogs/serverErrors';
import '@/lib/i18n/catalogs/settings';
import { t } from './i18n';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Shown in a new-password field before anything is typed. */
export function passwordHint(): string {
  return t('settings.password.newPlaceholder');
}

/** What's wrong with `password`, or null when the server will accept its shape. */
export function passwordPolicyError(password: string): string | null {
  // Count characters the way the server does (code points), so an emoji counts once.
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH) return t('serverErrors.password_policy');
  if (length > PASSWORD_MAX_LENGTH) return t('serverErrors.password_too_long', { max: PASSWORD_MAX_LENGTH });
  if (!password.trim()) return t('serverErrors.password_whitespace');
  if (!/\d/.test(password)) return t('serverErrors.password_policy');
  return null;
}
