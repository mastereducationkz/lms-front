/**
 * File name for a student's downloaded College Board report: `Bluebook-7_Surname-Name.pdf`.
 *
 * Keeps letters (Cyrillic included) and digits, turns every other run into one dash, so
 * the name is safe on every OS and still tells a teacher who the file belongs to.
 */
export function bluebookReportFilename(testNumber: number | null, studentName: string): string {
  const who = studentName.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'student';
  const test = testNumber != null ? `Bluebook-${testNumber}` : 'Bluebook';
  return `${test}_${who}.pdf`;
}
