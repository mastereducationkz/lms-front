import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { band, getStudentTargets, score, type TargetsPayload } from '../../services/api/targets';
import { useT } from '../../lib/i18n/react';

/**
 * Parent dashboard: a read-only line per exam track for one child — target vs current level.
 * Renders nothing when the feature is off, the child has no track, or on error.
 */
export function ChildTargets({ studentId }: { studentId: number }) {
  const t = useT();
  const [data, setData] = useState<TargetsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStudentTargets(studentId)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!data || data.tracks.length === 0) return null;
  const ielts = data.progress.ielts;
  const sat = data.progress.sat;
  const lines: string[] = [];
  if (data.tracks.includes('ielts')) {
    const target = data.targets.ielts?.targets.overall;
    const parts = ielts
      ? ` (L ${band(ielts.modules.listening.now)} R ${band(ielts.modules.reading.now)} W ${band(ielts.modules.writing.now)} S ${band(ielts.modules.speaking.now)})`
      : '';
    lines.push(t('parent.targets.ielts', { target: band(target), now: band(ielts?.overall_now), details: parts }));
  }
  if (data.tracks.includes('sat')) {
    const target = data.targets.sat?.targets.total;
    const cur = sat?.current;
    const detail = cur
      ? ` (Math ${score(cur.math)}${cur.math_correct != null && cur.math_total != null ? ` — ${cur.math_correct}/${cur.math_total}` : ''}, Verbal ${score(cur.verbal)}${cur.verbal_correct != null && cur.verbal_total != null ? ` — ${cur.verbal_correct}/${cur.verbal_total}` : ''})`
      : '';
    lines.push(t('parent.targets.sat', { target: score(target), now: score(cur?.total), details: detail }));
  }
  if (data.tracks.includes('nuet')) {
    lines.push(t('parent.targets.nuet', { target: score(data.targets.nuet?.targets.total) }));
  }
  return (
    <div className="mt-3 rounded-lg border border-border p-3 text-sm">
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
        <Target className="w-3.5 h-3.5" aria-hidden="true" /> {t('parent.targets.title')}
      </p>
      {lines.map((line) => (
        <p key={line} className="text-foreground dark:text-foreground">{line}</p>
      ))}
      {data.tracks.includes('sat') && sat?.current && (
        <p className="mt-1 text-[11px] italic text-muted-foreground">
          {t('parent.targets.satDisclaimer')}
        </p>
      )}
    </div>
  );
}

export default ChildTargets;
