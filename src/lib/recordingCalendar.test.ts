import { describe, expect, it } from 'vitest';
import { monthTitle, monthWeeks, shiftMonth, thisMonth, weekdayNames } from './recordingCalendar';
import { shortDate } from './recordings';

describe('the Recordings date picker', () => {
  it('lays a month out in whole weeks, Monday first', () => {
    const weeks = monthWeeks('2026-09'); // 1 September 2026 is a Tuesday
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ key: '2026-08-31', day: 31, inMonth: false });
    expect(weeks[0][1]).toEqual({ key: '2026-09-01', day: 1, inMonth: true });
    expect(weeks[4][6]).toEqual({ key: '2026-10-04', day: 4, inMonth: false });
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(30);
    expect(weekdayNames()[0]).toBe('Mo');
  });

  it('needs only four weeks for a February that starts on a Monday', () => {
    const weeks = monthWeeks('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true);
  });

  it('turns months across the year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', 0)).toBe('2026-09');
  });

  it('knows which month it is in Almaty, not in UTC', () => {
    expect(thisMonth(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10'); // 01:00 on 1 October in Almaty
    expect(thisMonth(new Date('2026-09-30T18:59:00Z'))).toBe('2026-09');
  });

  it('names months and days in the reader’s language', () => {
    expect(monthTitle('2026-09')).toBe('September 2026');
    expect(monthTitle('2026-09', 'ru')).toBe('Сентябрь 2026');
    const now = new Date('2026-09-11T14:00:00Z');
    expect(shortDate('2026-09-11', now)).toBe('Fri, 11 Sep');
    expect(shortDate('2026-09-11', now, 'ru')).toBe('пт, 11 сентября');
    expect(shortDate('2025-08-14', now)).toBe('Thu, 14 Aug 2025');
  });
});
