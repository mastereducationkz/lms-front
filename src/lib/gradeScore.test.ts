import { describe, expect, it } from 'vitest';
import { formatScore, gradeProblem, gradeProblemKey, parseGradeInput, sanitizeGradeTyping, stepGrade } from './gradeScore';

describe('formatScore', () => {
  it('writes a whole grade without a decimal and keeps a half', () => {
    expect(formatScore(8)).toBe('8');
    expect(formatScore(8.0)).toBe('8');
    expect(formatScore(7.5)).toBe('7.5');
    expect(formatScore(0)).toBe('0');
    expect(formatScore(7.5 + 7.5)).toBe('15');
  });

  it('is empty for no grade', () => {
    expect(formatScore(null)).toBe('');
    expect(formatScore(undefined)).toBe('');
    expect(formatScore(Number.NaN)).toBe('');
  });
});

describe('parseGradeInput', () => {
  it('reads a dot and a comma alike', () => {
    expect(parseGradeInput('7.5')).toBe(7.5);
    expect(parseGradeInput('7,5')).toBe(7.5);
    expect(parseGradeInput(' 8 ')).toBe(8);
    expect(parseGradeInput('7,')).toBe(7);
    expect(parseGradeInput(',5')).toBe(0.5);
    expect(parseGradeInput(9)).toBe(9);
  });

  it('refuses what is not a plain non-negative number', () => {
    for (const raw of ['', 'abc', '7.5.1', '-1', '1e3', '7 5', null, undefined]) {
      expect(parseGradeInput(raw as string)).toBeNull();
    }
  });
});

describe('sanitizeGradeTyping', () => {
  it('keeps digits and the first separator only', () => {
    expect(sanitizeGradeTyping('7,5')).toBe('7,5');
    expect(sanitizeGradeTyping('7.')).toBe('7.');
    expect(sanitizeGradeTyping('7.5.5')).toBe('7.55');
    expect(sanitizeGradeTyping('7a')).toBe('7');
    expect(sanitizeGradeTyping('-3')).toBe('3');
  });
});

describe('gradeProblem', () => {
  it('accepts whole and half points within 0..max on any maximum', () => {
    for (const [raw, max] of [['7.5', 9], ['7,5', 9], ['8', 9], ['0', 10], ['99.5', 100], ['9', 9], [7.5, 10]] as const) {
      expect(gradeProblem(raw, max)).toBeNull();
    }
  });

  it('refuses quarters and other fractions', () => {
    expect(gradeProblem('7.25', 10)).toBe('halfStep');
    expect(gradeProblem('7,55', 10)).toBe('halfStep');
    expect(gradeProblem('7.1', 10)).toBe('halfStep');
  });

  it('refuses a grade above the maximum, an empty field and junk', () => {
    expect(gradeProblem('9.5', 9)).toBe('range');
    expect(gradeProblem('', 9)).toBe('empty');
    expect(gradeProblem('  ', 9)).toBe('empty');
    expect(gradeProblem('abc', 9)).toBe('notNumber');
  });

  it('names a message for every problem', () => {
    expect(gradeProblemKey('halfStep')).toBe('homeworkStaff.grade.halfStep');
    expect(gradeProblemKey('notNumber')).toBe('homeworkStaff.grade.halfStep');
    expect(gradeProblemKey('range')).toBe('homeworkStaff.grade.outOfRange');
    expect(gradeProblemKey('empty')).toBe('homeworkStaff.grade.enterScore');
  });
});

describe('stepGrade', () => {
  it('moves by half a point within 0..max', () => {
    expect(stepGrade('7', 9, 0.5)).toBe(7.5);
    expect(stepGrade('7,5', 9, -0.5)).toBe(7);
    expect(stepGrade('9', 9, 0.5)).toBe(9);
    expect(stepGrade('', 9, -0.5)).toBe(0);
    expect(stepGrade('7.3', 9, 0.5)).toBe(8); // snaps to the grid first
  });
});
