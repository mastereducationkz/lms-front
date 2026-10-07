/**
 * A lesson recording on its way to being watchable, in words and steps (2026-09-15).
 *
 * «Processing» used to be the only word a recording had until it played. The owner asked for
 * live status instead: waiting on Google Meet, in line, which step and how far, retrying. This
 * is the pure half — deterministic and unit-tested; the components only arrange it. Nothing
 * here promises a time nobody measured: an ETA appears only when the server measured a rate
 * for the step under way.
 */
import { clock } from './meetAttendance';
import { activeLocale, intlLocale, t, type Locale, type MessageKey } from './i18n';
import type {
  LessonRecordingStatus,
  RecordingPhase,
  RecordingProgress,
  RecordingStage,
} from '../services/api/recordings';
import type { MeetSync, MeetSyncStep } from '../services/api/meetAttendance';
import '@/lib/i18n/catalogs/recordings';

export const PHASES: RecordingPhase[] = ['downloading', 'packaging', 'preview', 'uploading'];

const STAGE_TITLE: Record<RecordingStage, MessageKey> = {
  lesson_running: 'recordings.stageTitle.lessonRunning',
  waiting_for_google: 'recordings.stageTitle.waitingForGoogle',
  queued: 'recordings.stageTitle.queued',
  processing: 'recordings.stageTitle.processing',
  retrying: 'recordings.stageTitle.retrying',
  ready: 'recordings.stageTitle.ready',
  failed: 'recordings.stageTitle.failed',
  removed: 'recordings.stageTitle.removed',
};

const STAGE_SENTENCE: Record<RecordingStage, MessageKey> = {
  lesson_running: 'recordings.stageSentence.lessonRunning',
  waiting_for_google: 'recordings.stageSentence.waitingForGoogle',
  queued: 'recordings.stageSentence.queued',
  processing: 'recordings.stageSentence.processing',
  retrying: 'recordings.stageSentence.retrying',
  ready: 'recordings.stageSentence.ready',
  failed: 'recordings.stageSentence.failed',
  removed: 'recordings.stageSentence.removed',
};

const STAGE_BADGE: Record<RecordingStage, MessageKey> = {
  lesson_running: 'recordings.badge.lessonRunning',
  waiting_for_google: 'recordings.badge.waitingForGoogle',
  queued: 'recordings.badge.queued',
  processing: 'recordings.badge.processing',
  retrying: 'recordings.badge.retrying',
  ready: 'recordings.badge.ready',
  failed: 'recordings.badge.failed',
  removed: 'recordings.badge.removed',
};

const PHASE_LABEL: Record<RecordingPhase, MessageKey> = {
  downloading: 'recordings.phase.downloading',
  packaging: 'recordings.phase.packaging',
  preview: 'recordings.phase.preview',
  uploading: 'recordings.phase.uploading',
};

const STEP_LABEL: Record<RecordingStepKey, MessageKey> = {
  lesson: 'recordings.step.lesson',
  google: 'recordings.step.google',
  queue: 'recordings.step.queue',
  downloading: 'recordings.step.downloading',
  packaging: 'recordings.step.packaging',
  preview: 'recordings.step.preview',
  uploading: 'recordings.step.uploading',
  ready: 'recordings.step.ready',
};

const WORKER_STEP: Record<MeetSyncStep, MessageKey> = {
  links: 'recordings.worker.links',
  rooms: 'recordings.worker.rooms',
  claimed: 'recordings.worker.claimed',
  attendance: 'recordings.worker.attendance',
  register: 'recordings.worker.register',
  speech: 'recordings.worker.speech',
  ingested: 'recordings.worker.ingested',
  transcribed: 'recordings.worker.transcribed',
  missing: 'recordings.worker.missing',
};

const ORDINAL: Record<Intl.LDMLPluralRule, MessageKey> = {
  zero: 'recordings.progress.ordinalOther',
  one: 'recordings.progress.ordinalOne',
  two: 'recordings.progress.ordinalTwo',
  few: 'recordings.progress.ordinalFew',
  many: 'recordings.progress.ordinalOther',
  other: 'recordings.progress.ordinalOther',
};

/** "3rd" / "3-я" — a place in line. */
function ordinal(n: number, locale: Locale): string {
  const rule = new Intl.PluralRules(intlLocale(locale), { type: 'ordinal' }).select(n);
  return t(ORDINAL[rule], { n }, locale);
}

const clampPercent = (value: number | null | undefined): number | null =>
  value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, Math.round(value)));

