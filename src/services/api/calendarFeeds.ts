import { api } from './client';

/** One group calendar the viewer can add. `google_url` is null until the LMS has created and
 * shared that group's Google Calendar (it happens in the background, a few groups at a time). */
export interface GroupCalendarLink {
  group_id: number;
  group_name: string;
  google_url: string | null;
  ics_url: string;
  webcal_url: string;
}

export interface PersonalFeed {
  ics_url: string;
  webcal_url: string;
  created_at: string | null;
  rotated_at: string | null;
}

export interface CalendarSubscriptions {
  groups: GroupCalendarLink[];
  personal: PersonalFeed;
}

/**
 * The calendars this person can subscribe to.
 *
 * **Never cached**: the personal feed URL carries a secret the owner can rotate, and a cached
 * response would keep showing a link that no longer works.
 */
export async function getCalendarSubscriptions(): Promise<CalendarSubscriptions> {
  const response = await api.get('/calendar/subscriptions', { cache: false } as never);
  return response.data as CalendarSubscriptions;
}

/** Replace the personal feed secret: every existing subscription to the old link stops. */
export async function rotatePersonalFeed(): Promise<PersonalFeed> {
  const response = await api.post('/calendar/feed-token/rotate');
  return response.data as PersonalFeed;
}
