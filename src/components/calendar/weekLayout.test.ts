import { describe, expect, it } from 'vitest';
import type { Event } from '../../types';
import {
  countLabel, lanesForWidth, maxConcurrency, planDay, tileDots, tileLabel, tileTooltip,
  type HourTile,
} from './weekLayout';
import { weekTimeWindow } from './calendarUtils';

let nextId = 1;

/** A minimal event on 10 Sep 2026, times given in Almaty (+05:00). */
function ev(start: string, end: string, extra: Partial<Event> = {}): Event {
  const id = nextId++;
  return {
    id,
    title: `Group ${id} - Teacher: Lesson 1`,
    event_type: 'class',
    start_datetime: `2026-09-10T${start}:00+05:00`,
    end_datetime: `2026-09-10T${end}:00+05:00`,
    groups: [`Group ${id} - Teacher`],
    group_ids: [id],
    ...extra,
  } as unknown as Event;
}

/** n identical lessons at the same hour, each its own group. */
function wave(n: number, start = '19:00', end = '20:00'): Event[] {
  return Array.from({ length: n }, () => ev(start, end));
}

describe('maxConcurrency', () => {
  it('is 0 for an empty day and 1 for events that never overlap', () => {
    expect(maxConcurrency([])).toBe(0);
    expect(maxConcurrency([ev('10:00', '11:00'), ev('13:00', '14:00'), ev('18:00', '19:00')])).toBe(1);
  });

  it('counts identical start times', () => {
    expect(maxConcurrency(wave(23))).toBe(23);
  });

  it('treats back-to-back events as not overlapping', () => {
    expect(maxConcurrency([ev('18:00', '19:00'), ev('19:00', '20:00'), ev('20:00', '21:00')])).toBe(1);
  });

  it('finds the peak inside a chain of overlaps', () => {
    const chain = [ev('14:00', '15:00'), ev('14:30', '15:30'), ev('15:00', '16:00'), ev('15:30', '16:30')];
    expect(maxConcurrency(chain)).toBe(2);
  });

  it('gives a zero-length event the same half hour the card layout does', () => {
    // An assignment deadline starts and ends at 22:00 but is drawn 30 minutes tall.
    expect(maxConcurrency([ev('22:00', '22:00'), ev('22:10', '22:10')])).toBe(2);
  });
});

describe('weekTimeWindow', () => {
  it('keeps the compact 06:00 start when the week has no early lesson', () => {
    expect(weekTimeWindow([ev('08:00', '09:00')]).startMin).toBe(360);
  });

  it('extends only as far as an actual early lesson instead of hiding it at 06:00', () => {
    expect(weekTimeWindow([ev('05:00', '06:00')]).startMin).toBe(300);
  });
});

describe('planDay', () => {
  it('keeps side-by-side cards while they fit', () => {
    const plan = planDay([ev('19:00', '20:00'), ev('19:00', '20:00')], 2);
    expect(plan.mode).toBe('detail');
    if (plan.mode === 'detail') expect(plan.laid).toHaveLength(2);
  });

  it('switches to hour tiles once the peak exceeds the lanes', () => {
    expect(planDay(wave(3), 2).mode).toBe('summary');
  });

  it('keeps a long chained evening with low overlap in detail mode', () => {
    // The screenshot's failure: overlaps chained from 14:00 to 22:00 but never more
    // than two at a time. That must stay readable cards, not collapse into tiles.
    const chain: Event[] = [];
    for (let h = 14; h < 22; h++) {
      chain.push(ev(`${h}:00`, `${h + 1}:00`), ev(`${h}:30`, `${h + 1}:30`));
    }
    const plan = planDay(chain, 2);
    expect(plan.mode).toBe('detail');
    if (plan.mode === 'detail') expect(Math.max(...plan.laid.map((l) => l.ncols))).toBe(2);
  });

  it('buckets by start hour in Almaty time, sorted, with a class count', () => {
    const day = [
      ...wave(5, '19:00', '20:00'),
      ev('19:30', '20:30'),
      ev('19:45', '20:45', { event_type: 'weekly_test', title: 'SAT Verbal' } as Partial<Event>),
      ...wave(4, '18:00', '19:00'),
      ev('20:00', '21:00'),
    ];
    const plan = planDay(day, 2);
    expect(plan.mode).toBe('summary');
    if (plan.mode !== 'summary') return;

    expect(plan.tiles.map((t) => t.hour)).toEqual([18, 19, 20]);
    const at19 = plan.tiles[1];
    expect(at19.events).toHaveLength(7);
    expect(at19.classCount).toBe(6);
    const starts = at19.events.map((e) => e.start_datetime.slice(11, 16));
    expect(starts).toEqual([...starts].sort());
  });

  it('puts every event of the day into exactly one tile', () => {
    const day = [...wave(6, '19:00', '20:00'), ...wave(3, '21:00', '22:00'), ev('09:15', '10:15')];
    const plan = planDay(day, 2);
    if (plan.mode !== 'summary') throw new Error('expected summary');
    expect(plan.tiles.reduce((n, t) => n + t.events.length, 0)).toBe(day.length);
  });
});

describe('lanesForWidth', () => {
  it('fits one lane per ~76px, between 1 and 4', () => {
    expect(lanesForWidth(150)).toBe(1);
    expect(lanesForWidth(152)).toBe(2);
    expect(lanesForWidth(230)).toBe(3);
    expect(lanesForWidth(2000)).toBe(4);
  });

  it('never returns zero, even for a collapsed or unmeasured column', () => {
    expect(lanesForWidth(10)).toBe(1);
    expect(lanesForWidth(0)).toBe(1);
    expect(lanesForWidth(Number.NaN)).toBe(1);
  });
});

function tile(events: Event[], hour = 19): HourTile {
  return { hour, events, classCount: events.filter((e) => e.event_type === 'class').length };
}

describe('tileLabel', () => {
  it('says lessons when every event is a class', () => {
    expect(tileLabel(tile(wave(23)))).toBe('23 lessons');
    expect(tileLabel(tile(wave(1)))).toBe('1 lesson');
  });

  it('says events when types are mixed', () => {
    const mixed = [...wave(2), ev('19:00', '20:00', { event_type: 'webinar', title: 'Webinar' } as Partial<Event>)];
    expect(tileLabel(tile(mixed))).toBe('3 events');
    expect(countLabel([ev('19:00', '19:00', { event_type: 'assignment', title: 'Deadline: HW' } as Partial<Event>)])).toBe('1 event');
  });
});

describe('tile details', () => {
  it('shows one dot per distinct colour, capped, with the remainder counted', () => {
    const many = wave(40);
    const { dots, extra } = tileDots(tile(many), 8);
    expect(dots).toHaveLength(8);
    expect(new Set(dots).size).toBe(8);
    expect(extra).toBeGreaterThan(0);
  });

  it('does not repeat a colour for two lessons of the same group', () => {
    const same = [ev('19:00', '20:00'), ev('19:00', '20:00')].map((e) => ({ ...e, group_ids: [7], groups: ['G7'] }));
    expect(tileDots(tile(same as Event[])).dots).toHaveLength(1);
  });

  it('lists the first names on hover and counts the rest', () => {
    const t = tile(wave(15));
    const lines = tileTooltip(t, 12).split('\n');
    expect(lines).toHaveLength(13);
    expect(lines[12]).toBe('…and 3 more');
    expect(lines[0]).not.toMatch(/Lesson/);
  });
});
