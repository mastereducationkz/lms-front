import { describe, expect, it } from 'vitest';
import { canAddToGoogle, eventIdFromSearch, sortGroupCalendars, webcalUrl } from './calendarFeeds';

describe('webcalUrl', () => {
  it('turns the https feed into a subscribe link', () => {
    expect(webcalUrl('https://lmsapi.mastereducation.kz/calendar/feeds/group/1-abc.ics'))
      .toBe('webcal://lmsapi.mastereducation.kz/calendar/feeds/group/1-abc.ics');
  });

  it('leaves an already-webcal link alone', () => {
    expect(webcalUrl('webcal://host/feed.ics')).toBe('webcal://host/feed.ics');
  });
});

describe('canAddToGoogle', () => {
  it('is true only for a Google Calendar link', () => {
    expect(canAddToGoogle({ google_url: 'https://calendar.google.com/calendar/u/0?cid=abc' })).toBe(true);
    expect(canAddToGoogle({ google_url: null })).toBe(false);
    expect(canAddToGoogle({ google_url: 'https://evil.example/calendar' })).toBe(false);
  });
});

describe('sortGroupCalendars', () => {
  it('lists ready calendars first, then alphabetically', () => {
    const rows = [
      { group_name: 'Б группа', google_url: null },
      { group_name: 'В группа', google_url: 'https://calendar.google.com/calendar/u/0?cid=v' },
      { group_name: 'А группа', google_url: null },
    ];
    expect(sortGroupCalendars(rows).map((r) => r.group_name)).toEqual(['В группа', 'А группа', 'Б группа']);
  });
});

describe('eventIdFromSearch', () => {
  it('reads a numeric event id', () => {
    expect(eventIdFromSearch('?event=18844')).toBe(18844);
  });

  it('ignores anything that is not a positive integer', () => {
    expect(eventIdFromSearch('')).toBeNull();
    expect(eventIdFromSearch('?event=abc')).toBeNull();
    expect(eventIdFromSearch('?event=-3')).toBeNull();
    expect(eventIdFromSearch('?event=0')).toBeNull();
  });
});
