import {
  AlertTriangle, Check, Clock3, Hourglass, ListOrdered, PauseCircle, RefreshCw, RotateCcw, VideoOff, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import BrandMark from '../BrandMark';
import { useNow } from '../meetAttendance/MeetSyncStatus';
import {
  attemptsText, badgeText, isTerminal, missingAfterText, overallPercent, phaseLabel, phaseLine, queueText,
  recordingSteps, stageSentence, stageTitle, stageTone, updatedAgo, workerLine,
  type ProgressTone, type StepStatus,
} from '../../lib/recordingProgress';
import type { Locale } from '../../lib/recordings';
import type { RecordingProgress } from '../../services/api/recordings';

/**
 * A recording on its way to watchable, shown as what it is (2026-09-15): the stage, how far the
 * step under way has got, the place in line, the attempt — and, in the player, every step from
 * the lesson ending to the video. It replaces a spinner and «Processing», which said nothing
 * about whose move it was or how long it might be.
 */

const FILL: Record<ProgressTone, string> = {
  progress: 'bg-sky-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  neutral: 'bg-white/40',
  success: 'bg-emerald-400',
};

const BADGE: Record<ProgressTone, string> = {
  progress: 'bg-sky-100 text-sky-900',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-rose-100 text-rose-900',
  neutral: 'bg-slate-200 text-slate-800',
  success: 'bg-emerald-100 text-emerald-900',
};

const HALO: Record<ProgressTone, string> = {
  progress: 'bg-sky-400/15 text-sky-300',
  warning: 'bg-amber-400/15 text-amber-300',
  danger: 'bg-rose-400/15 text-rose-300',
  neutral: 'bg-white/10 text-white/60',
  success: 'bg-emerald-400/15 text-emerald-300',
};

const TEXT = {
  en: {
    retry: 'Try again', retrying: 'Starting again…', progress: 'Progress',
    askAdmin: 'An admin or a head teacher can try this recording again.',
    done: 'done', active: 'in progress', todo: 'to come', failed: 'failed',
  },
  ru: {
    retry: 'Попробовать снова', retrying: 'Запускаем снова…', progress: 'Ход подготовки',
    askAdmin: 'Повторить подготовку записи может администратор или руководитель.',
    done: 'готово', active: 'идёт', todo: 'впереди', failed: 'не удалось',
  },
} as const;

function StageIcon({ progress, className }: { progress: RecordingProgress; className?: string }) {
  switch (progress.stage) {
    case 'lesson_running': return <Clock3 className={className} aria-hidden />;
    case 'waiting_for_google': return <Hourglass className={className} aria-hidden />;
    case 'queued': return progress.held_for_disk
      ? <PauseCircle className={className} aria-hidden />
      : <ListOrdered className={className} aria-hidden />;
    // Our own work under way: the Master Education mark, turning slowly (owner, 2026-09-15 — the
    // pulsing dot "looked too AI-ish"). Waiting and queued keep icons that say what is awaited.
    case 'processing': return <BrandMark spinning className={className} />;
    case 'retrying': return <RefreshCw className={className} aria-hidden />;
    case 'failed': return <AlertTriangle className={className} aria-hidden />;
    case 'removed': return <VideoOff className={className} aria-hidden />;
    default: return <Check className={className} aria-hidden />;
  }
}

/**
 * How far, when that is known; that something is moving, when it is not. An indeterminate bar
 * never pretends to a percent, and with reduced motion it simply stays still.
 */
export function ProgressBar({ percent, tone = 'progress', label, className }: {
  percent: number | null;
  tone?: ProgressTone;
  label: string;
  className?: string;
}) {
  const known = percent != null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? percent : undefined}
      aria-valuetext={known ? `${percent}%` : undefined}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-white/15', className)}
    >
      {known ? (
        <span className={cn('block h-full rounded-full transition-[width] duration-700 ease-out', FILL[tone])} style={{ width: `${percent}%` }} />
      ) : (
        <span className={cn(
          'absolute inset-y-0 left-0 w-1/3 rounded-full motion-safe:animate-recording-indeterminate motion-reduce:w-full motion-reduce:opacity-40',
          FILL[tone],
        )} />
      )}
    </div>
  );
}

/** The card's label: "Processing · 42%", "In line · #3", "Retrying 2/3", "Could not process". */
export function RecordingStageBadge({ progress, locale, className }: { progress: RecordingProgress; locale: Locale; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm',
      BADGE[stageTone(progress)],
      className,
    )}>
      <StageIcon progress={progress} className="h-3 w-3" />
      {badgeText(progress, locale)}
    </span>
  );
}

