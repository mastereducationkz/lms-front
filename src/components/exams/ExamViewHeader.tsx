import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { ProofPreviewDialog } from './ProofPreviewDialog';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

export type ExamView = 'students' | 'folders';

/** Page title, the Students | Folders switch and, on the right, whatever the active view puts there. */
export function ExamViewHeader({ view, onView, children }: { view: ExamView; onView: (v: ExamView) => void; children?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{t('exams.title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('exams.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label={t('exams.view.label')}>
          {(['students', 'folders'] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? 'default' : 'outline'} aria-pressed={view === v}
                    onClick={() => onView(v)}>
              {t(`exams.view.${v}`)}
            </Button>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

/** `/exam-results?proof=<id>`: the link in the Excel export opens that result's score report. */
export function DeepLinkedProof() {
  const [params, setParams] = useSearchParams();
  const id = Number(params.get('proof'));
  if (!Number.isInteger(id) || id <= 0) return null;
  return (
    <ProofPreviewDialog
      resultId={id}
      onClose={() => {
        const next = new URLSearchParams(params);
        next.delete('proof');
        setParams(next, { replace: true });
      }}
    />
  );
}
