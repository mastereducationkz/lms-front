import { describe, expect, it } from 'vitest';
import {
  ACCESS_BANNER_FROM_DAYS,
  ACCESS_CONTACT_HANDLE,
  ACCESS_CONTACT_URL,
  accessBannerDays,
  accessBannerDismissedToday,
  almatyDayKey,
  dismissAccessBannerToday,
} from './accessEnding';

const student = (days: number | null | undefined, extra: Record<string, unknown> = {}) => ({
  id: '5', role: 'student', access_until: '2026-12-07', access_days_left: days, ...extra,
});

function store(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('the access-ending banner', () => {
  it('names the manager the student writes to', () => {
    expect(ACCESS_CONTACT_HANDLE).toBe('@master_education_manager');
    expect(ACCESS_CONTACT_URL).toBe('https://t.me/master_education_manager');
  });

  it('shows for a student from 30 days out to the last day, and not otherwise', () => {
    expect(ACCESS_BANNER_FROM_DAYS).toBe(30);
    for (const days of [30, 15, 7, 1, 0]) expect(accessBannerDays(student(days))).toBe(days);
    for (const days of [31, 365, -1, null, undefined]) expect(accessBannerDays(student(days))).toBeNull();
  });

  it('never shows without a date, or for anyone but a student', () => {
    expect(accessBannerDays(student(7, { access_until: null }))).toBeNull();
    for (const role of ['teacher', 'parent', 'curator', 'admin']) expect(accessBannerDays(student(7, { role }))).toBeNull();
    expect(accessBannerDays(null)).toBeNull();
  });
});

describe('hiding the banner for the day', () => {
  const noon = new Date('2026-11-06T07:00:00Z'); // 12:00 Almaty

  it('counts the day on the Almaty clock', () => {
    expect(almatyDayKey(new Date('2026-11-06T18:59:00Z'))).toBe('2026-11-06'); // 23:59 in Almaty
    expect(almatyDayKey(new Date('2026-11-06T19:00:00Z'))).toBe('2026-11-07'); // midnight in Almaty
  });

  it('stays hidden for the rest of the day and comes back tomorrow', () => {
    const s = store();
    expect(accessBannerDismissedToday(s, '5', noon)).toBe(false);
    dismissAccessBannerToday(s, '5', noon);
    expect(accessBannerDismissedToday(s, '5', noon)).toBe(true);
    expect(accessBannerDismissedToday(s, '5', new Date('2026-11-06T18:00:00Z'))).toBe(true); // 23:00
    expect(accessBannerDismissedToday(s, '5', new Date('2026-11-06T19:01:00Z'))).toBe(false); // after midnight
  });

  it('is per student, so a shared browser does not hide it for the next one', () => {
    const s = store();
    dismissAccessBannerToday(s, '5', noon);
    expect(accessBannerDismissedToday(s, '6', noon)).toBe(false);
  });

  it('works without storage: shown, never throwing', () => {
    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(() => dismissAccessBannerToday(blocked, '5', noon)).not.toThrow();
    expect(accessBannerDismissedToday(blocked, '5', noon)).toBe(false);
    expect(accessBannerDismissedToday(null, '5', noon)).toBe(false);
    expect(() => dismissAccessBannerToday(null, '5', noon)).not.toThrow();
  });
});
