import { describe, expect, it } from 'vitest';
import { answersMatch } from './answerMatch';

describe('answersMatch', () => {
  it('accepts the answer exactly as stored', () => {
    expect(answersMatch('13.5', '13.5')).toBe(true);
  });

  it('accepts a comma decimal', () => {
    // Report 577 and 1811: the key is 13.5, the student typed 13,5 and was marked wrong.
    // Kazakh and Russian write decimals with a comma; the question never said which to use.
    expect(answersMatch('13.5', '13,5')).toBe(true);
    expect(answersMatch('0.8', '0,8')).toBe(true);
  });

  it('accepts an equivalent fraction', () => {
    // "I don't know how to write the answer: 5/2 or 2.5" — report 546. Both are the number.
    expect(answersMatch('2.5', '5/2')).toBe(true);
    expect(answersMatch('0.75', '3/4')).toBe(true);
    expect(answersMatch('3/4', '0,75')).toBe(true);
  });

  it('ignores padding and a leading plus', () => {
    expect(answersMatch('7', '  7  ')).toBe(true);
    expect(answersMatch('7', '+7')).toBe(true);
    expect(answersMatch('2.50', '2.5')).toBe(true);
  });

  it('still refuses a genuinely wrong number', () => {
    expect(answersMatch('13.5', '13')).toBe(false);
    expect(answersMatch('2.5', '5')).toBe(false);
    expect(answersMatch('0.8', '8')).toBe(false);
  });

  it('compares words as words, case-insensitively', () => {
    expect(answersMatch('Paris', 'paris ')).toBe(true);
    expect(answersMatch('Paris', 'London')).toBe(false);
  });

  it('does not treat a comma inside a written number as a decimal point', () => {
    // "1,000" is a thousand to a student writing English, not one. Refusing to guess is
    // safer than silently marking a wrong answer right.
    expect(answersMatch('1000', '1,000')).toBe(true);
    expect(answersMatch('1', '1,000')).toBe(false);
  });

  it('is not fooled by an empty answer', () => {
    expect(answersMatch('5', '')).toBe(false);
    expect(answersMatch('', '5')).toBe(false);
    expect(answersMatch('', '')).toBe(false);
  });

  it('handles a negative and a unicode minus', () => {
    expect(answersMatch('-3', '−3')).toBe(true);
    expect(answersMatch('-3', '3')).toBe(false);
  });
});
