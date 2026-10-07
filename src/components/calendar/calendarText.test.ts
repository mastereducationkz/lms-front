import { describe, expect, it } from 'vitest';
import type { Event } from '../../types';
import { eventCountText, eventTypeName, hourTileTitle } from './calendarText';

const ev = (id: number, event_type: Event['event_type'], title = `Event ${id}`) => ({ id, event_type, title }) as Event;

describe('the calendar in both languages', () => {
  it('counts lessons when every event is a class, else events, inflected in Russian', () => {
    const classes = [ev(1, 'class'), ev(2, 'class')];
    expect(eventCountText(classes, 'en')).toBe('2 lessons');
    expect(eventCountText(classes, 'ru')).toBe('2 урока');
    expect(eventCountText([ev(1, 'class'), ev(2, 'webinar')], 'en')).toBe('2 events');
    expect([1, 2, 5, 21].map((n) => eventCountText(Array.from({ length: n }, (_, i) => ev(i, 'webinar')), 'ru')))
      .toEqual(['1 событие', '2 события', '5 событий', '21 событие']);
  });

  it('names the event types', () => {
    expect(eventTypeName('weekly_test', 'en')).toBe('Weekly Test');
    expect(eventTypeName('assignment', 'ru')).toBe('Дедлайн ДЗ');
  });

  it('lists a busy hour and the rest as «…and N more»', () => {
    const events = Array.from({ length: 14 }, (_, i) => ev(i, 'webinar', `W${i}`));
    const tile = { hour: 18, events } as Parameters<typeof hourTileTitle>[0];
    expect(hourTileTitle(tile, 'en').split('\n').pop()).toBe('…and 2 more');
    expect(hourTileTitle(tile, 'ru').split('\n').pop()).toBe('…и ещё 2');
  });
});
