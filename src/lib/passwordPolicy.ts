// The password rule every form checks before it submits, mirroring the server's
// src/utils/password_policy.py: 8–128 characters, at least one digit, not only spaces.
// The server also refuses the most common passwords; that message comes back from the API.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Shown under a new-password field before anything is typed. */
export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, including a digit`;

/** What's wrong with `password`, or null when the server will accept its shape. */
export function passwordPolicyError(password: string): string | null {
  // Count characters the way the server does (code points), so an emoji counts once.
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  if (!password.trim()) return 'Password cannot be only spaces';
  if (!/\d/.test(password)) return 'Password must contain at least one digit';
  return null;
}
