import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ClipboardCheck, PlayCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mediaUrl } from '@/lib/mediaUrl';
import { useT } from '@/lib/i18n/react';
import type { ClipSummary, TrackItem } from '@/services/api/staffTraining';
import { formatClock, itemId, itemPath, pick } from './model';
import '@/lib/i18n/catalogs/staffTraining';

interface StepProps {
  item: TrackItem;
  locale: 'ru' | 'en';
  /** Where «Continue» points: drawn with a ring. */
  current?: boolean;
  /** Show «Required»/«Optional» (a person's own track); the library does not. */
  showRequired?: boolean;
  /** The heads' detail page links nowhere: it only reads. */
  readOnly?: boolean;
  /** A control at the end of a read-only card (the heads' «Cancel assignment»). */
  action?: ReactNode;
}

function Bar({ pct }: { pct: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="block h-full rounded-full bg-brand-solid" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

function ClipMeta({ clip }: { clip: ClipSummary }) {
  const t = useT();
  const pct = clip.watch_pct ?? 0;
  return (
    <>
      <span>{formatClock(clip.duration_ms)}</span>
      {pct > 0 && <span>{t('staffTraining.step.watched', { pct })}</span>}
      {(clip.questions_total ?? 0) > 0 && (
        <span>{t('staffTraining.step.questions', { passed: clip.questions_passed ?? 0, total: clip.questions_total ?? 0 })}</span>
      )}
    </>
  );
}

/** One step of a track: a video or a practice task. Any step opens at any time; nothing is locked behind another. */
export function StepCard({ item, locale, current, showRequired = true, readOnly, action }: StepProps) {
  const t = useT();
  const clip = item.kind === 'clip' ? item.clip : undefined;
  const task = item.kind === 'task' ? item.task : undefined;
  if (!clip && !task) return null;
  const title = pick(clip?.title ?? task?.title, locale);
  const platform = (clip ?? task)!.platform;
  const poster = mediaUrl(clip?.poster_url);
  const result = task?.last_result;
  const Icon = item.kind === 'clip' ? PlayCircle : ClipboardCheck;
  const failedTries = (item.attempts?.failed ?? 0) + (item.attempts?.wrong_total ?? 0);

  const body = (
    <>
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          item.done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
        )}
      >
        {item.done ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : item.position}
      </span>
      {poster && <img src={poster} alt="" loading="lazy" className="hidden aspect-video w-32 shrink-0 rounded-lg object-cover @xl:block" />}
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block text-sm font-semibold text-foreground @lg:text-base">{title}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" aria-hidden />{t(item.kind === 'clip' ? 'staffTraining.step.clip' : 'staffTraining.step.task')}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">{t(platform === 'crm' ? 'staffTraining.platform.crm' : 'staffTraining.platform.lms')}</span>
          {clip && <ClipMeta clip={clip} />}
          {failedTries > 0 && <span className="text-amber-700 dark:text-amber-400">{t('staffTraining.progress.failedAttempts', { count: failedTries })}</span>}
          {showRequired && <span>{t(item.required ? 'staffTraining.required' : 'staffTraining.optional')}</span>}
          {result && (
            <span className={cn('inline-flex items-center gap-1', result.status === 'passed' ? 'text-emerald-700 dark:text-emerald-400' : result.status === 'failed' ? 'text-red-700 dark:text-red-400' : '')}>
              {result.status === 'passed' ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
              {t(result.status === 'passed' ? 'staffTraining.step.passedCheck' : 'staffTraining.step.failedCheck')}
            </span>
          )}
        </span>
        {clip && (clip.watch_pct ?? 0) > 0 && !item.done && <Bar pct={clip.watch_pct ?? 0} />}
      </span>
      {!readOnly && <ChevronRight className="mt-1.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </>
  );

  const classes = cn(
    'group flex items-start gap-3 rounded-2xl border bg-card p-3.5 shadow-sm @lg:gap-4 @lg:p-4',
    current ? 'border-primary ring-1 ring-primary/40' : 'border-border',
    !readOnly && 'transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );

  return (
    <li data-step={item.position} data-kind={item.kind} data-done={item.done ? 'true' : 'false'} data-current={current ? 'true' : undefined}>
      {readOnly ? <div className={classes}>{body}{action}</div> : <Link to={itemPath(item.kind, itemId(item))} className={classes}>{body}</Link>}
    </li>
  );
}

export default function TrackSteps({ items, locale, currentId, showRequired, readOnly }: {
  items: TrackItem[];
  locale: 'ru' | 'en';
  currentId?: { kind: 'clip' | 'task'; id: number } | null;
  showRequired?: boolean;
  readOnly?: boolean;
}) {
  return (
    <ol className="space-y-2.5">
      {items.map((item) => (
        <StepCard
          key={`${item.kind}-${itemId(item)}-${item.position}`}
          item={item}
          locale={locale}
          showRequired={showRequired}
          readOnly={readOnly}
          current={!!currentId && currentId.kind === item.kind && currentId.id === itemId(item)}
        />
      ))}
    </ol>
  );
}
