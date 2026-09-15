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
import type { Locale } from './recordings';
import type {
  LessonRecordingStatus,
  RecordingPhase,
  RecordingProgress,
  RecordingStage,
} from '../services/api/recordings';
import type { MeetSync, MeetSyncStep } from '../services/api/meetAttendance';

export const PHASES: RecordingPhase[] = ['downloading', 'packaging', 'preview', 'uploading'];

const EN_SUFFIX = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
};

const TEXT = {
  en: {
    title: {
      lesson_running: 'Lesson in progress',
      waiting_for_google: 'Waiting for Google Meet',
      queued: 'In line',
      processing: 'Preparing the recording',
      retrying: 'Trying again',
      ready: 'Ready to watch',
      failed: 'Could not prepare the recording',
      removed: 'No longer available',
    } as Record<RecordingStage, string>,
    onHold: 'On hold',
    sentence: {
      lesson_running: 'The recording appears after the lesson, once Google Meet has finished it.',
      waiting_for_google: 'The lesson is over. Google Meet is finishing the recording file; the LMS picks it up as soon as it is there.',
      queued: 'Google Meet has handed over the recording. It is waiting its turn to be prepared for watching.',
      processing: 'The LMS is preparing the recording for watching.',
      retrying: 'The last attempt did not finish. The LMS tries again by itself.',
      ready: 'The recording is ready to watch.',
      failed: 'The LMS tried several times and could not prepare this recording.',
      removed: 'This recording is no longer available.',
    } as Record<RecordingStage, string>,
    held: 'Recordings are paused while the server frees up disk space. They carry on by themselves.',
    heldShort: 'Paused while the server frees up disk space',
    phase: {
      downloading: 'Downloading from Google Drive',
      packaging: 'Preparing for streaming',
      preview: 'Making a preview',
      uploading: 'Uploading',
    } as Record<RecordingPhase, string>,
    badge: {
      lesson_running: 'Lesson in progress',
      waiting_for_google: 'Waiting for Google Meet',
      queued: 'In line',
      processing: 'Processing',
      retrying: 'Retrying',
      ready: 'Ready',
      failed: 'Could not process',
      removed: 'No longer available',
    } as Record<RecordingStage, string>,
    position: (n: number) => `#${n}`,
    lessThanMinute: 'less than a minute left',
    minutesLeft: (m: number) => `about ${m} min left`,
    inLine: (n: number, total: number) => `${n}${EN_SUFFIX(n)} in line · ${total} waiting`,
    lineOnly: (total: number) => `${total} in line`,
    attempt: (n: number, max: number) => `Attempt ${n} of ${max}`,
    retrying: (n: number, max: number) => `Retrying · attempt ${n} of ${max}`,
    missingAfter: (time: string) => `If nothing arrives by ${time}, the lesson is flagged as having no recording.`,
    justNow: 'updated just now',
    secondsAgo: (n: number) => `updated ${n} s ago`,
    minutesAgo: (n: number) => `updated ${n} min ago`,
    steps: {
      lesson: 'Lesson ends',
      google: 'Google Meet finishes the recording',
      queue: 'In line',
      downloading: 'Downloading',
      packaging: 'Preparing for streaming',
      preview: 'Making a preview',
      uploading: 'Uploading',
      ready: 'Ready to watch',
    },
    ended: (time: string) => `Ended ${time}`,
    inProgress: 'In progress',
    received: (time: string) => `Received ${time}`,
    worker: {
      links: 'preparing rooms for upcoming lessons',
      rooms: 'updating room settings',
      claimed: 'looking for new recordings',
      attendance: 'saving who joined',
      speech: 'reading who spoke',
      ingested: 'preparing recordings',
      transcribed: 'transcribing lessons',
      missing: 'checking for lessons without a recording',
    } as Record<MeetSyncStep, string>,
    checkingNow: (step: string | null) => `Checking now${step ? ` · ${step}` : ''}`,
    slow: (time: string) => `Checking since ${time} — taking longer than usual`,
    lastChecked: (time: string) => `Last checked ${time}`,
    nextAt: (time: string) => `next check at ${time}`,
    nextStarting: 'next check starting',
    notChecked: 'Not checked yet',
  },
  ru: {
    title: {
      lesson_running: 'Урок ещё идёт',
      waiting_for_google: 'Ждём Google Meet',
      queued: 'В очереди',
      processing: 'Готовим запись',
      retrying: 'Пробуем ещё раз',
      ready: 'Готова к просмотру',
      failed: 'Не удалось подготовить запись',
      removed: 'Больше недоступна',
    } as Record<RecordingStage, string>,
    onHold: 'Пауза',
    sentence: {
      lesson_running: 'Запись появится после урока, когда Google Meet её закончит.',
      waiting_for_google: 'Урок закончился. Google Meet дописывает файл записи — LMS заберёт его, как только он появится.',
      queued: 'Google Meet передал запись. Она ждёт своей очереди на подготовку к просмотру.',
      processing: 'LMS готовит запись к просмотру.',
      retrying: 'Прошлая попытка не завершилась. LMS попробует ещё раз сама.',
      ready: 'Запись готова к просмотру.',
      failed: 'LMS несколько раз пыталась и не смогла подготовить эту запись.',
      removed: 'Эта запись больше недоступна.',
    } as Record<RecordingStage, string>,
    held: 'Записи на паузе: сервер освобождает место на диске. Всё продолжится само.',
    heldShort: 'Пауза: сервер освобождает место на диске',
    phase: {
      downloading: 'Скачиваем из Google Drive',
      packaging: 'Готовим к просмотру',
      preview: 'Делаем превью',
      uploading: 'Загружаем',
    } as Record<RecordingPhase, string>,
    badge: {
      lesson_running: 'Урок идёт',
      waiting_for_google: 'Ждём Google Meet',
      queued: 'В очереди',
      processing: 'Обрабатывается',
      retrying: 'Повтор',
      ready: 'Готова',
      failed: 'Не обработалась',
      removed: 'Больше недоступна',
    } as Record<RecordingStage, string>,
    position: (n: number) => `№${n}`,
    lessThanMinute: 'осталось меньше минуты',
    minutesLeft: (m: number) => `осталось около ${m} мин`,
    inLine: (n: number, total: number) => `${n}-я в очереди · всего ${total}`,
    lineOnly: (total: number) => `в очереди: ${total}`,
    attempt: (n: number, max: number) => `Попытка ${n} из ${max}`,
    retrying: (n: number, max: number) => `Повтор · попытка ${n} из ${max}`,
    missingAfter: (time: string) => `Если запись не придёт до ${time}, урок будет отмечен как урок без записи.`,
    justNow: 'обновлено только что',
    secondsAgo: (n: number) => `обновлено ${n} с назад`,
    minutesAgo: (n: number) => `обновлено ${n} мин назад`,
    steps: {
      lesson: 'Урок заканчивается',
      google: 'Google Meet заканчивает запись',
      queue: 'Очередь',
      downloading: 'Скачивание',
      packaging: 'Подготовка к просмотру',
      preview: 'Превью',
      uploading: 'Загрузка',
      ready: 'Готово к просмотру',
    },
    ended: (time: string) => `Закончился в ${time}`,
    inProgress: 'Идёт',
    received: (time: string) => `Получена в ${time}`,
    worker: {
      links: 'готовим комнаты для уроков',
      rooms: 'настраиваем комнаты',
      claimed: 'ищем новые записи',
      attendance: 'сохраняем участников',
      speech: 'смотрим, кто говорил',
      ingested: 'готовим записи',
      transcribed: 'расшифровываем уроки',
      missing: 'проверяем уроки без записи',
    } as Record<MeetSyncStep, string>,
    checkingNow: (step: string | null) => `Сейчас идёт проверка${step ? ` · ${step}` : ''}`,
    slow: (time: string) => `Проверка идёт с ${time} — дольше обычного`,
    lastChecked: (time: string) => `Последняя проверка в ${time}`,
    nextAt: (time: string) => `следующая в ${time}`,
    nextStarting: 'следующая начинается',
    notChecked: 'Проверки ещё не было',
  },
} as const;

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

