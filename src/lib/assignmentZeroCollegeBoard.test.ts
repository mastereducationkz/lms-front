import { describe, it, expect } from 'vitest';
import { isCollegeBoardPasswordRequired } from './assignmentZeroCollegeBoard';

describe('isCollegeBoardPasswordRequired', () => {
  it('is required for SAT students who have not saved a password yet', () => {
    expect(isCollegeBoardPasswordRequired(true, false)).toBe(true);
  });

  it('is not required once a password is already stored server-side', () => {
    expect(isCollegeBoardPasswordRequired(true, true)).toBe(false);
  });

  it('is never required outside the SAT track, saved or not', () => {
    expect(isCollegeBoardPasswordRequired(false, false)).toBe(false);
    expect(isCollegeBoardPasswordRequired(false, true)).toBe(false);
  });
});
