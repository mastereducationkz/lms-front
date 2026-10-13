import { describe, expect, it } from 'vitest';
import { canRestore, followingPayload, groupSeries, hostSuggestion, isCancelled, retitleForHost, shortName } from './eventSeries';
import type { Event } from '../types';

const now = new Date('2026-10-10T10:00:00Z');
const ev = (id: number, iso: string, extra: Partial<Event> = {}): Event => ({
  id, title: 'NUET Math Office Hours — Akzhol', event_type: 'webinar', start_datetime: iso, end_datetime: iso, is_online: true,
  created_by: 1, is_active: true, is_recurring: false, series_id: null, ...extra,
} as Event);
const week = (n: number) => new Date(Date.parse('2026-10-03T09:00:00Z') + n * 7 * 86400000).toISOString();

describe('groupSeries', () => {
  it('collapses the occurrences of one series into one item, with the next one up front', () => {
    const events = [0, 1, 2, 3, 4].map((n) => ev(n + 1, week(n), { series_id: 'abc' }));
    const items = groupSeries(events, now);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.kind).toBe('series');
    if (item.kind === 'series') {
      expect(item.total).toBe(5);
      expect(item.upcoming).toBe(3);                       // 3 and 10 Oct have started, 17 / 24 / 31 Oct have not
      expect(item.next.id).toBe(3);
    }
  });

  it('keeps single events and events without a series as they are', () => {
    const items = groupSeries([ev(1, week(2)), ev(2, week(3), { series_id: 'solo' }), ev(3, week(4), { series_id: null })], now);
    expect(items.map((i) => i.kind)).toEqual(['event', 'event', 'event']);
  });

  it('keeps two series apart and orders items by their next date', () => {
    const a = [1, 2].map((n) => ev(n, week(n + 2), { series_id: 'a', title: 'A' }));
    const b = [3, 4].map((n) => ev(n, week(n - 2), { series_id: 'b', title: 'B' }));
    const items = groupSeries([...a, ...b], now);
    expect(items.map((i) => (i.kind === 'series' ? i.title : i.event.title))).toEqual(['B', 'A']);
  });

  it('a series whose weeks are all in the past shows its last occurrence', () => {
    const events = [0, 1].map((n) => ev(n + 1, week(n - 6), { series_id: 'old' }));
    const item = groupSeries(events, now)[0];
    expect(item.kind === 'series' && [item.upcoming, item.next.id]).toEqual([0, 2]);
  });
});

describe('groupSeries with cancelled weeks', () => {
  const cancelled = { is_active: false };

  it('does not count a cancelled week, and never makes it the next one', () => {
    const events = [0, 1, 2, 3, 4].map((n) => ev(n + 1, week(n), { series_id: 'abc', ...(n >= 3 ? cancelled : {}) }));
    const item = groupSeries(events, now)[0];
    expect(item.kind).toBe('series');
    if (item.kind === 'series') {
      expect([item.total, item.upcoming, item.next.id]).toEqual([3, 1, 3]);   // weeks 3, 10 and 17 Oct are live
      expect(item.events).toHaveLength(5);                                    // the cancelled ones still open under the line
      expect([item.cancelled, item.restorable, item.restoreFrom?.id]).toEqual([2, 2, 4]);
    }
  });

  it('keeps a series whose every week is cancelled as one line, ready to be restored', () => {
    const events = [2, 3, 4].map((n) => ev(n, week(n), { series_id: 'gone', ...cancelled }));
    const item = groupSeries(events, now)[0];
    expect(item.kind).toBe('series');
    if (item.kind === 'series') {
      expect([item.total, item.upcoming, item.cancelled]).toEqual([0, 0, 3]);
      expect(item.restoreFrom?.id).toBe(2);
    }
  });

  it('does not offer to restore a cancelled week that has already ended', () => {
    const events = [ev(1, week(-2), { series_id: 's', ...cancelled }), ev(2, week(2), { series_id: 's' }), ev(3, week(3), { series_id: 's', ...cancelled })];
    const item = groupSeries(events, now)[0];
    expect(item.kind === 'series' && [item.cancelled, item.restorable, item.restoreFrom?.id]).toEqual([2, 1, 3]);
  });

  it('knows a cancelled event from a live one, and which cancelled ones can come back', () => {
    expect(isCancelled(ev(1, week(2)))).toBe(false);
    expect(isCancelled(ev(1, week(2), cancelled))).toBe(true);
    expect(canRestore(ev(1, week(2), cancelled), now)).toBe(true);
    expect(canRestore(ev(1, week(-2), cancelled), now)).toBe(false);
    expect(canRestore(ev(1, week(2)), now)).toBe(false);              // not cancelled: nothing to restore
  });
});

