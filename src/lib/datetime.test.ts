import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { almatyCivilDate, fromDatetimeLocalKZ, installAppTimeZone, parseAsUTC, todayInAlmaty, uninstallAppTimeZone } from './datetime';
import { eventsOnDay } from '../components/calendar/calendarUtils';
import type { Event } from '../types';

/**
 * The school runs on Almaty time. These pin that a viewer whose laptop is elsewhere sees the
 * same times, the same days and the same "now" as someone in Kazakhstan — 2026-09-10: the owner
 * in UTC+2 saw 20:18 on the calendar while it was 23:18 in Almaty.
 *
 * Each test sets the laptop's zone explicitly: Node applies a change of TZ at once. (Reached
 * through globalThis because the app's tsconfig carries no Node types.)
 */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env.TZ;

function laptopIn(zone: string) {
  env.TZ = zone;
}

afterEach(() => {
  uninstallAppTimeZone();
  vi.useRealTimers();
  env.TZ = ORIGINAL_TZ;
});

describe('every date on screen reads in Kazakhstan time', () => {
  beforeEach(() => laptopIn('Europe/Berlin'));

  it('formats a moment in Almaty time when the caller chose no zone', () => {
    installAppTimeZone();
    const moment = new Date('2026-09-10T18:18:00Z');
    expect(moment.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })).toBe('23:18');
    expect(moment.toLocaleDateString('en-US')).toBe('9/10/2026');
    expect(moment.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })).toContain('23:18');
  });

  it('respects a zone the caller chose on purpose', () => {
    installAppTimeZone();
    const moment = new Date('2026-09-10T18:18:00Z');
    expect(moment.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }))
      .toBe('18:18');
  });

  it('crosses midnight with Kazakhstan, not with the laptop', () => {
    installAppTimeZone();
    // 22:30 in Berlin on the 10th is already 01:30 on the 11th in Almaty.
    expect(new Date('2026-09-10T20:30:00Z').toLocaleDateString('en-US', { day: 'numeric', month: 'long' }))
      .toBe('September 11');
  });

  it('is undone cleanly', () => {
    installAppTimeZone();
    uninstallAppTimeZone();
    const moment = new Date('2026-09-10T18:18:00Z');
    expect(moment.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })).toBe('20:18');
  });
});

describe('calendar dates are never shifted', () => {
  it('a day cell keeps its date even east of Kazakhstan', () => {
    // In Tokyo, local midnight on the 10th is 20:00 on the 9th in Almaty: converting a date
    // cell would label it with the wrong day. Dates keep their own zone.
    laptopIn('Asia/Tokyo');
    installAppTimeZone();
    expect(new Date(2026, 8, 10).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' }))
      .toBe('10 Thursday');
  });

  it('and west of it', () => {
    laptopIn('America/New_York');
    installAppTimeZone();
    expect(new Date(2026, 8, 10).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }))
      .toBe('September 10');
  });
});

describe('Almaty days', () => {
  beforeEach(() => laptopIn('Europe/Berlin'));

  it('turns a moment into its Almaty calendar date', () => {
    const d = almatyCivilDate('2026-09-10T20:30:00Z');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 11]);
    expect(d.getHours()).toBe(0);
  });

  it('knows today is already tomorrow in Kazakhstan', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T20:30:00Z')); // 22:30 Berlin, 01:30 Almaty
    expect(todayInAlmaty().getDate()).toBe(11);
  });

  it('puts a late-evening Almaty lesson on its Almaty day', () => {
    const lesson = {
      id: 1, title: 'SAT', event_type: 'class',
      // 23:30–00:30 in Almaty on the 10th/11th; 20:30–21:30 in Berlin on the 10th.
      start_datetime: '2026-09-10T18:30:00Z', end_datetime: '2026-09-10T19:30:00Z',
    } as unknown as Event;
    const early = {
      ...lesson, id: 2,
      // 00:30 in Almaty on the 11th, still 21:30 on the 10th in Berlin.
      start_datetime: '2026-09-10T19:30:00Z', end_datetime: '2026-09-10T20:30:00Z',
    } as unknown as Event;
    expect(eventsOnDay(new Date(2026, 8, 10), [lesson, early]).map((e) => e.id)).toEqual([1]);
    expect(eventsOnDay(new Date(2026, 8, 11), [lesson, early]).map((e) => e.id)).toEqual([1, 2]);
  });
});

describe('Almaty form values', () => {
  it('submits a reschedule wall-clock time as Kazakhstan time, not the operator laptop time', () => {
    laptopIn('Europe/Stockholm');
    // The same value used to be parsed in Stockholm, then displayed as 19:00 in Almaty.
    expect(fromDatetimeLocalKZ('2026-09-13T16:00')).toBe('2026-09-13T11:00:00.000Z');
  });
});

describe('malformed dates never take the calendar down', () => {
  it('an unreadable date is no date, not an exception', () => {
    // 2026-09-10: one such event crashed the whole calendar for admins.
    expect(() => almatyCivilDate('not a date')).not.toThrow();
    expect(Number.isNaN(almatyCivilDate('not a date').getTime())).toBe(true);
  });

  it('an event with an unreadable date falls out of every day', () => {
    const broken = { id: 9, title: 'x', event_type: 'class', start_datetime: 'garbage', end_datetime: 'garbage' } as unknown as Event;
    expect(eventsOnDay(new Date(2026, 8, 10), [broken])).toEqual([]);
  });

  it('reads an offset-aware time that also got a Z appended', () => {
    expect(parseAsUTC('2026-09-10T14:00:00+00:00Z').toISOString()).toBe('2026-09-10T14:00:00.000Z');
    expect(almatyCivilDate('2026-09-10T20:30:00+00:00Z').getDate()).toBe(11);
  });
});
