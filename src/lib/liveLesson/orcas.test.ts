import { describe, expect, it } from 'vitest';
import { capList, popcheckRight, rightAnswerers, shuffleDelay, shuffleSequence, votersByOption } from './orcas';
import type { NamedAnswer } from './types';

const p = (user_id: number, extra: Partial<NamedAnswer> = {}): NamedAnswer => ({ user_id, name: `S${user_id}`, ...extra });

describe('capList', () => {
  it('keeps everyone when they fit', () => {
    expect(capList([1, 2, 3], 3)).toEqual({ shown: [1, 2, 3], more: 0 });
  });
  it('leaves room for the «+N» pill', () => {
    expect(capList([1, 2, 3, 4, 5], 3)).toEqual({ shown: [1, 2], more: 3 });
  });
});

describe('named reveals', () => {
  it('groups poll voters by option and ignores odd values', () => {
    const voters = votersByOption([p(1, { value: 0 }), p(2, { value: 1 }), p(3, { value: 0 }), p(4, { value: 9 })], 2);
    expect(voters.map((v) => v.map((x) => x.user_id))).toEqual([[1, 3], [2]]);
  });
  it('puts only the right answers on the big screen', () => {
    expect(rightAnswerers([p(1, { correct: true }), p(2, { correct: false }), p(3)]).map((x) => x.user_id)).toEqual([1]);
    const pop = [p(1, { items: { 0: { value: 1, correct: true }, 1: { value: 0, correct: false } } }),
      p(2, { items: { 1: { value: 2, correct: true } } })];
    expect(popcheckRight(pop, 0).map((x) => x.user_id)).toEqual([1]);
    expect(popcheckRight(pop, 1).map((x) => x.user_id)).toEqual([2]);
  });
});

describe('the picker shuffle', () => {
  const seq = () => { let i = 0; return () => ((i += 1) * 0.37) % 1; };
  it('ends on the picked student and never repeats a face twice in a row', () => {
    const s = shuffleSequence([1, 2, 3, 4], 3, 12, seq());
    expect(s).toHaveLength(12);
    expect(s[s.length - 1]).toBe(3);
    s.slice(1).forEach((id, i) => expect(id).not.toBe(s[i]));
  });
  it('goes straight to the pick with nobody else to flash', () => {
    expect(shuffleSequence([5], 5, 10)).toEqual([5]);
    expect(shuffleSequence([], 5, 10)).toEqual([5]);
  });
  it('slows down as it lands', () => {
    expect(shuffleDelay(0, 10)).toBeLessThan(shuffleDelay(9, 10));
  });
});
