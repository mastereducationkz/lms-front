import { ExternalLink } from 'lucide-react';
import { Badge } from '../ui/badge';
import { buttonVariants } from '../ui/button';
import { cn } from '../../lib/utils';
import { formatDate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import type { PastPaperTaskStatus } from '@/services/api/pastPapers';
import { PastPaperScore } from './PastPaperScore';
import '@/lib/i18n/catalogs/pastPapers';

interface Props {
  paperTitle: string | null | undefined;
  isPartial?: boolean;
  /** This student's state for the task, from the status endpoint. */
  status: PastPaperTaskStatus | null;
  loading?: boolean;
  failed?: boolean;
}

/**
 * What a teacher or curator sees for a past-paper task in a student's submission: the summary
 * (estimate, the two sections, the weakest topics), a link to the full review on the SAT admin
 * site, and any earlier attempt that was reset. A paper not done yet is said plainly: the
 * submission never waits for it.
 */
export function PastPaperReviewPanel({ paperTitle, isPartial = false, status, loading = false, failed = false }: Props) {
  const t = useT();
  const title = status?.paper_title || paperTitle || t('pastPapers.card.untitled');
  const partial = status?.is_partial ?? isPartial;

  return (
    <div className="space-y-3" data-state={status?.state ?? 'unknown'}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{title}</p>
        {partial && <Badge variant="outline">{t('pastPapers.partial')}</Badge>}
      </div>

      {loading && !status && <p className="text-sm text-muted-foreground">{t('pastPapers.card.checking')}</p>}
      {failed && <p className="text-sm text-amber-700 dark:text-amber-400" role="status">{t('pastPapers.review.statusFailed')}</p>}

      {status && status.state !== 'completed' && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {status.state === 'in_progress' && status.started_at
            ? t('pastPapers.review.inProgressSince', { date: formatDate(status.started_at) })
            : status.state === 'reset_waiting'
              ? t('pastPapers.card.resetWaiting')
              : t('pastPapers.review.notDone')}
        </p>
      )}

      {status?.state === 'completed' && (
        <>
          <PastPaperScore totalScaledEstimate={status.total_scaled_estimate} rw={status.rw} math={status.math} isPartial={partial} />
          <p className="text-xs text-muted-foreground">
            {t('pastPapers.review.completedOn', { date: formatDate(status.completed_at) })}
            {status.before_assigned && ` · ${t('pastPapers.review.beforeAssigned')}`}
          </p>
          {status.weakest_domains.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground">{t('pastPapers.review.weakest')}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {status.weakest_domains.map((d) => (
                  <li key={`${d.section}-${d.domain}`}>{t('pastPapers.review.domainLine', { domain: d.domain, correct: d.correct, total: d.total })}</li>
                ))}
              </ul>
            </div>
          )}
          {status.review_url && (
            <a
              href={status.review_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {t('pastPapers.review.openFull')}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </>
      )}

      {status && status.history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-foreground">{t('pastPapers.review.history')}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {status.history.map((h, i) => (
              <li key={`${h.completed_at}-${i}`} data-testid="history-line">
                {h.total_scaled_estimate != null
                  ? t('pastPapers.review.historyEstimate', { date: formatDate(h.completed_at), score: h.total_scaled_estimate })
                  : t('pastPapers.review.historyPartial', {
                      date: formatDate(h.completed_at),
                      correct: (h.rw?.correct ?? 0) + (h.math?.correct ?? 0),
                      total: (h.rw?.total ?? 0) + (h.math?.total ?? 0),
                    })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
