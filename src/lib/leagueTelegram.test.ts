// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SNOOZE_DAYS, knownLinked, lineMode, readSnoozed, rememberLinked, snooze, snoozeActive } from './leagueTelegram';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 13, 10, 0, 0);

describe('«Not now»', () => {
  it('lasts exactly seven days', () => {
    expect(SNOOZE_DAYS).toBe(7);
    expect(snoozeActive(String(NOW - 6 * DAY), NOW)).toBe(true);
    expect(snoozeActive(String(NOW - 7 * DAY + 1), NOW)).toBe(true);
    expect(snoozeActive(String(NOW - 7 * DAY), NOW)).toBe(false);
    expect(snoozeActive(String(NOW - 30 * DAY), NOW)).toBe(false);
  });

  it('ignores a missing, garbled or future value, so a bad entry can never hide the line for good', () => {
    expect(snoozeActive(null, NOW)).toBe(false);
    expect(snoozeActive('', NOW)).toBe(false);
    expect(snoozeActive('soon', NOW)).toBe(false);
    expect(snoozeActive('0', NOW)).toBe(false);
    expect(snoozeActive(String(NOW + DAY), NOW)).toBe(false);
  });
});

/** The Node-hosted jsdom here has no working Storage, so the tests bring a plain one. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
  };
}

describe('the remembered state, per user, with storage that may fail', () => {
  const real = Object.getOwnPropertyDescriptor(window, 'localStorage');
  beforeEach(() => Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true }));
  afterEach(() => {
    if (real) Object.defineProperty(window, 'localStorage', real);
    else delete (window as unknown as Record<string, unknown>).localStorage;
  });

  it('remembers a snooze and a link for that user only', () => {
    snooze(7, NOW);
    expect(readSnoozed(7, NOW + DAY)).toBe(true);
    expect(readSnoozed(8, NOW + DAY)).toBe(false);
    expect(readSnoozed(7, NOW + 8 * DAY)).toBe(false);
    rememberLinked(7);
    expect(knownLinked(7)).toBe(true);
    expect(knownLinked(8)).toBe(false);
  });

  it('shows the line again rather than throwing when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    Object.defineProperty(window, 'localStorage', { value: blocked, configurable: true });
    expect(() => snooze(7, NOW)).not.toThrow();
    expect(() => rememberLinked(7)).not.toThrow();
    expect(readSnoozed(7, NOW)).toBe(false);
    expect(knownLinked(7)).toBe(false);
  });
});

describe('what the line shows', () => {
  const base = { stale: false, wasWaiting: false, thanksOver: false };

  it('offers only when the status is known and there is no link', () => {
    expect(lineMode({ ...base, phase: 'idle' })).toBe('offer');
  });

  it('shows nothing while loading, after an error (still checking), or when the bot was blocked', () => {
    expect(lineMode({ ...base, phase: 'checking' })).toBe('hidden');
    expect(lineMode({ ...base, phase: 'blocked' })).toBe('hidden');
  });

  it('shows nothing when Support could not be reached and the answer is only the last remembered one', () => {
    expect(lineMode({ ...base, phase: 'idle', stale: true })).toBe('hidden');
  });

  it('waits for Start, then lets the person try again', () => {
    expect(lineMode({ ...base, phase: 'waiting' })).toBe('waiting');
    expect(lineMode({ ...base, phase: 'timed-out' })).toBe('timed-out');
  });

  it('thanks only someone who connected here, once, and is then gone for good', () => {
    expect(lineMode({ ...base, phase: 'connected' })).toBe('hidden');
    expect(lineMode({ ...base, phase: 'connected', wasWaiting: true })).toBe('thanks');
    expect(lineMode({ ...base, phase: 'connected', wasWaiting: true, thanksOver: true })).toBe('hidden');
  });
});
