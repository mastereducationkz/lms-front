import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { clock } from '../../lib/meetAttendance';
import {
  STAGE_TITLE,
  judgeText,
  stageText,
  syncStatus,
  waitedText,
  waitingSteps,
  type StepStatus,
  type SyncStatus,
} from '../../lib/meetSync';
import type { MeetSync, MeetWaiting } from '../../services/api/meetAttendance';
import BrandMark from '../BrandMark';

/**
 * A lesson waiting on Google Meet, shown as what it is (2026-09-15): the stage it is in, how long it
 * has waited, and what the LMS's check with Meet is doing. A spinner and «Loading» made the LMS look
 * slow while the wait was Google's.
 */

/** The current time, ticking every `intervalMs`, so "waiting 1 h 25 min" keeps counting. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Work under way: the Master Education mark turning slowly — the same mark the recordings show
 * (owner, 2026-09-15: the pulsing dot "looked too AI-ish"). Still for reduced motion.
 */
function WorkingMark({ className }: { className?: string }) {
  return <BrandMark spinning className={cn('h-3.5 w-3.5 text-sky-600 dark:text-sky-400', className)} />;
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span className="relative z-10 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="relative z-10 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-sky-100 ring-1 ring-sky-300 dark:bg-sky-900/50 dark:ring-sky-700">
        <WorkingMark className="h-3 w-3" />
      </span>
    );
  }
  return <span className="relative z-10 h-5 w-5 flex-none rounded-full border border-dashed border-muted-foreground/40 bg-card" aria-hidden />;
}

/** The check with Google Meet in one line: under way (which step, how far), slow, or when it last ran and runs next. */
export function MeetSyncLine({ status, className }: { status: SyncStatus; className?: string }) {
  const Icon = status.tone === 'slow' ? AlertTriangle : status.tone === 'active' ? RefreshCw : Clock3;
  return (
    <p className={cn('flex items-start gap-1.5 text-xs', status.tone === 'slow' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground', className)}>
      <Icon className={cn('mt-px h-3.5 w-3.5 flex-none', status.tone === 'active' && 'motion-safe:animate-spin [animation-duration:2.5s]')} aria-hidden />
      <span>{status.text}</span>
    </p>
  );
}

/** A waiting lesson in a list row: its stage, how long it has waited, and why. */
export function MeetWaitingSummary({ waiting, now }: { waiting?: MeetWaiting | null; now: number }) {
  if (!waiting) {
    return (
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <WorkingMark /> Waiting for Google Meet
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <WorkingMark /> {STAGE_TITLE[waiting.stage]}
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">{waitedText(waiting, now)}</div>
      <div className="text-xs text-muted-foreground">{stageText(waiting)}</div>
    </div>
  );
}

/**
 * A waiting lesson on its card and in its dialog: the four steps from the lesson ending to its
 * record opening — each done, under way or still to come — and the check with Google Meet.
 */
export function MeetWaitingProgress({ waiting, sync, className }: { waiting: MeetWaiting; sync?: MeetSync | null; className?: string }) {
  const now = useNow();
  const steps = waitingSteps(waiting, sync, now);
  const status = syncStatus(sync, now);
  const judge = judgeText(waiting);

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <div role="status" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <WorkingMark className="h-4 w-4" /> {STAGE_TITLE[waiting.stage]}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{stageText(waiting)}</p>
      </div>
      <ol className="space-y-0" aria-label="Progress">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-3 pb-3 last:pb-0">
            {i < steps.length - 1 && (
              <span
                className={cn('absolute left-[9.5px] top-5 w-px', step.status === 'done' ? 'bg-emerald-400/60' : 'bg-border')}
                style={{ height: 'calc(100% - 20px)' }}
                aria-hidden
              />
            )}
            <StepIcon status={step.status} />
            <div className="min-w-0">
              <div className={cn('text-sm leading-5', step.status === 'todo' ? 'text-muted-foreground' : 'text-foreground', step.status === 'active' && 'font-medium')}>
                {step.label}
                <span className="sr-only">{step.status === 'done' ? ' (done)' : step.status === 'active' ? ' (in progress)' : ' (to come)'}</span>
              </div>
              {step.detail && <div className="text-xs tabular-nums text-muted-foreground">{step.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
      {(status || judge) && (
        <div className="space-y-1 border-t border-border pt-2.5">
          {status && <MeetSyncLine status={status} />}
          {judge && <p className="pl-5 text-xs text-muted-foreground">{judge}</p>}
        </div>
      )}
    </div>
  );
}

interface BannerProps {
  sync?: MeetSync | null;
  /** Lessons in the list still waiting on Google Meet. */
  waiting: number;
  /** When the list was last read from the LMS. */
  updatedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  /** Offered while the waiting lessons are filtered out of view. */
  onShowWaiting?: () => void;
}

/** The review page's line about Google Meet: how many lessons wait, what the check is doing, and a refresh. */
export function MeetSyncBanner({ sync, waiting, updatedAt, refreshing, onRefresh, onShowWaiting }: BannerProps) {
  const now = useNow();
  const status = syncStatus(sync, now);
  if (!waiting && !status?.tone.match(/active|slow/)) return null;
  const slow = status?.tone === 'slow';

  return (
    <section
      aria-label="Google Meet sync"
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3',
        slow ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30'
          : 'border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/30',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <WorkingMark className="mt-0.5 h-4 w-4" />
        <div className="min-w-0 space-y-0.5">
          <div role="status" className="text-sm font-medium text-foreground">
            {waiting
              ? `${waiting} lesson${waiting === 1 ? ' is' : 's are'} waiting for Google Meet to hand over ${waiting === 1 ? 'its call' : 'their calls'}`
              : 'Syncing with Google Meet'}
            {waiting > 0 && onShowWaiting && (
              <button type="button" onClick={onShowWaiting}
                className="ml-2 text-[13px] font-medium text-sky-700 underline-offset-4 hover:underline dark:text-sky-300">
                Show
              </button>
            )}
          </div>
          {status && <MeetSyncLine status={status} />}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {updatedAt && (
          <span className="text-xs tabular-nums text-muted-foreground" title="The list refreshes itself every minute while lessons are waiting">
            Updated {clock(new Date(updatedAt).toISOString())} · refreshes every minute
          </span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden />
          Refresh
        </button>
      </div>
    </section>
  );
}
