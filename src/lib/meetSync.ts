/**
 * A lesson waiting on Google Meet, in words: what it waits for, and what the LMS's check with Meet
 * is doing (2026-09-15). A bare «Loading» read as a slow LMS; the wait is really Google handing the
 * call over and the worker's next check, and both can be said exactly — without promising a time
 * nobody controls.
 */
import { activeLocale, t, type Locale, type MessageKey } from './i18n';
import { clock } from './meetAttendance';
import type {
  MeetSync,
  MeetSyncStep,
  MeetWaiting,
  MeetWaitingCall,
  MeetWaitingStage,
} from '../services/api/meetAttendance';
import '@/lib/i18n/catalogs/meetViews';

const MINUTE = 60_000;

/** How long, never a clock: "less than a minute", "12 min", "1 h 5 min". */
export function spanText(ms: number, locale: Locale = activeLocale()): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE);
  if (minutes < 1) return t('meetViews.sync.lessThanMinute', undefined, locale);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return t('meetViews.sync.spanMinutes', { minutes: rest }, locale);
  return rest
    ? t('meetViews.sync.spanHoursMinutes', { hours, minutes: rest }, locale)
    : t('meetViews.sync.spanHours', { hours }, locale);
}

export function agoText(iso: string, now: number, locale: Locale = activeLocale()): string {
  const ms = now - new Date(iso).getTime();
  return ms < MINUTE ? t('meetViews.sync.justNow', undefined, locale) : t('meetViews.sync.ago', { span: spanText(ms, locale) }, locale);
}

const STEP_KEY: Record<MeetSyncStep, MessageKey> = {
  links: 'meetViews.sync.stepLinks',
  rooms: 'meetViews.sync.stepRooms',
  claimed: 'meetViews.sync.stepClaimed',
  attendance: 'meetViews.sync.savingWhoJoined',
  register: 'meetViews.sync.stepRegister',
  speech: 'meetViews.sync.stepSpeech',
  ingested: 'meetViews.sync.stepIngested',
  transcribed: 'meetViews.sync.stepTranscribed',
  missing: 'meetViews.sync.stepMissing',
};

const STAGE_KEY: Record<MeetWaitingStage, MessageKey> = {
  lesson_running: 'meetViews.sync.lessonRunning',
  call_open: 'meetViews.sync.callOpen',
  collecting: 'meetViews.sync.savingWhoJoined',
  awaiting_google: 'meetViews.sync.waiting',
  settling: 'meetViews.sync.almostReady',
};

/** What the worker is doing, in words: "Saving who joined". */
export function stepLabel(step: MeetSyncStep, locale: Locale = activeLocale()): string {
  return t(STEP_KEY[step], undefined, locale);
}

/** A waiting lesson's stage as a title: "Lesson in progress". */
export function stageTitle(stage: MeetWaitingStage, locale: Locale = activeLocale()): string {
  return t(STAGE_KEY[stage], undefined, locale);
}

/** The worker's steps in the signed-in user's language, for code that reads them as a table. */
export const STEP_LABEL: Readonly<Record<MeetSyncStep, string>> = Object.defineProperties(
  {} as Record<MeetSyncStep, string>,
  Object.fromEntries((Object.keys(STEP_KEY) as MeetSyncStep[]).map((step) => [step, { get: () => stepLabel(step), enumerable: true }])),
);

/** The stages in the signed-in user's language, for code that reads them as a table. */
export const STAGE_TITLE: Readonly<Record<MeetWaitingStage, string>> = Object.defineProperties(
  {} as Record<MeetWaitingStage, string>,
  Object.fromEntries((Object.keys(STAGE_KEY) as MeetWaitingStage[]).map((stage) => [stage, { get: () => stageTitle(stage), enumerable: true }])),
);

// The banner's words per stage, in the order a lesson moves through them: the whole sentence when
// every lesson is at that stage, and the part when stages are mixed.
const BANNER_STAGE: [MeetWaitingStage, { whole: MessageKey; part: MessageKey }][] = [
  ['lesson_running', { whole: 'meetViews.sync.bannerRunning', part: 'meetViews.sync.partRunning' }],
  ['call_open', { whole: 'meetViews.sync.bannerCallOpen', part: 'meetViews.sync.partCallOpen' }],
  ['awaiting_google', { whole: 'meetViews.sync.bannerAwaiting', part: 'meetViews.sync.partAwaiting' }],
  ['collecting', { whole: 'meetViews.sync.bannerCollecting', part: 'meetViews.sync.partCollecting' }],
  ['settling', { whole: 'meetViews.sync.bannerSettling', part: 'meetViews.sync.partSettling' }],
];

