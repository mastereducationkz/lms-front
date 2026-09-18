import { describe, expect, it } from 'vitest';

import {
  RULE_START,
  cellText,
  cellTitle,
  cellTone,
  money,
  periodLabel,
  showsProgramTabs,
  type DisciplineCell,
} from './discipline';

const cell = (over: Partial<DisciplineCell> = {}): DisciplineCell => ({
  late_minutes: 0, early_minutes: 0, misses: 0, fine: 0, unpriced: 0,
  lessons: 0, measured: 0, unmeasurable: 0, decided: 0, state: 'none', ...over,
});

describe('the grid cell', () => {
  it('shows the minutes when a teacher was late', () => {
    expect(cellText(cell({ late_minutes: 3, fine: 900, lessons: 1, state: 'late' }))).toBe('3′');
    expect(cellTone(cell({ late_minutes: 3, state: 'late' }))).toBe('late');
  });

  it('shows a cross for a lesson never taught', () => {
    expect(cellText(cell({ misses: 1, lessons: 1, state: 'miss' }))).toBe('✗');
    expect(cellTone(cell({ misses: 1, state: 'miss' }))).toBe('miss');
  });

  it('shows minutes cut short with a minus', () => {
    expect(cellText(cell({ early_minutes: 4, fine: 1200, lessons: 1, state: 'ended_early' }))).toBe('−4′');
  });

  it('says nothing for a clean day and nothing for a day with no lessons', () => {
    expect(cellText(cell({ lessons: 2, measured: 2, state: 'clear' }))).toBe('');
    expect(cellText(cell())).toBe('');
    expect(cellTone(cell())).toBe('none');
  });

  it('marks a day it could not watch, which is not the same as a clean day', () => {
    const unwatched = cell({ lessons: 1, unmeasurable: 1, state: 'unmeasurable' });
    expect(cellText(unwatched)).toBe('·');
    expect(cellTone(unwatched)).toBe('unmeasurable');
  });

  it('keeps both numbers when a day was late and short', () => {
    expect(cellText(cell({ late_minutes: 2, early_minutes: 10, fine: 3600, lessons: 1, state: 'late' })))
      .toBe('2′ / −10′');
  });

  it('explains itself on hover', () => {
    expect(cellTitle(cell({ late_minutes: 3, fine: 900, lessons: 1, state: 'late' })))
      .toBe('1 lesson · 3 min late · 900 ₸');
    expect(cellTitle(cell({ misses: 1, lessons: 1, unpriced: 1, state: 'miss' })))
      .toBe('1 lesson · 1 missed · not priced yet');
    expect(cellTitle(cell({ lessons: 2, unmeasurable: 2, state: 'unmeasurable' })))
      .toBe('2 lessons · no Meet room, nothing to judge');
  });
});

describe('money and labels', () => {
  it('writes tenge the way the office does', () => {
    expect(money(13200)).toBe('13 200 ₸');
    expect(money(900)).toBe('900 ₸');
    expect(money(0)).toBe('—');
  });

  it('labels a half-month', () => {
    expect(periodLabel('2026-09-16', '2026-09-30')).toBe('16–30 September 2026');
    expect(periodLabel('2026-10-01', '2026-10-15')).toBe('1–15 October 2026');
  });

  it('knows the day the rule started', () => {
    expect(RULE_START).toBe('2026-09-16');
  });
});

describe('the programme filter', () => {
  it('keeps every tab after one is chosen, so there is a way back to All', () => {
    expect(showsProgramTabs(['IELTS', 'SAT'], 'SAT')).toBe(true);
    expect(showsProgramTabs(['IELTS', 'SAT'], '')).toBe(true);
  });

  it('shows nothing to filter when the period holds one programme', () => {
    expect(showsProgramTabs(['SAT'], '')).toBe(false);
  });

  it('still shows the way back if a filter is on and the list came back short', () => {
    expect(showsProgramTabs(['SAT'], 'SAT')).toBe(true);
    expect(showsProgramTabs([], 'SAT')).toBe(true);
  });

  it('hides the row for an empty period', () => {
    expect(showsProgramTabs([], '')).toBe(false);
    expect(showsProgramTabs(undefined, '')).toBe(false);
  });
});

describe('minutes that were worked off', () => {
  it('colours a fully made-up day apart from a plain late one', () => {
    const worked = cell({ late_minutes: 3, made_up_minutes: 3, fine: 600, lessons: 1, state: 'late' });
    expect(cellTone(worked)).toBe('made_up');
    expect(cellText(worked)).toBe('3\u2032\u21a9');
    expect(cellTitle(worked)).toContain('made up in full');
  });

  it('still reads as late when only some of the minutes came back', () => {
    const partial = cell({ late_minutes: 5, made_up_minutes: 2, fine: 1000, lessons: 1, state: 'late' });
    expect(cellTone(partial)).toBe('late');
    expect(cellText(partial)).toBe('5\u2032\u21a9');
    expect(cellTitle(partial)).toContain('(2 made up)');
  });

  it('does not let made-up minutes soften a day that also ended early', () => {
    const both = cell({ late_minutes: 3, made_up_minutes: 3, early_minutes: 2, lessons: 1 });
    expect(cellTone(both)).toBe('late');
  });

  it('is unchanged for a register that does not send the field yet', () => {
    expect(cellTone(cell({ late_minutes: 3, state: 'late' }))).toBe('late');
    expect(cellText(cell({ late_minutes: 3, state: 'late' }))).toBe('3\u2032');
  });
});
