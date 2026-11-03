import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/react';
import type { ClipSegment } from '@/services/api/staffTraining';
import { formatClock, pick } from './model';
import '@/lib/i18n/catalogs/staffTraining';

/** What is said, sentence by sentence; a click jumps the video there. The sentence being spoken is marked. */
export default function SegmentList({ segments, locale, nowMs, onJump }: {
  segments: ClipSegment[];
  locale: 'ru' | 'en';
  nowMs: number;
  onJump: (ms: number) => void;
}) {
  const t = useT();
  if (segments.length === 0) return null;
  const active = segments.findIndex((s) => nowMs >= s.start_ms && nowMs < s.end_ms);
  return (
    <section aria-label={t('staffTraining.clip.segments')} className="rounded-2xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">{t('staffTraining.clip.segments')}</h2>
      <ol className="max-h-72 divide-y divide-border/60 overflow-y-auto">
        {segments.map((segment, i) => (
          <li key={segment.idx}>
            <button
              type="button"
              data-segment={segment.idx}
              aria-current={i === active ? 'true' : undefined}
              title={t('staffTraining.clip.segmentJump', { time: formatClock(segment.start_ms) })}
              onClick={() => onJump(segment.start_ms)}
              className={cn(
                'flex w-full items-baseline gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                i === active && 'bg-brand-subtle/60',
              )}
            >
              <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{formatClock(segment.start_ms)}</span>
              <span className={cn('min-w-0 text-foreground/90', i === active && 'font-medium text-foreground')}>{pick(segment.text, locale)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