/**
 * The review page's banner, stage by stage (2026-09-17): a lesson still on read «1 lesson is waiting
 * for Google Meet to hand over its call», because every lesson not final yet was said as that one stage.
 * «1 lesson in progress»; «2 lessons not final yet: 1 in progress · 1 waiting for Google Meet to hand
 * over its call». A lesson without a stage is counted as waiting for Google Meet.
 */
export function waitingBannerText(lessons: (MeetWaiting | null | undefined)[], locale: Locale = activeLocale()): string {
  const total = lessons.length;
  if (total === 0) return t('meetViews.sync.syncing', undefined, locale);
  const counts = new Map<MeetWaitingStage, number>();
  for (const waiting of lessons) {
    const stage = waiting?.stage ?? 'awaiting_google';
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  const present = BANNER_STAGE.filter(([stage]) => counts.has(stage));
  if (present.length === 1) return t(present[0][1].whole, { count: total }, locale);
  const parts = present.map(([stage, keys]) => t(keys.part, { count: counts.get(stage)! }, locale)).join(' · ');
  return t('meetViews.sync.bannerMixed', { count: total, parts }, locale);
}

const roomChecks = (calls: MeetWaitingCall[]) => calls.filter((c) => !c.lesson_call && c.started_at);

/** One sentence: what the lesson is waiting for right now. */
export function stageText(waiting: MeetWaiting, locale: Locale = activeLocale()): string {
  switch (waiting.stage) {
    case 'lesson_running':
      return t('meetViews.sync.stageRunning', { time: clock(waiting.ended_at) }, locale);
    case 'call_open':
      return t('meetViews.sync.stageCallOpen', undefined, locale);
    case 'collecting':
      return t('meetViews.sync.stageCollecting', undefined, locale);
    case 'awaiting_google': {
      const checks = roomChecks(waiting.calls).length;
      return checks
        ? t('meetViews.sync.stageAwaitingChecks', { count: checks }, locale)
        : t('meetViews.sync.stageAwaiting', undefined, locale);
    }
    case 'settling':
      return t('meetViews.sync.stageSettling', { time: clock(waiting.ready_at) }, locale);
    default:
      return t('meetViews.sync.stageUnknown', undefined, locale);
  }
}

/** "Lesson ended 20:00 · waiting 1 h 25 min"; while the lesson is on, when it ends. */
export function waitedText(waiting: MeetWaiting, now: number, locale: Locale = activeLocale()): string {
  const ended = new Date(waiting.ended_at).getTime();
  if (now < ended) return t('meetViews.sync.endsAt', { time: clock(waiting.ended_at) }, locale);
  return t('meetViews.sync.endedWaiting', { time: clock(waiting.ended_at), span: spanText(now - ended, locale) }, locale);
}

/** Only while Google may never hand the call over: when the lesson is judged on what there is. */
export function judgeText(waiting: MeetWaiting, locale: Locale = activeLocale()): string | null {
  if (waiting.stage !== 'awaiting_google' && waiting.stage !== 'call_open') return null;
  return t('meetViews.sync.judge', { time: clock(waiting.judge_at) }, locale);
}

export type StepStatus = 'done' | 'active' | 'todo';

export interface WaitingStep {
  key: 'ended' | 'handed_over' | 'saved' | 'compared';
  label: string;
  status: StepStatus;
  detail: string | null;
}

function callSpan(calls: MeetWaitingCall[], locale: Locale): string | null {
  const lesson = calls.filter((c) => c.lesson_call && c.started_at);
  if (!lesson.length) return null;
  const last = lesson[lesson.length - 1].ended_at;
  const from = clock(lesson[0].started_at);
  return last ? t('meetViews.sync.callSpan', { from, to: clock(last) }, locale) : t('meetViews.sync.callSpanOpen', { from }, locale);
}

function nextCheckText(sync: MeetSync | null | undefined, now: number, locale: Locale): string {
  if (sync?.running) {
    if (sync.step === 'attendance' && sync.progress?.total) {
      return t('meetViews.sync.callsSaved', { done: sync.progress.done, total: sync.progress.total }, locale);
    }
    return t('meetViews.sync.inThisCheck', undefined, locale);
  }
  if (sync?.next_at && new Date(sync.next_at).getTime() > now) return t('meetViews.sync.inNextCheckAt', { time: clock(sync.next_at) }, locale);
  return t('meetViews.sync.inNextCheck', undefined, locale);
}

/** The four steps between a lesson ending and its record opening, each done, under way or still to come. */
export function waitingSteps(waiting: MeetWaiting, sync: MeetSync | null | undefined, now: number, locale: Locale = activeLocale()): WaitingStep[] {
  const { stage } = waiting;
  const running = stage === 'lesson_running';
  const handedOver = stage === 'collecting' || stage === 'settling';
  const checks = roomChecks(waiting.calls);
  const ended = new Date(waiting.ended_at).getTime();

  let handoverDetail: string | null = null;
  if (handedOver) handoverDetail = callSpan(waiting.calls, locale);
  else if (stage === 'call_open') handoverDetail = t('meetViews.sync.callStillOpen', undefined, locale);
  else if (stage === 'awaiting_google') {
    const span = spanText(now - ended, locale);
    handoverDetail = checks.length
      ? t('meetViews.sync.waitingForChecks', { span, times: checks.map((c) => clock(c.started_at)).join(', ') }, locale)
      : t('meetViews.sync.waitingFor', { span }, locale);
  }

  return [
    { key: 'ended', label: t(running ? 'meetViews.sync.lessonRunning' : 'meetViews.sync.lessonEnded', undefined, locale), status: running ? 'active' : 'done',
      detail: running ? t('meetViews.sync.endsAt', { time: clock(waiting.ended_at) }, locale) : clock(waiting.ended_at) },
    { key: 'handed_over', label: t('meetViews.sync.handsOver', undefined, locale), status: handedOver ? 'done' : running ? 'todo' : 'active',
      detail: handoverDetail },
    { key: 'saved', label: t('meetViews.sync.whoJoinedSaved', undefined, locale), status: stage === 'settling' ? 'done' : stage === 'collecting' ? 'active' : 'todo',
      detail: stage === 'collecting' ? nextCheckText(sync, now, locale) : null },
    { key: 'compared', label: t('meetViews.sync.compared', undefined, locale), status: stage === 'settling' ? 'active' : 'todo',
      detail: stage === 'settling' ? t('meetViews.sync.at', { time: clock(waiting.ready_at) }, locale) : null },
  ];
}

export interface SyncStatus {
  tone: 'active' | 'idle' | 'slow';
  text: string;
}

/** The LMS's check with Google Meet, in one line: under way (which step, how far), or when it last ran and runs next. */
export function syncStatus(sync: MeetSync | null | undefined, now: number, locale: Locale = activeLocale()): SyncStatus | null {
  if (!sync) return null;
  if (sync.running) {
    if (sync.slow && sync.started_at) {
      return { tone: 'slow', text: t('meetViews.sync.slow', { time: clock(sync.started_at) }, locale) };
    }
    const parts = [t('meetViews.sync.checkingNow', undefined, locale)];
    if (sync.step) parts.push(stepLabel(sync.step, locale));
    if (sync.step === 'attendance' && sync.progress?.total) {
      parts.push(t('meetViews.sync.callsProgress', { done: sync.progress.done, total: sync.progress.total }, locale));
    }
    return { tone: 'active', text: parts.join(' · ') };
  }
  const last = sync.attendance_at ?? sync.finished_at;
  const parts = [last
    ? t('meetViews.sync.lastChecked', { time: clock(last), ago: agoText(last, now, locale) }, locale)
    : t('meetViews.sync.neverChecked', undefined, locale)];
  if (sync.next_at) {
    parts.push(new Date(sync.next_at).getTime() > now
      ? t('meetViews.sync.nextCheckAt', { time: clock(sync.next_at) }, locale)
      : t('meetViews.sync.nextCheckStarting', undefined, locale));
  }
  return { tone: 'idle', text: parts.join(' · ') };
}
