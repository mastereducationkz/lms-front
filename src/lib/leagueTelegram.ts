/**
 * The Master League banner's quiet «Connect Telegram» line: when it shows and for how long «Not now'
 * hides it. A per-viewer convenience, so it lives in localStorage and every access is guarded: the
 * line then simply shows again (storage blocked, a private window).
 */
import type { TelegramPhase } from './telegramLink';

export const SNOOZE_DAYS = 7;
const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;
/** How long the thank-you stays before the line goes for good. */
export const THANKS_MS = 8000;

const snoozeKey = (userId: number | string) => `ml.telegram.snoozedAt.${userId}`;
const linkedKey = (userId: number | string) => `ml.telegram.linked.${userId}`;

/** Is a stored «not now» (ms since the epoch, as text) still in force? Missing, garbled or future values are not. */
export function snoozeActive(stored: string | null, now: number): boolean {
  if (stored === null) return false;
  const at = Number(stored);
  return Number.isFinite(at) && at > 0 && at <= now && now - at < SNOOZE_MS;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* blocked storage: the line will simply ask again next time */
  }
}

export const readSnoozed = (userId: number | string, now: number) => snoozeActive(read(snoozeKey(userId)), now);
export const snooze = (userId: number | string, now: number) => write(snoozeKey(userId), String(now));

/** Once linked, this browser stops asking the server about it («disappears for good»). */
export const knownLinked = (userId: number | string) => read(linkedKey(userId)) === '1';
export const rememberLinked = (userId: number | string) => write(linkedKey(userId), '1');

export type LineMode = 'hidden' | 'offer' | 'waiting' | 'timed-out' | 'thanks';

/**
 * What the line shows. Nothing while the status loads or after an error (`checking`), when the
 * person blocked the bot (never nag), when Support could not be reached so the answer is only the
 * last remembered one (`stale`), or when they were already connected before this visit.
 */
export function lineMode(input: { phase: TelegramPhase; stale: boolean; wasWaiting: boolean; thanksOver: boolean }): LineMode {
  switch (input.phase) {
    case 'idle':
      return input.stale ? 'hidden' : 'offer';
    case 'waiting':
      return 'waiting';
    case 'timed-out':
      return 'timed-out';
    case 'connected':
      return input.wasWaiting && !input.thanksOver ? 'thanks' : 'hidden';
    default:
      return 'hidden';
  }
}