describe('shortName and retitleForHost', () => {
  it('takes the given name from «Surname Name Patronymic» and «Surname Name»', () => {
    expect(shortName('Орынбасар Ақжол Ерғалиұлы')).toBe('Ақжол');
    expect(shortName('Қайратқызы Дина')).toBe('Дина');
    expect(shortName('Steve')).toBe('Steve');
    expect(shortName('  ')).toBe('');
  });

  it('replaces the name after the dash in the title', () => {
    expect(retitleForHost('NUET Math Office Hours — Akzhol', 'Дина')).toBe('NUET Math Office Hours — Дина');
    expect(retitleForHost('IELTS Speaking Club — Miss Zinaenur', 'Said')).toBe('IELTS Speaking Club — Said');
  });

  it('adds the name when the title has none, and leaves the title when there is no name', () => {
    expect(retitleForHost('NUET Math Office Hours', 'Дина')).toBe('NUET Math Office Hours — Дина');
    expect(retitleForHost('NUET Math Office Hours — Akzhol', '')).toBe('NUET Math Office Hours — Akzhol');
  });

  it('only the last dash counts', () => {
    expect(retitleForHost('A — B Club — Old', 'New')).toBe('A — B Club — New');
  });
});

describe('hostSuggestion', () => {
  it('offers a new title when the host changed and the title names the old one', () => {
    expect(hostSuggestion('NUET Math Office Hours — Akzhol', 'Орынбасар Ақжол Ерғалиұлы', 'Қайратқызы Дина'))
      .toBe('NUET Math Office Hours — Дина');
  });

  it('offers nothing when the title does not carry a name, the host is unchanged, or the name is already right', () => {
    expect(hostSuggestion('NUET Math Office Hours', 'A B', 'C D')).toBeNull();
    expect(hostSuggestion('X — Дина', 'Қайратқызы Дина', 'Қайратқызы Дина')).toBeNull();
    expect(hostSuggestion('X — Дина', 'Орынбасар Ақжол', 'Қайратқызы Дина')).toBeNull();
  });
});

describe('followingPayload', () => {
  it('compares times to the minute, as the form does', () => {
    const o = { title: 'T', is_online: true, start_datetime: '2026-10-10T09:00:30Z', end_datetime: '2026-10-10T10:00:30Z' };
    expect(followingPayload(o, { ...o, start_datetime: '2026-10-10T09:00:00Z', end_datetime: '2026-10-10T10:00:00Z' })).toEqual({});
  });

  const original = { title: 'T — A', description: 'D', teacher_id: 5, location: 'Google Meet', is_online: true, max_participants: undefined,
    start_datetime: '2026-10-10T09:00:00Z', end_datetime: '2026-10-10T10:00:00Z' };

  it('is empty when nothing a whole series can take has changed', () => {
    expect(followingPayload(original, { ...original, start_datetime: '2026-10-10T09:00:00.000Z' })).toEqual({});
  });

  it('carries only what changed', () => {
    expect(followingPayload(original, { ...original, title: 'T — B', teacher_id: 7 })).toEqual({ title: 'T — B', teacher_id: 7 });
  });

  it('a new time sends both ends, and an empty description counts as none', () => {
    const got = followingPayload({ ...original, description: undefined }, { ...original, description: '', start_datetime: '2026-10-10T10:00:00Z', end_datetime: '2026-10-10T11:30:00Z' });
    expect(got).toEqual({ start_datetime: '2026-10-10T10:00:00Z', end_datetime: '2026-10-10T11:30:00Z' });
  });
});
