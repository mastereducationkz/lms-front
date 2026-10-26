import type { ReportPlatformPractice } from '../../services/api';
import { useT } from '@/lib/i18n/react';
import { Section, fmtDate } from './ReportSection';
import '@/lib/i18n/catalogs/pastPapers';
import '@/lib/i18n/catalogs/studentReport';

/**
 * SAT practice papers set as homework, separate from the Bluebook block: the scaled score is the
 * platform's ESTIMATE and is labelled as one; a partial paper has only correct/total. Nothing is ranked.
 */
export function PlatformPracticeSection({ items }: { items: ReportPlatformPractice[] }) {
  const t = useT();
  if (items.length === 0) return null;
  const counts = (s: ReportPlatformPractice['rw']) => (s ? `${s.correct}/${s.total}` : '—');
  return (
    <Section title={t('pastPapers.report.section')} subtitle={t('pastPapers.report.note')}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 font-medium">{t('pastPapers.report.paper')}</th>
              <th className="py-2 pr-3 font-medium">{t('studentReport.date')}</th>
              <th className="py-2 pr-3 font-medium">{t('pastPapers.report.score')}</th>
              <th className="py-2 pr-3 font-medium">{t('pastPapers.report.rw')}</th>
              <th className="py-2 pr-3 font-medium">{t('pastPapers.report.math')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={`${p.paper_title}-${p.completed_at}-${i}`} className="border-b border-border/50">
                <td className="py-2 pr-3 text-foreground">{p.paper_title}</td>
                <td className="py-2 pr-3">{fmtDate(p.completed_at)}</td>
                <td className="py-2 pr-3 font-medium" data-cell="score">
                  {p.total_scaled_estimate != null ? t('pastPapers.score.estimate', { score: p.total_scaled_estimate }) : t('pastPapers.report.partialScore')}
                </td>
                <td className="py-2 pr-3">{counts(p.rw)}</td>
                <td className="py-2 pr-3">{counts(p.math)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
