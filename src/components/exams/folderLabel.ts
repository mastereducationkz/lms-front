import type { ExamFolder } from '../../services/api/examFolders';

/** «7 нояб. 2026» from an ISO date. Pinned to UTC so a civil date never slides a day with the viewer's zone. */
export function formatSittingDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

/** «SAT · 7 нояб. 2026» - one folder per sitting. */
export function folderName(f: Pick<ExamFolder, 'exam_type' | 'test_date'>, locale: string): string {
  const date = formatSittingDate(f.test_date, locale);
  return date ? `${f.exam_type.toUpperCase()} · ${date}` : f.exam_type.toUpperCase();
}

/** The filter slice a folder key ("sat:2026-11-07") stands for; «all» has neither exam type nor date. */
export function scopeOfKey(key: string): { examType?: 'sat' | 'ielts' | 'nuet'; testDate?: string } {
  const [exam, date] = key.split(':');
  if (!date || (exam !== 'sat' && exam !== 'ielts' && exam !== 'nuet')) return {};
  return { examType: exam, testDate: date };
}
