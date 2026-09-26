import { describe, it, expect } from 'vitest';
import { collegeBoardPasswordDisplay, isCollegeBoardPasswordRequired } from './assignmentZeroCollegeBoard';

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

describe('collegeBoardPasswordDisplay', () => {
  it('is "none" whenever no password is stored, regardless of canReveal', () => {
    expect(collegeBoardPasswordDisplay(false, true, true)).toBe('none');
    expect(collegeBoardPasswordDisplay(false, false, true)).toBe('none');
    expect(collegeBoardPasswordDisplay(false, undefined, true)).toBe('none');
  });

  it('is "revealable" when a password is stored and this viewer can reveal it', () => {
    expect(collegeBoardPasswordDisplay(true, true, false)).toBe('revealable');
  });

  it('is "hidden_no_access" when a password is stored but this viewer cannot reveal it', () => {
    expect(collegeBoardPasswordDisplay(true, false, true)).toBe('hidden_no_access');
  });

  it('falls back to defaultCanReveal when the server omits the flag (older backend)', () => {
    expect(collegeBoardPasswordDisplay(true, undefined, true)).toBe('revealable');
    expect(collegeBoardPasswordDisplay(true, undefined, false)).toBe('hidden_no_access');
  });
});
