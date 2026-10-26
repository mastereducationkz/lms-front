import { CheckCircle2, Circle, Clock, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { openPlatformPage } from '../../lib/platformLinks';
import { formatDate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import type { PastPaperState, PastPaperTaskStatus } from '@/services/api/pastPapers';
import { PastPaperScore } from './PastPaperScore';
import '@/lib/i18n/catalogs/pastPapers';

interface Props {
  /** What the homework stored when the paper was picked: shown while (or if) the live state is missing. */
  paperId: number | null | undefined;
  paperTitle: string | null | undefined;
  isPartial?: boolean;
  /** The task's live state from the status endpoint. */
  status: PastPaperTaskStatus | null;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}

const CHIP: Record<PastPaperState, { Icon: typeof Circle; cls: string }> = {
  not_started: { Icon: Circle, cls: '' },
  in_progress: { Icon: Clock, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  completed: { Icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  reset_waiting: { Icon: RotateCcw, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
};

const CHIP_LABEL = {
  not_started: 'pastPapers.state.notStarted',
  in_progress: 'pastPapers.state.inProgress',
  completed: 'pastPapers.state.completed',
  reset_waiting: 'pastPapers.state.resetWaiting',
} as const;

/**
 * The student's view of one SAT past paper inside a homework: where it stands, the score when done
 * (always as an estimate) and a one-click way into the paper on the SAT platform. It never gates
 * Submit; the paper's result attaches whenever it arrives.
 */
export function PastPaperTaskCard({ paperId, paperTitle, isPartial = false, status, loading = false, failed = false, onRetry }: Props) {
  const t = useT();
  const state: PastPaperState = status?.state ?? 'not_started';
  const { Icon, cls } = CHIP[state];
  const title = status?.paper_title || paperTitle || t('pastPapers.card.untitled');
  const partial = status?.is_partial ?? isPartial;
  // Without the live state (the read failed) the paper can still be opened from what the homework stored.
  const startPath = status?.paper_path || (paperId != null ? `/past-papers/${paperId}` : null);
  const resultsPath = status?.results_path || null;

  return (
    <div className="space-y-3" data-state={state}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-medium text-foreground">{title}</p>
          {partial && <Badge variant="outline" className="mt-1">{t('pastPapers.partial')}</Badge>}
        </div>
        {loading && !status ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('pastPapers.card.checking')}
          </span>
        ) : (
          !failed && (
            <Badge variant="secondary" className={`gap-1 ${cls}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t(CHIP_LABEL[state])}
            </Badge>
          )
        )}
      </div>

      {failed && (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          {t('pastPapers.card.statusFailed')}
          {onRetry && (
            <Button type="button" variant="link" size="sm" className="px-1" onClick={onRetry}>
              {t('pastPapers.card.retry')}
            </Button>
          )}
        </p>
      )}

      {status?.state === 'completed' && (
        <div className="space-y-1">
          <PastPaperScore
            totalScaledEstimate={status.total_scaled_estimate}
            rw={status.rw}
            math={status.math}
            isPartial={partial}
          />
          {status.before_assigned && (
            <p className="text-xs text-muted-foreground">
              {t('pastPapers.card.doneBefore', { date: formatDate(status.completed_at) })}
            </p>
          )}
        </div>
      )}

      {status?.state === 'in_progress' && status.started_at && (
        <p className="text-sm text-muted-foreground">{t('pastPapers.card.inProgressSince', { date: formatDate(status.started_at) })}</p>
      )}

      {status?.state === 'reset_waiting' && (
        <p className="text-sm text-muted-foreground">{t('pastPapers.card.resetWaiting')}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {state !== 'completed' && startPath && (
          <Button type="button" size="sm" onClick={() => void openPlatformPage('sat', startPath)}>
            {state === 'in_progress' ? t('pastPapers.card.continue') : t('pastPapers.card.start')}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {state === 'completed' && resultsPath && (
          <Button type="button" size="sm" variant="outline" onClick={() => void openPlatformPage('sat', resultsPath)}>
            {t('pastPapers.card.results')}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {state !== 'completed' && (
          <span className="text-xs text-muted-foreground">{t('pastPapers.card.cantOpen')}</span>
        )}
      </div>
    </div>
  );
}