/** Where a card's preview will be: the percent while preparing, else the stage's icon — and the step or the line under it. */
export function RecordingCardStage({ progress, locale, name }: { progress: RecordingProgress; locale: Locale; name: string }) {
  const percent = overallPercent(progress);
  const caption = progress.stage === 'processing' && progress.phase ? phaseLabel(progress.phase, locale)
    : queueText(progress, locale) ?? name;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-700 to-slate-900 px-4 text-center">
      {percent != null ? (
        <span className="text-2xl font-semibold tabular-nums text-white/90">{percent}%</span>
      ) : (
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', HALO[stageTone(progress)])}>
          <StageIcon progress={progress} className="h-4 w-4" />
        </span>
      )}
      <span className="line-clamp-1 text-xs font-medium text-white/60">{caption}</span>
    </div>
  );
}

const INLINE_TEXT: Record<ProgressTone, string> = {
  progress: 'text-sky-700 dark:text-sky-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-rose-700 dark:text-rose-300',
  neutral: 'text-muted-foreground',
  success: 'text-emerald-700 dark:text-emerald-300',
};

/**
 * A recording on its way in a light list row — the calendar's open day: the stage with its percent
 * or place in line, and a thin bar while it is being prepared.
 */
export function RecordingStatusInline({ progress, locale, className }: { progress: RecordingProgress; locale: Locale; className?: string }) {
  const tone = stageTone(progress);
  const label = badgeText(progress, locale);
  return (
    <span className={cn('inline-flex min-w-0 flex-col items-end gap-1', className)}>
      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium tabular-nums', INLINE_TEXT[tone])}>
        <StageIcon progress={progress} className="h-3.5 w-3.5" />
        {label}
      </span>
      {progress.stage === 'processing' && (
        <ProgressBar percent={overallPercent(progress)} tone={tone} label={label} className="h-1 w-24 bg-muted" />
      )}
    </span>
  );
}

/**
 * A recording on its way inside the light lesson dialog: the stage and why, the step under way with
 * its bar, the place in line — and, for staff, why it failed. The player shows the full steps.
 */
export function RecordingStatusCard({ progress, locale, className }: { progress: RecordingProgress; locale: Locale; className?: string }) {
  const tone = stageTone(progress);
  const title = stageTitle(progress, locale);
  const percent = overallPercent(progress);
  const detail = phaseLine(progress, locale) ?? queueText(progress, locale) ?? attemptsText(progress, locale);
  return (
    <div className={cn('space-y-2', className)}>
      <div role="status" aria-live="polite" className={cn('flex items-center gap-2 text-sm font-semibold', INLINE_TEXT[tone])}>
        <StageIcon progress={progress} className="h-4 w-4" />
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{stageSentence(progress, locale)}</p>
      {progress.stage === 'processing' ? (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span className="min-w-0 truncate tabular-nums">{detail ?? ' '}</span>
            {percent != null && <span className="flex-none font-semibold tabular-nums text-foreground">{percent}%</span>}
          </div>
          <ProgressBar percent={percent} tone={tone} label={title} className="bg-muted" />
        </div>
      ) : !isTerminal(progress.stage) && detail && (
        <p className="text-xs tabular-nums text-muted-foreground">{detail}</p>
      )}
      {progress.stage === 'failed' && progress.error && (
        <p className="break-words rounded-md bg-rose-50 px-2.5 py-1.5 font-mono text-[12px] leading-relaxed text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {progress.error}
        </p>
      )}
    </div>
  );
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span className="relative z-10 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
        <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="relative z-10 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-rose-400/20 text-rose-300">
        <X className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="relative z-10 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-sky-400/15 ring-1 ring-sky-400/60">
        <BrandMark spinning className="h-2.5 w-2.5 text-sky-300" />
      </span>
    );
  }
  return <span className="relative z-10 h-4 w-4 flex-none rounded-full border border-dashed border-white/25" aria-hidden />;
}

interface PanelProps {
  progress: RecordingProgress;
  locale: Locale;
  /** Staff see the failure's reason and when a lesson would be flagged as having no recording. */
  staff: boolean;
  canRetry: boolean;
  retrying: boolean;
  onRetry?: () => void;
}

/**
 * The player while there is no video yet: the stage and why, the overall bar with the step
 * under way, the place in line, the steps from the lesson to the video, and what the worker is
 * doing. Only the stage's title is announced to screen readers — never every percent.
 */
