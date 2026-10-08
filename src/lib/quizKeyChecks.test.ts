import { describe, expect, it } from 'vitest';
import { acceptedFormsPreview, flagsDisagreeWithKey, truncatedDecimalKeys, withFlagsFromKey } from './quizKeyChecks';

const choice = (flags: boolean[], key: unknown, type = 'single_choice') => ({
  question_type: type,
  options: flags.map((is_correct, i) => ({ id: String(i), text: `o${i}`, is_correct })),
  correct_answer: key,
});

// 88 of 2 912 production choice questions had a key and a flagged option that disagree (or none):
// the editor never kept the flags in step with the key it saves.
describe('flagsDisagreeWithKey', () => {
  it('is true when the flagged option is not the one the key points at', () => {
    expect(flagsDisagreeWithKey(choice([false, true, false], 2))).toBe(true);
    expect(flagsDisagreeWithKey(choice([true, true, false], 0))).toBe(true);
  });

  it('is false when they agree', () => {
    expect(flagsDisagreeWithKey(choice([false, false, true], 2))).toBe(false);
    expect(flagsDisagreeWithKey(choice([true, false, true], [0, 2], 'multiple_choice'))).toBe(false);
  });

  it('is false for a question the editor created, which never sets a flag', () => {
    expect(flagsDisagreeWithKey(choice([false, false, false], 1))).toBe(false);
  });

  it('is false for question types without options', () => {
    expect(flagsDisagreeWithKey({ question_type: 'short_answer', correct_answer: '5' })).toBe(false);
    expect(flagsDisagreeWithKey({ question_type: 'single_choice', correct_answer: 1 })).toBe(false);
  });
});

describe('withFlagsFromKey', () => {
  it('flags exactly the option the key points at', () => {
    const fixed = withFlagsFromKey(choice([true, false, false], 2));
    expect(fixed.options!.map((o) => o.is_correct)).toEqual([false, false, true]);
    expect(flagsDisagreeWithKey(fixed)).toBe(false);
  });

  it('flags every option of a multiple-choice key', () => {
    expect(withFlagsFromKey(choice([false, false, false, false], [1, 3], 'multiple_choice')).options!.map((o) => o.is_correct))
      .toEqual([false, true, false, true]);
  });

  it('leaves other questions and a missing key alone', () => {
    const typed = { question_type: 'short_answer', correct_answer: '5' };
    expect(withFlagsFromKey(typed)).toBe(typed);
    expect(withFlagsFromKey(choice([true, false], undefined)).options!.map((o) => o.is_correct)).toEqual([true, false]);
  });
});

describe('truncatedDecimalKeys', () => {
  it('finds a repeating decimal cut off, the form students then round', () => {
    expect(truncatedDecimalKeys('14:3|14/3|4.666')).toEqual(['4.666']);
    expect(truncatedDecimalKeys('0.333')).toEqual(['0.333']);
    expect(truncatedDecimalKeys('.3833|0.3833')).toEqual([]);
  });

  it('does not flag ordinary keys', () => {
    expect(truncatedDecimalKeys('16.5|33/2')).toEqual([]);
    expect(truncatedDecimalKeys('0.0625|1/16')).toEqual([]);
    expect(truncatedDecimalKeys('2.000')).toEqual([]);
    expect(truncatedDecimalKeys('')).toEqual([]);
  });
});

describe('acceptedFormsPreview', () => {
  it('lists the other ways the grader will take the answer', () => {
    expect(acceptedFormsPreview('16.5|33/2')).toEqual(['16,5']);
    expect(acceptedFormsPreview('0.5')).toEqual(['.5', '0,5']);
    expect(acceptedFormsPreview('40260')).toEqual(['40,260', '40 260', '40.260']);
  });

  it('shows nothing for words and for an empty key', () => {
    expect(acceptedFormsPreview('Paris')).toEqual([]);
    expect(acceptedFormsPreview('')).toEqual([]);
  });

  it('only ever lists forms the grader really accepts', async () => {
    const { matchesAnyAnswer } = await import('../components/lesson/quiz/answerMatch');
    for (const key of ['16.5|33/2', '0.5', '40260', '7', '-0.25', '1234567', '2.50']) {
      for (const form of acceptedFormsPreview(key)) expect(matchesAnyAnswer(key, form)).toBe(true);
    }
  });
});
