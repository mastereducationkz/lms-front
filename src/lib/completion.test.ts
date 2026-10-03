import { describe, expect, it } from 'vitest';
import { checkpointLabel, lessonsLabel, meanPct } from './completion';

describe('meanPct', () => {
  it('floors like the backend average, 0 for an empty roster', () => {
    expect(meanPct([100, 50])).toBe(75);
    expect(meanPct([100, 99, 99])).toBe(99);
    expect(meanPct([])).toBe(0);
  });
});

describe('lessonsLabel', () => {
  it('uses the genitive after «из N»', () => {
    expect(lessonsLabel(12, 30)).toBe('12 из 30 уроков');
    expect(lessonsLabel(0, 1)).toBe('0 из 1 урока');
    expect(lessonsLabel(5, 21)).toBe('5 из 21 урока');
    expect(lessonsLabel(5, 11)).toBe('5 из 11 уроков');
    expect(lessonsLabel(1, 2)).toBe('1 из 2 уроков');
  });

  it('is empty for a course with no counted lessons and clamps bad input', () => {
    expect(lessonsLabel(0, 0)).toBe('');
    expect(lessonsLabel(undefined, undefined)).toBe('');
    expect(lessonsLabel(9, 3)).toBe('3 из 3 уроков');
  });
});

describe('checkpointLabel', () => {
  it('shows taken of opened and the average', () => {
    expect(checkpointLabel({ opened: 4, taken: 3, average: 72 })).toBe('Чекпоинты: 3 из 4 · средний балл 72%');
  });

  it('drops the average when nothing was taken, and hides when nothing was opened', () => {
    expect(checkpointLabel({ opened: 1, taken: 0, average: null })).toBe('Чекпоинты: 0 из 1');
    expect(checkpointLabel({ opened: 0, taken: 0, average: null })).toBe('');
    expect(checkpointLabel(null)).toBe('');
  });
});
