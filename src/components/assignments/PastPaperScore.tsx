import type { PastPaperSection } from '@/services/api/pastPapers';
import { sectionTotals } from '@/lib/pastPapers';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/pastPapers';

interface Props {
  totalScaledEstimate: number | null;
  rw: PastPaperSection | null;
  math: PastPaperSection | null;
  isPartial?: boolean;
  className?: string;
}

/**
 * A past paper's result, worded the same everywhere: the 400-1600 figure is always "≈ … (estimate)"
 * and never ranked; the raw counts (RW x/54, Math x/44) sit under it. A partial paper has no scaled
 * score, only correct/total.
 */
export function PastPaperScore({ totalScaledEstimate, rw, math, isPartial = false, className }: Props) {
  const t = useT();
  if (isPartial || totalScaledEstimate == null) {
    const { correct, total } = sectionTotals(rw, math);
    if (total === 0) return null;
    return (
      <div className={className}>
        <div data-line="partial" className="font-semibold">{t('pastPapers.score.partial', { correct, total })}</div>
      </div>
    );
  }
  return (
    <div className={className}>
      <div data-line="estimate" className="text-lg font-bold leading-tight">
        {t('pastPapers.score.estimate', { score: totalScaledEstimate })}
      </div>
      <div data-line="sections" className="text-xs text-muted-foreground">
        {[
          rw && t('pastPapers.score.rw', { correct: rw.correct, total: rw.total }),
          math && t('pastPapers.score.math', { correct: math.correct, total: math.total }),
        ].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}
