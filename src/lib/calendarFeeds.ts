import type { GroupCalendarLink } from '../services/api/calendarFeeds';

/** `webcal://` makes Apple Calendar and Outlook offer "subscribe" instead of downloading a file. */
export function webcalUrl(url: string): string {
  return url.replace(/^https?:\/\//i, 'webcal://');
}

/** The "Add to Google Calendar" link is offered only for a real, shared Google Calendar. */
export function canAddToGoogle(row: Pick<GroupCalendarLink, 'google_url'>): boolean {
  return typeof row.google_url === 'string' && row.google_url.startsWith('https://calendar.google.com/');
}

/** Groups with a Google Calendar first, then the ones still being prepared, each alphabetically. */
export function sortGroupCalendars<T extends Pick<GroupCalendarLink, 'google_url' | 'group_name'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ready = Number(canAddToGoogle(b)) - Number(canAddToGoogle(a));
    return ready !== 0 ? ready : a.group_name.localeCompare(b.group_name, 'ru');
  });
}

/** Parse a `?event=<id>` deep link (the link inside every calendar entry). */
export function eventIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('event');
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
