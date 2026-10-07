/**
 * The calendar's words in the user's language. calendarUtils and weekLayout keep English labels
 * (typeLabel, countLabel, tileTooltip) for their tests and other callers; the views use these.
 */
import { activeLocale, t, type Locale, type MessageKey } from '../../lib/i18n';
import '@/lib/i18n/catalogs/chatLive';
import type { Event, EventType } from '../../types';
import { cardTitle, type HourTile } from './weekLayout';

const TYPE_KEYS: Record<EventType, MessageKey> = {
  class: 'chatLive.calendar.type.class',
  weekly_test: 'chatLive.calendar.type.weeklyTest',
  webinar: 'chatLive.calendar.type.webinar',
  assignment: 'chatLive.calendar.type.assignment',
};

/** «Class», «Weekly Test»… / «Урок», «Еженедельный тест»… */
export function eventTypeName(type: EventType, locale: Locale = activeLocale()): string {
  return t(TYPE_KEYS[type] ?? 'chatLive.calendar.type.event', undefined, locale);
}

/** «3 lessons» when every event is a class, else «3 events». */
export function eventCountText(events: Event[], locale: Locale = activeLocale()): string {
  const count = events.length;
  const lessons = count > 0 && events.every((e) => e.event_type === 'class');
  return t(lessons ? 'common.lessons' : 'chatLive.calendar.eventCount', { count }, locale);
}

/** A busy hour's tooltip: one name per line, the rest as «…and 3 more». */
export function hourTileTitle(tile: HourTile, locale: Locale = activeLocale(), limit = 12): string {
  const names = tile.events.slice(0, limit).map(cardTitle);
  const rest = tile.events.length - names.length;
  return rest > 0 ? [...names, t('chatLive.calendar.andMore', { count: rest }, locale)].join('\n') : names.join('\n');
}
