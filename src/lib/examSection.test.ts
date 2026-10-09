import { describe, expect, it } from 'vitest';
import { NUET_SECTION_MAX, examSectionParts } from './examSection';

// The owner wants correct / total first and the NUET score out of 120 as the second figure.
describe('examSectionParts', () => {
  it('leads with correct / total and keeps the scaled score as the second figure (NUET)', () => {
    expect(examSectionParts({ correct: 17, total: 22, scaled: 84 })).toEqual({ primary: '17/22', secondary: `84/${NUET_SECTION_MAX}` });
  });

  it('shows only correct / total for SAT, which has no scaled score here', () => {
    expect(examSectionParts({ correct: 15, total: 22 })).toEqual({ primary: '15/22', secondary: null });
    expect(examSectionParts({ correct: 15, total: 22, scaled: null })).toEqual({ primary: '15/22', secondary: null });
  });

  it('shows the scaled score alone until the platform sends counts (no total)', () => {
    // The server puts the scaled score in `correct` and leaves `total` empty in that case.
    expect(examSectionParts({ correct: 84, total: null, scaled: 84 })).toEqual({ primary: '84', secondary: null });
    expect(examSectionParts({ correct: 84, total: 0, scaled: 84 })).toEqual({ primary: '84', secondary: null });
  });

  it('keeps a zero score a score', () => {
    expect(examSectionParts({ correct: 0, total: 22, scaled: 0 })).toEqual({ primary: '0/22', secondary: `0/${NUET_SECTION_MAX}` });
  });

  it('has nothing to show for a section that was not taken', () => {
    expect(examSectionParts({ correct: null, total: null })).toEqual({ primary: null, secondary: null });
    expect(examSectionParts({ correct: undefined })).toEqual({ primary: null, secondary: null });
  });
});
