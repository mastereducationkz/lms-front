/**
 * The Settings notification grid (owner Q7/Q10/Q16, 2026-10-07): one row per event the server
 * lists for this person's role, one column per channel. In-app is always on. «Push» is one column
 * for both the browser/installed app (web_push) and the mobile app (push): people think of
 * «notifications on my phone», not of two transports, so one switch sets both.
 * Pure, so the grid's rules are tested without a browser.
 */
import type { ChannelKey, NotificationEvent, NotificationSettings, NotificationSettingsUpdate } from '../services/api/notificationCenter';

export type ColumnKey = 'in_app' | 'email' | 'telegram' | 'push';

export const COLUMN_ORDER: readonly ColumnKey[] = ['in_app', 'email', 'telegram', 'push'];

const channelsOf = (column: ColumnKey): ChannelKey[] => (column === 'push' ? ['web_push', 'push'] : [column]);

export interface Cell {
  /** The event can use this channel at all (curators have no email, for one). */
  present: boolean;
  enabled: boolean;
  /** In-app, or a channel the server won't let this person switch. */
  locked: boolean;
}

export function cellFor(event: NotificationEvent, column: ColumnKey): Cell {
  if (column === 'in_app') return { present: true, enabled: true, locked: true };
  const states = channelsOf(column)
    .map((c) => event.channels[c])
    .filter((s): s is NonNullable<typeof s> => !!s);
  if (states.length === 0) return { present: false, enabled: false, locked: true };
  return { present: true, enabled: states.some((s) => s.enabled), locked: states.every((s) => !s.switchable) };
}

/** The columns at least one of this person's events uses, in display order. */
export function matrixColumns(settings: Pick<NotificationSettings, 'events'>): ColumnKey[] {
  return COLUMN_ORDER.filter((column) => column === 'in_app' || settings.events.some((e) => cellFor(e, column).present));
}

/** Whether the channel can reach this person right now (Telegram linked, a device subscribed). */
export function columnAvailable(settings: Pick<NotificationSettings, 'channels'>, column: ColumnKey): boolean {
  if (column === 'in_app') return true;
  return channelsOf(column).some((c) => settings.channels[c]?.available === true);
}

/** The PUT body for flipping one cell: only that event, and every transport behind the column. */
export function toggleUpdate(event: NotificationEvent, column: ColumnKey, on: boolean): NotificationSettingsUpdate {
  const channels: Partial<Record<ChannelKey, boolean>> = {};
  for (const c of channelsOf(column)) {
    const state = event.channels[c];
    if (state?.switchable) channels[c] = on;
  }
  return { events: { [event.key]: channels } };
}

/** The same flip applied to the local copy, so the switch moves before the server answers. */
export function applyToggle(settings: NotificationSettings, eventKey: string, column: ColumnKey, on: boolean): NotificationSettings {
  return {
    ...settings,
    events: settings.events.map((event) => {
      if (event.key !== eventKey) return event;
      const channels = { ...event.channels };
      for (const c of channelsOf(column)) {
        const state = channels[c];
        if (state?.switchable) channels[c] = { ...state, enabled: on };
      }
      return { ...event, channels };
    }),
  };
}

/** "22:00"-style clock, as the server stores it; anything else is refused before a request. */
export function isClock(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
