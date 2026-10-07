import { describe, expect, it } from 'vitest';
import type { TelegramStatus } from '../services/api/notificationCenter';
import { WAIT_MS, atUsername, isTelegramLink, telegramPhase } from './telegramLink';

const status = (over: Partial<TelegramStatus> = {}): TelegramStatus => ({
  status: 'unlinked', linked: false, blocked: false, muted: false, telegram_username: null, linked_at: null, stale: false, ...over,
});

describe('telegramPhase', () => {
  it('checking until the first status arrives, then idle', () => {
    expect(telegramPhase(null, null, 0)).toBe('checking');
    expect(telegramPhase(status(), null, 0)).toBe('idle');
  });
  it('connected wins over everything', () => {
    expect(telegramPhase(status({ linked: true, status: 'linked' }), 1000, 1000 + WAIT_MS * 2)).toBe('connected');
  });
  it('waits after a link is made, then times out', () => {
    expect(telegramPhase(status({ status: 'pending' }), 1000, 1000 + 5000)).toBe('waiting');
    expect(telegramPhase(status({ status: 'pending' }), 1000, 1000 + WAIT_MS)).toBe('timed-out');
  });
  it('blocked when the person blocked the bot', () => {
    expect(telegramPhase(status({ blocked: true, status: 'blocked' }), null, 0)).toBe('blocked');
  });
});

describe('atUsername / isTelegramLink', () => {
  it('formats the username once', () => {
    expect(atUsername('aruzhan')).toBe('@aruzhan');
    expect(atUsername('@aruzhan')).toBe('@aruzhan');
    expect(atUsername('')).toBeNull();
  });
  it('opens t.me deep links only', () => {
    expect(isTelegramLink('https://t.me/MasterEduBot?start=abc_123')).toBe(true);
    expect(isTelegramLink('https://t.me.evil.example/x')).toBe(false);
    expect(isTelegramLink('javascript:alert(1)')).toBe(false);
  });
});