export function isTerminal(stage: RecordingStage): boolean {
  return stage === 'ready' || stage === 'failed' || stage === 'removed';
}

/**
 * The progress to show for a status. The server sends it; an older server does not, so the
 * status alone is turned into the plainest honest reading: «pending» is being prepared, with no
 * percent. `missing` has nothing on its way and gets none.
 */
export function progressFor(status: LessonRecordingStatus, progress?: RecordingProgress | null): RecordingProgress | null {
  if (progress) return progress;
  const stage: RecordingStage | null = status === 'pending' ? 'processing'
    : status === 'waiting' ? 'waiting_for_google'
      : status === 'missing' ? null
        : status;
  if (!stage) return null;
  return {
    stage, phase: null, phase_percent: null, percent: null, eta_seconds: null, position: null, queue_length: null,
    held_for_disk: false, attempts: 0, max_attempts: 3, error: null, lesson_ended_at: null, missing_after: null,
    claimed_at: null, updated_at: null, sync: null,
  };
}

/** Which attempt the stage is about: the one under way, the one coming, or the last one made. */
function attemptNumber(progress: RecordingProgress): number {
  if (progress.stage === 'retrying') return Math.min(progress.attempts + 1, progress.max_attempts);
  return Math.max(1, progress.attempts);
}

export function stageTitle(progress: RecordingProgress, locale: Locale = activeLocale()): string {
  if (progress.stage === 'queued' && progress.held_for_disk) return t('recordings.stage.onHold', undefined, locale);
  return t(STAGE_TITLE[progress.stage], undefined, locale);
}

/** One sentence: what is happening to the recording right now, and whose move it is. */
export function stageSentence(progress: RecordingProgress, locale: Locale = activeLocale()): string {
  if (progress.held_for_disk && (progress.stage === 'queued' || progress.stage === 'retrying')) {
    return t('recordings.stage.held', undefined, locale);
  }
  return t(STAGE_SENTENCE[progress.stage], undefined, locale);
}

export function phaseLabel(phase: RecordingPhase, locale: Locale = activeLocale()): string {
  return t(PHASE_LABEL[phase], undefined, locale);
}

/** "about 2 min left" — only from a measured rate; nothing when the server did not measure one. */
export function etaText(seconds: number | null | undefined, locale: Locale = activeLocale()): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  return seconds < 60
    ? t('recordings.progress.lessThanMinute', undefined, locale)
    : t('recordings.progress.minutesLeft', { minutes: Math.ceil(seconds / 60) }, locale);
}

/** "3rd in line · 32 waiting" — while the recording waits its turn. */
export function queueText(progress: RecordingProgress, locale: Locale = activeLocale()): string | null {
  if (progress.stage !== 'queued' && progress.stage !== 'retrying') return null;
  if (progress.position && progress.queue_length) {
    return t('recordings.progress.inLine', { position: ordinal(progress.position, locale), total: progress.queue_length }, locale);
  }
  if (progress.queue_length) return t('recordings.progress.lineOnly', { total: progress.queue_length }, locale);
  return null;
}

/** "Retrying · attempt 2 of 3" — only once a first attempt has not gone through. */
export function attemptsText(progress: RecordingProgress, locale: Locale = activeLocale()): string | null {
  const max = progress.max_attempts;
  if (progress.stage === 'retrying') return t('recordings.progress.retryingAttempt', { attempt: attemptNumber(progress), max }, locale);
  if ((progress.stage === 'failed' && progress.attempts > 0) || (progress.stage === 'processing' && progress.attempts > 1)) {
    return t('recordings.progress.attempt', { attempt: progress.attempts, max }, locale);
  }
  return null;
}

/**
 * How far into the step: "64%", or "starting" at 0 — «Uploading · 0%» under a bar already half full
 * read as broken (owner's screenshot, 2026-09-15). Nothing when the step has no measure.
 */
function phaseAmount(progress: RecordingProgress, locale: Locale): string | null {
  const percent = clampPercent(progress.phase_percent);
  if (percent === 0) return t('recordings.progress.starting', undefined, locale);
  return percent != null ? `${percent}%` : null;
}

/** "Downloading from Google Drive · 64% · about 2 min left" — the step under way. */
export function phaseLine(progress: RecordingProgress, locale: Locale = activeLocale()): string | null {
  if (progress.stage !== 'processing' || !progress.phase) return null;
  return [phaseLabel(progress.phase, locale), phaseAmount(progress, locale), etaText(progress.eta_seconds, locale)]
    .filter(Boolean).join(' · ');
}

