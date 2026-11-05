import { useState } from 'react';
import { Button } from '../ui/button';
import { ProofPreviewDialog } from './ProofPreviewDialog';
import { ExamExportButton, type ExportAction } from './ExamExportButton';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

export type ExamView = 'students' | 'folders';

/** Page title, the Students | Folders switch and, next to it, the export control (one instance for both views). */
export function ExamViewHeader({ view, onView, action }: { view: ExamView; onView: (v: ExamView) => void; action: ExportAction | null }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{t('exams.title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('exams.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex gap-1" role="group" aria-label={t('exams.view.label')}>
          {(['students', 'folders'] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? 'default' : 'outline'} aria-pressed={view === v}
                    onClick={() => onView(v)}>
              {t(`exams.view.${v}`)}
            </Button>
          ))}
        </div>
        <ExamExportButton action={action} />
      </div>
    </div>
  );
}

const proofFromUrl = (): number => {
  const n = Number(new URLSearchParams(window.location.search).get('proof'));
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** `/exam-results?proof=<id>`: the link in the Excel export opens that result's score report.
 *  Reads the address bar directly so the page needs no router context. */
export function DeepLinkedProof() {
  const [id, setId] = useState(proofFromUrl);
  if (!id) return null;
  return (
    <ProofPreviewDialog
      resultId={id}
      onClose={() => {
        const next = new URLSearchParams(window.location.search);
        next.delete('proof');
        const qs = next.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
        setId(0);
      }}
    />
  );
}
