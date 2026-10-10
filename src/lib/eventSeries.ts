import type { Event, UpdateEventRequest } from '../types';

/** A row of the admin events list: one event, or a recurring series collapsed into one item. */
export type EventListItem =
  | { kind: 'event'; event: Event }
  | { kind: 'series'; seriesId: string; title: string; events: Event[]; total: number; upcoming: number; next: Event };

const startOf = (event: Event): number => Date.parse(event.start_datetime);

/**
 * Collapse the occurrences of each recurring series into one item (the weekly office hours are 50 rows each). The
 * server ties them with `series_id`; an event with none, or the only one of its series in the list, stays a row of its
 * own. Items are in date order by the series' next occurrence (its last one when all have passed).
 */
export function groupSeries(events: Event[], now: Date = new Date()): EventListItem[] {
  const bySeries = new Map<string, Event[]>();
  for (const event of events) {
    if (event.series_id) bySeries.set(event.series_id, [...(bySeries.get(event.series_id) ?? []), event]);
  }
  const placed = new Set<string>();
  const items: { at: number; item: EventListItem }[] = [];
  for (const event of events) {
    const members = event.series_id ? bySeries.get(event.series_id)! : null;
    if (!members || members.length < 2) {
      items.push({ at: startOf(event), item: { kind: 'event', event } });
      continue;
    }
    if (placed.has(event.series_id!)) continue;
    placed.add(event.series_id!);
    const ordered = [...members].sort((a, b) => startOf(a) - startOf(b));
    const upcoming = ordered.filter((e) => startOf(e) > now.getTime());
    const next = upcoming[0] ?? ordered[ordered.length - 1];
    items.push({ at: startOf(next), item: { kind: 'series', seriesId: event.series_id!, title: next.title, events: ordered, total: ordered.length, upcoming: upcoming.length, next } });
  }
  return items.sort((a, b) => a.at - b.at).map((entry) => entry.item);
}

/** The given name in a full name: «Surname Name Patronymic» and «Surname Name» both give the second word. */
export function shortName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words.length === 1 ? words[0] : words[1];
}

const DASH = ' — ';

/** «NUET Math Office Hours — Akzhol» with a new host name; a title without a name gets one, an empty name changes nothing. */
export function retitleForHost(title: string, name: string): string {
  const host = name.trim();
  if (!host) return title;
  const at = title.lastIndexOf(DASH);
  return at < 0 ? `${title}${DASH}${host}` : `${title.slice(0, at)}${DASH}${host}`;
}

/**
 * A title is plain text, so changing the host does not rename the event. When the host changed and the title names a
 * host after its dash, this is the title with the new host's given name in it - offered, never applied by itself.
 */
export function hostSuggestion(title: string, oldHost: string, newHost: string): string | null {
  if (!newHost || oldHost === newHost) return null;
  const at = title.lastIndexOf(DASH);
  if (at < 0) return null;
  const given = shortName(newHost);
  if (!given || title.slice(at + DASH.length).trim() === given) return null;
  return retitleForHost(title, given);
}

/** What an edit of «this and all following» may carry: the fields of a whole series that actually changed. */
export interface SeriesEditable {
  title: string;
  description?: string | null;
  teacher_id?: number | null;
  location?: string | null;
  is_online: boolean;
  max_participants?: number | null;
  start_datetime: string;
  end_datetime: string;
}

const minute = (iso: string): number => Math.floor(Date.parse(iso) / 60000);

export function followingPayload(original: SeriesEditable, edited: SeriesEditable): Partial<UpdateEventRequest> {
  const payload: Partial<UpdateEventRequest> = {};
  if (edited.title !== original.title) payload.title = edited.title;
  if ((edited.description || '') !== (original.description || '')) payload.description = edited.description || '';
  if ((edited.teacher_id ?? null) !== (original.teacher_id ?? null) && edited.teacher_id != null) payload.teacher_id = edited.teacher_id;
  if ((edited.location || '') !== (original.location || '')) payload.location = edited.location || '';
  if (edited.is_online !== original.is_online) payload.is_online = edited.is_online;
  if ((edited.max_participants ?? null) !== (original.max_participants ?? null) && edited.max_participants != null) payload.max_participants = edited.max_participants;
  if (minute(edited.start_datetime) !== minute(original.start_datetime) || minute(edited.end_datetime) !== minute(original.end_datetime)) {
    payload.start_datetime = edited.start_datetime;
    payload.end_datetime = edited.end_datetime;
  }
  return payload;
}
