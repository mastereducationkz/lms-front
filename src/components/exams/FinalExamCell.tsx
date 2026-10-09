import { useT } from '../../lib/i18n/react';
import { finalExamView, type BluebookFinalExam } from '../../lib/bluebookFinalExam';
import { ScoreChange } from './InitialScoreCell';
import '@/lib/i18n/catalogs/teacherInsights';

/**
 * The two «Final exam» cells of the Bluebook grid. The score cell holds the total with the change from the
 * Assignment Zero baseline and Verbal / Math under it; the date cell holds the day it was sat and whether
 * anyone has checked it against proof. With no result yet the planned test date stands in.
 */
export function FinalExamScore({ final }: { final?: BluebookFinalExam | null }) {
  const t = useT();
  const view = finalExamView(final);
  if (view.kind !== 'result') return <>–</>;
  return (
    <span className="flex flex-col items-center leading-tight">
      <span data-line>
        <span className="font-semibold">{view.total}</span>
        <ScoreChange change={view.change} examType="sat" title={t('teacherInsights.bluebook.final.changeTitle')} />
      </span>
      {view.detail && <span data-line className="text-[10px] tabular-nums text-muted-foreground">{view.detail}</span>}
    </span>
  );
}

export function FinalExamWhen({ final }: { final?: BluebookFinalExam | null }) {
  const t = useT();
  const view = finalExamView(final);
  if (view.kind === 'none') return <>–</>;
  if (view.kind === 'planned') return <span className="text-muted-foreground">{t('teacherInsights.bluebook.final.planned', { date: view.date })}</span>;
  return (
    <span className="flex flex-col items-center leading-tight">
      <span data-line>{view.date}</span>
      {view.verified ? (
        <span data-line className="text-[10px] text-green-700 dark:text-green-400">{t('teacherInsights.bluebook.final.verified')}</span>
      ) : (
        <span data-line title={t('teacherInsights.bluebook.final.unverifiedTitle')} className="text-[10px] text-amber-700 dark:text-amber-400">
          {t('teacherInsights.bluebook.final.unverified')}
        </span>
      )}
    </span>
  );
}
