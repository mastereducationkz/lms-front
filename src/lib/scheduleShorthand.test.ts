import { describe, expect, it } from 'vitest';
import {
  configFromScheduleSlots,
  normalizeScheduleTime,
  parseScheduleShorthand,
  scheduleSlotsFromConfig,
} from './scheduleShorthand';

// Ported from crm-master frontend/tests/scheduleShorthand.test.mjs (2026-09-16).
const d = (time: string, duration: number) => ({ time, duration });

describe('parseScheduleShorthand', () => {
  it("parses Rauan's schedule in one line", () => {
    const { config, problems } = parseScheduleShorthand('пн пт 18:00-19:00 сб вс 19:00-20:30');
    expect(config).toEqual({ 0: d('18:00', 60), 4: d('18:00', 60), 5: d('19:00', 90), 6: d('19:00', 90) });
    expect(problems).toEqual([]);
  });

  it('reads the way a person types it: 18-19, 19-20.5, en dash, comma', () => {
    expect(parseScheduleShorthand('пн, пт 18-19; сб вс 19–20,5').config).toEqual({
      0: d('18:00', 60),
      4: d('18:00', 60),
      5: d('19:00', 90),
      6: d('19:00', 90),
    });
    expect(parseScheduleShorthand('сб 19-20.5').config).toEqual({ 5: d('19:00', 90) });
  });

  it("keeps the old forms working, and a bare time keeps the day's current length", () => {
    expect(parseScheduleShorthand('вт чт 20 00 сб 12 00').config).toEqual({
      1: d('20:00', 60),
      3: d('20:00', 60),
      5: d('12:00', 60),
    });
    expect(parseScheduleShorthand('сб 19:00', { 5: d('18:00', 90) }).config).toEqual({ 5: d('19:00', 90) });
    expect(parseScheduleShorthand('mon wed 19:00').config).toEqual({ 0: d('19:00', 60), 2: d('19:00', 60) });
  });

  it('measures a range crossing midnight forward', () => {
    expect(parseScheduleShorthand('пт 23:30-00:30').config).toEqual({ 4: d('23:30', 60) });
  });

  it('never applies anything silently to the wrong day', () => {
    // The old tokenizer turned «18:00-19:00» into garbage and gave Monday Wednesday's time.
    const { config } = parseScheduleShorthand('пн 18:00-19:00 ср 19:00');
    expect(config).toEqual({ 0: d('18:00', 60), 2: d('19:00', 60) });
  });

  it('reports what it cannot read instead of ignoring it', () => {
    expect(parseScheduleShorthand('пн 18:00 хз').problems.some((p) => p.includes('хз'))).toBe(true);
    expect(parseScheduleShorthand('пн 18:00 ср').problems.some((p) => p.includes('ср'))).toBe(true);
    expect(parseScheduleShorthand('пн 18:00-18:05').problems.length).toBeGreaterThan(0); // 5 min is not a lesson
  });

  it('reports an orphaned range with no day before it, instead of dropping it', () => {
    const { config, problems } = parseScheduleShorthand('пн 18:00 19:00-20:00');
    expect(config).toEqual({ 0: d('18:00', 60) });
    expect(problems.some((p) => p.includes('19:00-20:00'))).toBe(true);
  });

  it('reports an orphaned bare time with no day before it too', () => {
    const { config, problems } = parseScheduleShorthand('19:00 пн 18:00');
    expect(config).toEqual({ 0: d('18:00', 60) });
    expect(problems.some((p) => p.includes('19:00'))).toBe(true);
  });

  it('ruling D2: a plain comma between two times is two tokens, not a decimal', () => {
    const { config, problems } = parseScheduleShorthand('пн 18:00,19:00');
    expect(config).toEqual({ 0: d('18:00', 60) });
    expect(problems.some((p) => p.includes('19:00'))).toBe(true);
  });

  it('ruling D2: a half-hour decimal comma still means 20:30', () => {
    expect(parseScheduleShorthand('сб вс 19–20,5').config).toEqual({ 5: d('19:00', 90), 6: d('19:00', 90) });
  });
});

describe('normalizeScheduleTime', () => {
  it('pads and clamps an HH:MM string', () => {
    expect(normalizeScheduleTime('9:5')).toBe('9:5'); // not HH:MM shaped, left as-is
    expect(normalizeScheduleTime('09:05')).toBe('09:05');
    expect(normalizeScheduleTime('23:59')).toBe('23:59');
  });
});

describe('configFromScheduleSlots / scheduleSlotsFromConfig', () => {
  it("carry each day's length both ways", () => {
    const config = configFromScheduleSlots([
      { day_of_week: 5, time_of_day: '19:00', duration_minutes: 90 },
      { day_of_week: 0, time_of_day: '18:00' },
    ]);
    expect(config).toEqual({ 0: d('18:00', 60), 5: d('19:00', 90) });
    expect(scheduleSlotsFromConfig(config)).toEqual([
      { day_of_week: 0, time_of_day: '18:00', duration_minutes: 60 },
      { day_of_week: 5, time_of_day: '19:00', duration_minutes: 90 },
    ]);
  });
});
