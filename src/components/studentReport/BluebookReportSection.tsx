import type { StudentReport } from '../../services/api';
import { useT } from '@/lib/i18n/react';
import { Section, fmtDate } from './ReportSection';
import '@/lib/i18n/catalogs/studentReport';

/** Bluebook practice tests and the official exam results/planned dates, as the student report shows them. */
export function BluebookReportSection({ bluebook, exams }: { bluebook: StudentReport['bluebook']; exams: StudentReport['exams'] }) {
  const t = useT();
  return (
    <Section title={t('studentReport.section.bluebook')}>
      {bluebook.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">{t('studentReport.bluebook.test')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.date')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.bluebook.total')}</th>
                <th className="py-2 pr-3 font-medium">Verbal</th>
                <th className="py-2 pr-3 font-medium">Math</th>
              </tr>
            </thead>
            <tbody>
              {bluebook.map(b => (
                <tr key={`${b.test_number}-${b.taken_at}`} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-foreground">Practice Test {b.test_number}</td>
                  <td className="py-2 pr-3">{b.taken_at ? fmtDate(b.taken_at) : t('studentReport.bluebook.entry')}</td>
                  <td className="py-2 pr-3 font-medium">{b.total}</td>
                  <td className="py-2 pr-3">{b.verbal}</td>
                  <td className="py-2 pr-3">{b.math}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('studentReport.bluebook.empty')}</p>
      )}
      <div className="text-xs text-muted-foreground space-y-0.5">
        {exams.results.length > 0 ? exams.results.map(r => (
          <p key={`${r.exam_type}-${r.test_date}`}>
            {t('studentReport.exams.official', { exam: r.exam_type.toUpperCase() })} <span className="font-medium text-foreground">{r.total_score}</span> ({fmtDate(r.test_date)}, {r.status})
          </p>
        )) : <p>{t('studentReport.exams.none')}</p>}
        {exams.sat_planned_date && <p>{t('studentReport.exams.plannedDate', { exam: 'SAT' })} <span className="font-medium text-foreground">{fmtDate(exams.sat_planned_date)}</span></p>}
        {exams.ielts_planned_date && <p>{t('studentReport.exams.plannedDate', { exam: 'IELTS' })} <span className="font-medium text-foreground">{fmtDate(exams.ielts_planned_date)}</span></p>}
      </div>
    </Section>
  );
}
