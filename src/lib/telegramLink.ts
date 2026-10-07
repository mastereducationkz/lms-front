/**
 * The Telegram row's state (Settings): checking, connected, blocked, idle, or waiting for the
 * person to tap Start in the bot after opening the deep link — polled, but not for ever.
 */
import type { TelegramStatus } from '../services/api/notificationCenter';

export type TelegramPhase = 'checking' | 'connected' | 'blocked' | 'idle' | 'waiting' | 'timed-out';

/** How often the row asks while it waits, and for how long before it suggests a new link. */
export const POLL_MS = 3000;
export const WAIT_MS = 3 * 60 * 1000;

export function telegramPhase(status: TelegramStatus | null, linkCreatedAt: number | null, now: number): TelegramPhase {
  if (status?.linked) return 'connected';
  if (linkCreatedAt !== null) return now - linkCreatedAt < WAIT_MS ? 'waiting' : 'timed-out';
  if (!status) return 'checking';
  return status.blocked ? 'blocked' : 'idle';
}

/** "@name" whether or not the server sent the @. */
export function atUsername(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim().replace(/^@+/, '');
  return trimmed ? `@${trimmed}` : null;
}

/** Only real Telegram links are ever opened from here. */
export function isTelegramLink(url: unknown): url is string {
  return typeof url === 'string' && /^https:\/\/t\.me\/[^\s]+$/.test(url);
}
