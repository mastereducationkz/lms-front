import { describe, expect, it } from 'vitest';
import { isValidDate, parseTimeInput, withTime } from './timeInput';

describe('parseTimeInput', () => {
  it.each([
    ['09:30', { hours: 9, minutes: 30 }],
    ['9:05', { hours: 9, minutes: 5 }],
    ['00:00', { hours: 0, minutes: 0 }],
    ['23:59', { hours: 23, minutes: 59 }],
  ])('reads %s', (value, expected) => {
    expect(parseTimeInput(value)).toEqual(expected);
  });

  it.each(['', '9:', ':30', '25:00', '12:60', '12', 'ab:cd', ' 09:30', null, undefined])(
    'is not a time: %j (a cleared or half-typed box)',
    (value) => {
      expect(parseTimeInput(value as string | null | undefined)).toBeNull();
    },
  );
});

describe('withTime', () => {
  const day = new Date(2026, 9, 12, 0, 0, 0);

  it('puts the typed time on a copy of the day', () => {
    const next = withTime(day, '14:45');
    expect(next).not.toBe(day);
    expect([next?.getFullYear(), next?.getMonth(), next?.getDate(), next?.getHours(), next?.getMinutes()]).toEqual([2026, 9, 12, 14, 45]);
    expect(day.getHours()).toBe(0);
  });

  it('gives nothing for a cleared or half-typed time, so no Invalid Date is ever produced', () => {
    expect(withTime(day, '')).toBeNull();
    expect(withTime(day, '14:')).toBeNull();
  });

  it('gives nothing when the day itself is not a date', () => {
    expect(withTime(new Date('not a date'), '10:00')).toBeNull();
  });
});

describe('isValidDate', () => {
  it('tells an Invalid Date from a date and from other things', () => {
    expect(isValidDate(new Date())).toBe(true);
    expect(isValidDate(new Date('nope'))).toBe(false);
    expect(isValidDate('2026-10-12')).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });

  it('is the check that keeps toISOString from throwing', () => {
    const bad = new Date('nope');
    expect(() => bad.toISOString()).toThrow(RangeError);
    expect(isValidDate(bad) ? bad.toISOString() : '').toBe('');
  });
});
