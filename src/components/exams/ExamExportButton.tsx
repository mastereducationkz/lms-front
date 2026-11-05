import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

/** What the header's export button should do right now, as reported by the active view. */
export interface ExportAction {
  /** Live description of WHAT will be exported: «1 240 учеников», «SAT · 3 окт. · 98 результатов». */
  scope: string;
  /** Rows the export would hold; null while that is still being counted. */
  count: number | null;
  busy: boolean;
  run: () => void;
}

/**
 * The one export control of /exam-results. It sits in the shared header and stays there, same size,
 * icon and label, in both views; only its caption, its enabled state and what it downloads follow
 * the active view. Below `sm` the label collapses to the icon (the aria-label keeps the full name).
 */
export function ExamExportButton({ action }: { action: ExportAction | null }) {
  const t = useT();
  const empty = action != null && action.count === 0;
  const disabled = !action || action.busy || action.count == null || empty;
  const label = action?.busy ? t('exams.export.running') : t('exams.export.button');
  const scope = action?.scope ?? t('common.loading');
  return (
    <div className="flex flex-col items-end">
      <Button size="sm" data-testid="exam-export" disabled={disabled} onClick={() => action?.run()}
              aria-label={`${t('exams.export.button')}: ${scope}`}
              title={empty ? t('exams.export.empty') : undefined}
              className="sm:min-w-[10.5rem]">
        <Download className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
      {/* Out of flow: a long caption must never widen this column and push the button to another row. */}
      <div className="relative h-4 w-full">
        <span className="absolute right-0 top-0 max-w-[14rem] truncate whitespace-nowrap text-[11px] text-muted-foreground" aria-live="polite">
          {empty ? t('exams.export.empty') : scope}
        </span>
      </div>
    </div>
  );
}