/** The short label on a library card: "Processing · 42%", "In line · #3", "Retrying 2/3". */
export function badgeText(progress: RecordingProgress, locale: Locale = activeLocale()): string {
  switch (progress.stage) {
    case 'processing': {
      const percent = clampPercent(progress.percent);
      return percent != null
        ? t('recordings.badge.processingPercent', { percent }, locale)
        : t('recordings.badge.processing', undefined, locale);
    }
    case 'queued':
      if (progress.held_for_disk) return t('recordings.stage.onHold', undefined, locale);
      return progress.position
        ? t('recordings.badge.queuedPosition', { position: progress.position }, locale)
        : t('recordings.badge.queued', undefined, locale);
    case 'retrying':
      return t('recordings.badge.retryingAttempt', { attempt: attemptNumber(progress), max: progress.max_attempts }, locale);
    default:
      return t(STAGE_BADGE[progress.stage], undefined, locale);
  }
}

export type ProgressTone = 'progress' | 'warning' | 'danger' | 'neutral' | 'success';

/** Sky while things move, amber when held or retrying, rose when it failed. */
export function stageTone(progress: RecordingProgress): ProgressTone {
  if (progress.stage === 'failed') return 'danger';
  if (progress.stage === 'removed') return 'neutral';
  if (progress.stage === 'ready') return 'success';
  if (progress.stage === 'retrying' || progress.held_for_disk) return 'warning';
  return 'progress';
}

/** The overall percent while preparing, or null — the bar is then indeterminate. */
export function overallPercent(progress: RecordingProgress): number | null {
  return progress.stage === 'processing' ? clampPercent(progress.percent) : null;
}

/** Staff-only: when a lesson still waiting on Google would be flagged as having no recording. */
export function missingAfterText(progress: RecordingProgress, locale: Locale = activeLocale()): string | null {
  if (!progress.missing_after) return null;
  if (progress.stage !== 'lesson_running' && progress.stage !== 'waiting_for_google') return null;
  return t('recordings.progress.missingAfter', { time: clock(progress.missing_after) }, locale);
}

/** "updated 12 s ago" — how fresh the worker's report is. */
export function updatedAgo(iso: string | null | undefined, now: number, locale: Locale = activeLocale()): string | null {
  if (!iso) return null;
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return t('recordings.progress.updatedJustNow', undefined, locale);
  return seconds < 60
    ? t('recordings.progress.updatedSecondsAgo', { seconds }, locale)
    : t('recordings.progress.updatedMinutesAgo', { minutes: Math.floor(seconds / 60) }, locale);
}

/**
 * How often to look again: every few seconds while a step's percent moves, less often while
 * it waits on Google or its turn, never once it is done or failed.
 */
export function pollInterval(progress: RecordingProgress | null | undefined): number | null {
  if (!progress) return null;
  if (progress.stage === 'processing') return 5_000;
  if (isTerminal(progress.stage)) return null;
  return 20_000;
}

export type StepStatus = 'done' | 'active' | 'todo' | 'failed';
export type RecordingStepKey = 'lesson' | 'google' | 'queue' | RecordingPhase | 'ready';

export interface RecordingStep {
  key: RecordingStepKey;
  label: string;
  status: StepStatus;
  detail: string | null;
  /** The step's own percent, while it is the one under way. */
  percent: number | null;
}

const STEP_KEYS: RecordingStepKey[] = ['lesson', 'google', 'queue', ...PHASES, 'ready'];

function activeIndex(progress: RecordingProgress): number {
  switch (progress.stage) {
    case 'lesson_running': return 0;
    case 'waiting_for_google': return 1;
    case 'queued':
    case 'retrying': return 2;
    case 'processing': return 3 + Math.max(0, progress.phase ? PHASES.indexOf(progress.phase) : 0);
    case 'failed': return STEP_KEYS.length - 1;
    default: return STEP_KEYS.length; // ready, removed: every step behind it
  }
}

