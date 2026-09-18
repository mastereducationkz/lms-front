import { describe, expect, it } from 'vitest';

import { mondayOf, shiftWeek, weekLabel } from './parentReportWeek';

describe('mondayOf', () => {
  it('returns the Monday of a midweek day', () => {
    expect(mondayOf(new Date(2026, 8, 18))).toBe('2026-09-14'); // пятница
  });

  it('is idempotent on a Monday', () => {
    expect(mondayOf(new Date(2026, 8, 14))).toBe('2026-09-14');
  });

  it('keeps Sunday in the same week', () => {
    expect(mondayOf(new Date(2026, 8, 20))).toBe('2026-09-14');
  });
});

describe('weekLabel', () => {
  it('renders the range in day.month form', () => {
    expect(weekLabel('2026-09-14')).toBe('14.09 — 20.09');
  });

  it('spans a month boundary', () => {
    expect(weekLabel('2026-09-28')).toBe('28.09 — 04.10');
  });
});

describe('shiftWeek', () => {
  it('steps back a week', () => {
    expect(shiftWeek('2026-09-14', -1)).toBe('2026-09-07');
  });

  it('steps forward across a month boundary', () => {
    expect(shiftWeek('2026-09-28', 1)).toBe('2026-10-05');
  });

  it('steps back across a year boundary', () => {
    expect(shiftWeek('2027-01-04', -1)).toBe('2026-12-28');
  });

  it('returns the same Monday for a zero shift', () => {
    expect(shiftWeek('2026-09-14', 0)).toBe('2026-09-14');
  });
});