export function RecordingProgressPanel({ progress, locale, staff, canRetry, retrying, onRetry }: PanelProps) {
  const t = TEXT[locale];
  const now = useNow(5_000);
  const tone = stageTone(progress);
  const percent = overallPercent(progress);
  const title = stageTitle(progress, locale);
  const detail = phaseLine(progress, locale) ?? queueText(progress, locale) ?? attemptsText(progress, locale);
  const worker = workerLine(progress.sync, now, locale);
  const updated = updatedAgo(progress.updated_at, now, locale);
  const missing = staff ? missingAfterText(progress, locale) : null;

  return (
    <div className="grid w-full gap-6 px-5 py-6 text-left text-white sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:gap-8 sm:px-8 sm:py-8">
      <div className="flex min-w-0 flex-col justify-center gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-full', HALO[tone])}>
            <StageIcon progress={progress} className="h-5 w-5" />
          </span>
          <h3 role="status" aria-live="polite" className="text-base font-semibold leading-snug sm:text-lg">{title}</h3>
        </div>
        <p className="max-w-md text-sm text-white/70">
          {progress.stage === 'processing' && progress.attempts > 1 ? `${stageSentence(progress, locale)} ${attemptsText(progress, locale)}.` : stageSentence(progress, locale)}
        </p>

        {/* A bar only while the recording itself is being worked on: in line or waiting on Google,
            nothing is moving yet, and a sweeping bar would say otherwise. */}
        {progress.stage === 'processing' ? (
          <div className="max-w-md space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-xs text-white/65">
              <span className="min-w-0 truncate tabular-nums">{detail ?? ' '}</span>
              {percent != null && <span className="flex-none text-sm font-semibold tabular-nums text-white">{percent}%</span>}
            </div>
            <ProgressBar percent={percent} tone={tone} label={title} />
          </div>
        ) : !isTerminal(progress.stage) && detail && (
          <p className="max-w-md text-xs tabular-nums text-white/65">{detail}</p>
        )}

        {progress.stage === 'failed' && (staff || canRetry) && (
          <div className="flex max-w-md flex-col items-start gap-2">
            {staff && progress.error && (
              <p className="w-full break-words rounded-lg bg-rose-500/10 px-3 py-2 font-mono text-[12px] leading-relaxed text-rose-200">
                {progress.error}
              </p>
            )}
            {canRetry && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-900 transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60"
              >
                <RotateCcw className={cn('h-3.5 w-3.5', retrying && 'motion-safe:animate-spin')} aria-hidden />
                {retrying ? t.retrying : t.retry}
              </button>
            ) : (
              <p className="text-xs text-white/55">{t.askAdmin}</p>
            )}
          </div>
        )}

        {missing && <p className="max-w-md text-xs text-white/55">{missing}</p>}

        {(worker || updated) && (
          <p className={cn('flex items-start gap-1.5 text-[12px]', worker?.tone === 'slow' ? 'text-amber-300' : 'text-white/50')}>
            <RefreshCw
              className={cn('mt-px h-3 w-3 flex-none', worker?.tone === 'active' && 'motion-safe:animate-spin [animation-duration:2.5s]')}
              aria-hidden
            />
            <span>{[worker?.text, updated].filter(Boolean).join(' · ')}</span>
          </p>
        )}
      </div>

      <ol className="min-w-0 self-center" aria-label={t.progress}>
        {recordingSteps(progress, locale).map((step, index, steps) => (
          <li key={step.key} className="relative flex gap-2.5 pb-2.5 last:pb-0">
            {index < steps.length - 1 && (
              <span
                className={cn('absolute left-[7.5px] top-4 w-px', step.status === 'done' ? 'bg-emerald-400/50' : 'bg-white/15')}
                style={{ height: 'calc(100% - 16px)' }}
                aria-hidden
              />
            )}
            <StepDot status={step.status} />
            <div className="-mt-0.5 min-w-0">
              <div className={cn(
                'text-[13px] leading-5',
                step.status === 'todo' ? 'text-white/40' : 'text-white/85',
                step.status === 'active' && 'font-medium text-white',
                step.status === 'failed' && 'font-medium text-rose-300',
              )}>
                {step.label}
                <span className="sr-only"> ({t[step.status]})</span>
              </div>
              {step.detail && <div className="text-[11.5px] tabular-nums text-white/55">{step.detail}</div>}
              {step.status === 'active' && step.percent != null && (
                <ProgressBar percent={step.percent} tone={tone} label={step.label} className="mt-1 h-1 w-28" />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