/** The road from the lesson ending to a watchable recording, each step done, under way or to come. */
export function recordingSteps(progress: RecordingProgress, locale: Locale = activeLocale()): RecordingStep[] {
  const current = activeIndex(progress);
  return STEP_KEYS.map((key, index) => {
    // A failed recording was found and never became watchable; how far its last attempt got is not
    // known, so the steps between are left open rather than ticked.
    const status: StepStatus = progress.stage === 'failed'
      ? (index < 2 ? 'done' : key === 'ready' ? 'failed' : 'todo')
      : index < current ? 'done'
        : index > current ? 'todo'
          : 'active';
    let detail: string | null = null;
    let percent: number | null = null;
    if (key === 'lesson') {
      detail = status === 'active' ? t('recordings.step.inProgress', undefined, locale)
        : progress.lesson_ended_at ? t('recordings.step.ended', { time: clock(progress.lesson_ended_at) }, locale)
          : null;
    } else if (key === 'google' && status === 'done' && progress.claimed_at) {
      detail = t('recordings.step.received', { time: clock(progress.claimed_at) }, locale);
    } else if (key === 'queue' && status === 'active') {
      const line = progress.held_for_disk ? t('recordings.stage.heldShort', undefined, locale) : queueText(progress, locale);
      detail = [line, attemptsText(progress, locale)]
        .filter(Boolean).join(' · ') || null;
    } else if (PHASES.includes(key as RecordingPhase) && status === 'active') {
      percent = clampPercent(progress.phase_percent);
      detail = [phaseAmount(progress, locale), etaText(progress.eta_seconds, locale), attemptsText(progress, locale)]
        .filter(Boolean).join(' · ') || null;
    } else if (key === 'ready' && status === 'failed') {
      detail = attemptsText(progress, locale);
    }
    return { key, label: t(STEP_LABEL[key], undefined, locale), status, detail, percent };
  });
}

/** Library cards still on their way — the ones worth asking about, newest first, one request's worth. */
export function liveEventIds(items: { event_id: number; status: string; progress?: RecordingProgress | null }[], limit = 48): number[] {
  return items
    .filter((item) => item.status !== 'missing' && pollInterval(progressFor(item.status as LessonRecordingStatus, item.progress)) != null)
    .slice(0, limit)
    .map((item) => item.event_id);
}

/** The shortest wait any of those cards asks for, or null when none is on its way. */
export function fastestPoll(items: { status: string; progress?: RecordingProgress | null }[]): number | null {
  const intervals = items
    .map((item) => pollInterval(progressFor(item.status as LessonRecordingStatus, item.progress)))
    .filter((ms): ms is number => ms != null);
  return intervals.length ? Math.min(...intervals) : null;
}

const LIBRARY_STATUSES = new Set(['ready', 'pending', 'failed', 'removed']);

/**
 * A card takes the news in place — status, progress, and once ready its preview and length —
 * and keeps everything else. A library card never turns into `waiting` or `missing`: those
 * describe lessons without a recording row, which the library does not list.
 */
export function mergeRecordingStatus<T extends { status: string; progress?: RecordingProgress | null; poster_url: string | null; duration_seconds: number | null }>(
  item: T,
  entry: { status: string; progress: RecordingProgress | null; poster_url: string | null; duration_seconds: number | null },
): T {
  return {
    ...item,
    status: LIBRARY_STATUSES.has(entry.status) ? entry.status : item.status,
    progress: entry.progress,
    poster_url: entry.poster_url ?? item.poster_url,
    duration_seconds: entry.duration_seconds ?? item.duration_seconds,
  };
}

export interface WorkerLine {
  tone: 'active' | 'idle' | 'slow';
  text: string;
}

/** The recordings worker in one line: working now (on what), slow, or when it last looked and looks next. */
export function workerLine(sync: MeetSync | null | undefined, now: number, locale: Locale = activeLocale()): WorkerLine | null {
  if (!sync) return null;
  if (sync.running) {
    if (sync.slow && sync.started_at) return { tone: 'slow', text: t('recordings.worker.slow', { time: clock(sync.started_at) }, locale) };
    const text = sync.step
      ? t('recordings.worker.checkingNowStep', { step: t(WORKER_STEP[sync.step], undefined, locale) }, locale)
      : t('recordings.worker.checkingNow', undefined, locale);
    return { tone: 'active', text };
  }
  const parts = [sync.finished_at
    ? t('recordings.worker.lastChecked', { time: clock(sync.finished_at) }, locale)
    : t('recordings.worker.notChecked', undefined, locale)];
  if (sync.next_at) {
    parts.push(new Date(sync.next_at).getTime() > now
      ? t('recordings.worker.nextAt', { time: clock(sync.next_at) }, locale)
      : t('recordings.worker.nextStarting', undefined, locale));
  }
  return { tone: 'idle', text: parts.join(' · ') };
}
