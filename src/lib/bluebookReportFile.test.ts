import { describe, expect, it } from 'vitest';
import { bluebookReportFilename } from './bluebookReportFile';

describe('bluebookReportFilename', () => {
  it('names the file after the test and the student, keeping Cyrillic', () => {
    expect(bluebookReportFilename(7, 'Иванов Иван')).toBe('Bluebook-7_Иванов-Иван.pdf');
  });

  it('strips path and punctuation characters', () => {
    expect(bluebookReportFilename(8, ' ../Ann O\'Neil / "x" ')).toBe('Bluebook-8_Ann-O-Neil-x.pdf');
  });

  it('falls back when the name or the test number is missing', () => {
    expect(bluebookReportFilename(null, '  ')).toBe('Bluebook_student.pdf');
  });
});