export function stageTitle(progress: RecordingProgress, locale: Locale = 'en'): string {
  const t = TEXT[locale];
  if (progress.stage === 'queued' && progress.held_for_disk) return t.onHold;
  return t.title[progress.stage];
}

/** One sentence: what is happening to the recording right now, and whose move it is. */
export function stageSentence(progress: RecordingProgress, locale: Locale = 'en'): string {
  const t = TEXT[locale];
  if (progress.held_for_disk && (progress.stage === 'queued' || progress.stage === 'retrying')) return t.held;
  return t.sentence[progress.stage];
}

export function phaseLabel(phase: RecordingPhase, locale: Locale = 'en'): string {
  return TEXT[locale].phase[phase];
}

/** "about 2 min left" — only from a measured rate; nothing when the server did not measure one. */
export function etaText(seconds: number | null | undefined, locale: Locale = 'en'): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const t = TEXT[locale];
  return seconds < 60 ? t.lessThanMinute : t.minutesLeft(Math.ceil(seconds / 60));
}

/** "3rd in line · 32 waiting" — while the recording waits its turn. */
export function queueText(progress: RecordingProgress, locale: Locale = 'en'): string | null {
  if (progress.stage !== 'queued' && progress.stage !== 'retrying') return null;
  const t = TEXT[locale];
  if (progress.position && progress.queue_length) return t.inLine(progress.position, progress.queue_length);
  if (progress.queue_length) return t.lineOnly(progress.queue_length);
  return null;
}

