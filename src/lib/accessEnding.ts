import { almatyCivilDate } from './datetime';

/**
 * Platform access that ends on a date (owner policy, 2026-10-22). The CRM writes `users.access_until`
 * (the last valid day, inclusive) and closes the account itself; the LMS only tells the student. The
 * server sends `access_until` and `access_days_left` on /auth/me for students, and nothing here
 * decides on its own that anyone's access has ended.
 */

/** Whom a student writes to to extend their access. */
export const ACCESS_CONTACT_HANDLE = '@master_education_manager';
export const ACCESS_CONTACT_URL = 'https://t.me/master_education_manager';

/** The banner shows from this many days before the last valid day. */
export const ACCESS_BANNER_FROM_DAYS = 30;

type EndingUser = {
  role?: string | null;
  access_until?: string | null;
  access_days_left?: number | null;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Days to the student's last valid day when the banner applies (0 on that day, up to 30), else null. */
export function accessBannerDays(user: EndingUser | null | undefined): number | null {
  if (!user || user.role !== 'student' || !user.access_until) return null;
  const days = user.access_days_left;
  return typeof days === 'number' && days >= 0 && days <= ACCESS_BANNER_FROM_DAYS ? days : null;
}

/** The Almaty calendar day of `now` as "YYYY-MM-DD". */
export function almatyDayKey(now: Date = new Date()): string {
  const day = almatyCivilDate(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

const dismissedKey = (userId: string | number) => `lms:access-banner-hidden:${userId}`;

/** The student hid the banner today (it returns tomorrow). Storage may be blocked: then it shows. */
export function accessBannerDismissedToday(storage: StorageLike | null, userId: string | number, now: Date = new Date()): boolean {
  try {
    return storage?.getItem(dismissedKey(userId)) === almatyDayKey(now);
  } catch {
    return false;
  }
}

export function dismissAccessBannerToday(storage: StorageLike | null, userId: string | number, now: Date = new Date()): void {
  try {
    storage?.setItem(dismissedKey(userId), almatyDayKey(now));
  } catch {
    /* storage blocked: hidden for this render only */
  }
}
