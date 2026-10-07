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
  it('reads "N of M lessons" in English', () => {
    expect(lessonsLabel(12, 30, 'en')).toBe('12 of 30 lessons');
    expect(lessonsLabel(0, 1, 'en')).toBe('0 of 1 lesson');
  });

  it('uses the genitive after «из N» in Russian', () => {
    expect(lessonsLabel(12, 30, 'ru')).toBe('12 из 30 уроков');
    expect(lessonsLabel(0, 1, 'ru')).toBe('0 из 1 урока');
    expect(lessonsLabel(5, 21, 'ru')).toBe('5 из 21 урока');
    expect(lessonsLabel(5, 11, 'ru')).toBe('5 из 11 уроков');
    expect(lessonsLabel(1, 2, 'ru')).toBe('1 из 2 уроков');
  });

  it('is empty for a course with no counted lessons and clamps bad input', () => {
    expect(lessonsLabel(0, 0, 'en')).toBe('');
    expect(lessonsLabel(undefined, undefined, 'ru')).toBe('');
    expect(lessonsLabel(9, 3, 'ru')).toBe('3 из 3 уроков');
    expect(lessonsLabel(9, 3, 'en')).toBe('3 of 3 lessons');
  });
});

describe('checkpointLabel', () => {
  it('shows taken of opened and the average', () => {
    expect(checkpointLabel({ opened: 4, taken: 3, average: 72 }, 'en')).toBe('Checkpoints: 3 of 4 · average 72%');
    expect(checkpointLabel({ opened: 4, taken: 3, average: 72 }, 'ru')).toBe('Чекпоинты: 3 из 4 · средний балл 72%');
  });

  it('drops the average when nothing was taken, and hides when nothing was opened', () => {
    expect(checkpointLabel({ opened: 1, taken: 0, average: null }, 'ru')).toBe('Чекпоинты: 0 из 1');
    expect(checkpointLabel({ opened: 1, taken: 0, average: null }, 'en')).toBe('Checkpoints: 0 of 1');
    expect(checkpointLabel({ opened: 0, taken: 0, average: null })).toBe('');
    expect(checkpointLabel(null)).toBe('');
  });
});