/** "Retrying · attempt 2 of 3" — only once a first attempt has not gone through. */
export function attemptsText(progress: RecordingProgress, locale: Locale = 'en'): string | null {
  const t = TEXT[locale];
  if (progress.stage === 'retrying') return t.retrying(attemptNumber(progress), progress.max_attempts);
  if (progress.stage === 'failed' && progress.attempts > 0) return t.attempt(progress.attempts, progress.max_attempts);
  if (progress.stage === 'processing' && progress.attempts > 1) return t.attempt(progress.attempts, progress.max_attempts);
  return null;
}

/** "Downloading from Google Drive · 64% · about 2 min left" — the step under way. */
export function phaseLine(progress: RecordingProgress, locale: Locale = 'en'): string | null {
  if (progress.stage !== 'processing' || !progress.phase) return null;
  const percent = clampPercent(progress.phase_percent);
  return [phaseLabel(progress.phase, locale), percent != null ? `${percent}%` : null, etaText(progress.eta_seconds, locale)]
    .filter(Boolean).join(' · ');
}

/** The short label on a library card: "Processing · 42%", "In line · #3", "Retrying 2/3". */
export function badgeText(progress: RecordingProgress, locale: Locale = 'en'): string {
  const t = TEXT[locale];
  switch (progress.stage) {
    case 'processing': {
      const percent = clampPercent(progress.percent);
      return percent != null ? `${t.badge.processing} · ${percent}%` : t.badge.processing;
    }
    case 'queued':
      if (progress.held_for_disk) return t.onHold;
      return progress.position ? `${t.badge.queued} · ${t.position(progress.position)}` : t.badge.queued;
    case 'retrying':
      return `${t.badge.retrying} ${attemptNumber(progress)}/${progress.max_attempts}`;
    default:
      return t.badge[progress.stage];
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
export function missingAfterText(progress: RecordingProgress, locale: Locale = 'en'): string | null {
  if (!progress.missing_after) return null;
  if (progress.stage !== 'lesson_running' && progress.stage !== 'waiting_for_google') return null;
  return TEXT[locale].missingAfter(clock(progress.missing_after));
}

/** "updated 12 s ago" — how fresh the worker's report is. */
export function updatedAgo(iso: string | null | undefined, now: number, locale: Locale = 'en'): string | null {
  if (!iso) return null;
  const t = TEXT[locale];
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return t.justNow;
  return seconds < 60 ? t.secondsAgo(seconds) : t.minutesAgo(Math.floor(seconds / 60));
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
export function recordingSteps(progress: RecordingProgress, locale: Locale = 'en'): RecordingStep[] {
  const t = TEXT[locale];
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
      detail = status === 'active' ? t.inProgress : progress.lesson_ended_at ? t.ended(clock(progress.lesson_ended_at)) : null;
    } else if (key === 'google' && status === 'done' && progress.claimed_at) {
      detail = t.received(clock(progress.claimed_at));
    } else if (key === 'queue' && status === 'active') {
      detail = [progress.held_for_disk ? t.heldShort : queueText(progress, locale), attemptsText(progress, locale)]
        .filter(Boolean).join(' · ') || null;
    } else if (PHASES.includes(key as RecordingPhase) && status === 'active') {
      percent = clampPercent(progress.phase_percent);
      detail = [percent != null ? `${percent}%` : null, etaText(progress.eta_seconds, locale), attemptsText(progress, locale)]
        .filter(Boolean).join(' · ') || null;
    } else if (key === 'ready' && status === 'failed') {
      detail = attemptsText(progress, locale);
    }
    return { key, label: t.steps[key], status, detail, percent };
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
export function workerLine(sync: MeetSync | null | undefined, now: number, locale: Locale = 'en'): WorkerLine | null {
  if (!sync) return null;
  const t = TEXT[locale];
  if (sync.running) {
    if (sync.slow && sync.started_at) return { tone: 'slow', text: t.slow(clock(sync.started_at)) };
    return { tone: 'active', text: t.checkingNow(sync.step ? t.worker[sync.step] : null) };
  }
  const parts = [sync.finished_at ? t.lastChecked(clock(sync.finished_at)) : t.notChecked];
  if (sync.next_at) parts.push(new Date(sync.next_at).getTime() > now ? t.nextAt(clock(sync.next_at)) : t.nextStarting);
  return { tone: 'idle', text: parts.join(' · ') };
}
