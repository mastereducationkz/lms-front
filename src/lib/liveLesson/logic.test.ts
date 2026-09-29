import { describe, expect, it } from 'vitest';
import { clockOffset, cloudSize, correctIndices, formatSeconds, mineAt, multiReady, optionLabel, percents, timerLeft } from './logic';

describe('live lesson logic', () => {
  it('counts the timer down on the server clock, and holds it while paused', () => {
    const ends = '2026-09-30T10:01:00Z';
    const now = Date.parse('2026-09-30T10:00:00Z');
    expect(timerLeft({ total: 60, ends_at: ends, paused_left: null, activity_id: null }, now)).toBe(60);
    expect(timerLeft({ total: 60, ends_at: ends, paused_left: null, activity_id: null }, now + 90_000)).toBe(0);
    expect(timerLeft({ total: 60, ends_at: null, paused_left: 12.5, activity_id: null }, now)).toBe(12.5);
    expect(timerLeft(null, now)).toBeNull();
  });

  it('never shows 0:00 before the time is up', () => {
    expect(formatSeconds(0.2)).toBe('0:01');
    expect(formatSeconds(65)).toBe('1:05');
    expect(formatSeconds(0)).toBe('0:00');
  });

  it('reads the clock offset from the server', () => {
    expect(clockOffset('2026-09-30T10:00:05Z', Date.parse('2026-09-30T10:00:00Z'))).toBe(5000);
    expect(clockOffset('garbage', 1)).toBe(0);
  });

  it('turns counts into whole percents', () => {
    expect(percents([1, 3])).toEqual([25, 75]);
    expect(percents([0, 0])).toEqual([0, 0]);
  });

  it('reads keys, stored answers and cloud sizes', () => {
    expect(correctIndices(2)).toEqual([2]);
    expect(correctIndices([0, 2])).toEqual([0, 2]);
    expect(correctIndices(['13.5'])).toEqual([]);
    expect(mineAt<{ value: number }>({ '1': { value: 3 } }, 1)).toEqual({ value: 3 });
    expect(mineAt({}, 0)).toBeUndefined();
    expect(cloudSize(1, 1)).toBe(1.25);
    expect(cloudSize(5, 5)).toBe(2.75);
    expect(multiReady([0, 2], 2)).toBe(true);
    expect(multiReady([0], 2)).toBe(false);
  });

  it('never says a preset letter twice', () => {
    expect(optionLabel(2, 'C')).toBe('C');
    expect(optionLabel(1, 'Dog')).toBe('B · Dog');
  });
});
