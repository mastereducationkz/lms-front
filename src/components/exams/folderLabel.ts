import type { ExamFolder } from '../../services/api/examFolders';
import { DATE, formatDate } from '../../lib/i18n/format';
import type { Locale } from '../../lib/i18n/locale';

/** «7 нояб. 2026 г.» from an ISO date (a civil date: it never slides a day with the viewer's zone). */
export function formatSittingDate(iso: string | null, locale: Locale): string {
  return iso ? formatDate(iso, DATE, locale) : '';
}

/** «SAT · 7 нояб. 2026» - one folder per sitting. */
export function folderName(f: Pick<ExamFolder, 'exam_type' | 'test_date'>, locale: Locale): string {
  const date = formatSittingDate(f.test_date, locale);
  return date ? `${f.exam_type.toUpperCase()} · ${date}` : f.exam_type.toUpperCase();
}

/** The filter slice a folder key ("sat:2026-11-07") stands for; «all» has neither exam type nor date. */
export function scopeOfKey(key: string): { examType?: 'sat' | 'ielts' | 'nuet'; testDate?: string } {
  const [exam, date] = key.split(':');
  if (!date || (exam !== 'sat' && exam !== 'ielts' && exam !== 'nuet')) return {};
  return { examType: exam, testDate: date };
}
