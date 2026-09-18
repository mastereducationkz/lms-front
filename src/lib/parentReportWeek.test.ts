import { describe, expect, it } from 'vitest';

import { mondayOf, weekLabel } from './parentReportWeek';

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
