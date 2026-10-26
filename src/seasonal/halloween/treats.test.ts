import { describe, expect, it } from 'vitest';
import { HUNT_HINT, TREAT_COUNT, nextTreat } from './treats';

describe('nextTreat', () => {
  it('opens with the hunt hint the first time', () => {
    expect(nextTreat(null, () => 0.99)).toBe(HUNT_HINT);
  });

  it('never repeats the treat just shown', () => {
    for (let previous = 1; previous <= TREAT_COUNT; previous += 1) {
      for (const roll of [0, 0.2, 0.5, 0.8, 0.999]) {
        const next = nextTreat(previous, () => roll);
        expect(next).not.toBe(previous);
        expect(next).toBeGreaterThanOrEqual(1);
        expect(next).toBeLessThanOrEqual(TREAT_COUNT);
      }
    }
  });
});
