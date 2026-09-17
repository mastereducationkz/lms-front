/**
 * A lesson waiting on Google Meet, in words: what it waits for, and what the LMS's check with Meet
 * is doing (2026-09-15). A bare «Loading» read as a slow LMS; the wait is really Google handing the
 * call over and the worker's next check, and both can be said exactly — without promising a time
 * nobody controls.
 */
import { clock } from './meetAttendance';
import type {
  MeetSync,
  MeetSyncStep,
  MeetWaiting,
  MeetWaitingCall,
  MeetWaitingStage,
} from '../services/api/meetAttendance';

const MINUTE = 60_000;

/** How long, never a clock: "less than a minute", "12 min", "1 h 5 min". */
export function spanText(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE);
  if (minutes < 1) return 'less than a minute';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function agoText(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  return ms < MINUTE ? 'just now' : `${spanText(ms)} ago`;
}

export const STEP_LABEL: Record<MeetSyncStep, string> = {
  links: 'Preparing rooms for upcoming lessons',
  rooms: 'Updating room settings',
  claimed: 'Looking for new recordings',
  attendance: 'Saving who joined',
  speech: 'Reading who spoke',
  ingested: 'Saving recordings',
  transcribed: 'Transcribing lessons',
  missing: 'Checking for missing recordings',
};

export const STAGE_TITLE: Record<MeetWaitingStage, string> = {
  lesson_running: 'Lesson in progress',
  call_open: 'Call still open in Meet',
  collecting: 'Saving who joined',
  awaiting_google: 'Waiting for Google Meet',
  settling: 'Almost ready',
};

// The banner's words per stage, in the order a lesson moves through them.
const BANNER_STAGE: [MeetWaitingStage, (n: number) => string][] = [
  ['lesson_running', () => 'in progress'],
  ['call_open', (n) => `with ${n === 1 ? 'its call' : 'their calls'} still open in Google Meet`],
  ['awaiting_google', (n) => `waiting for Google Meet to hand over ${n === 1 ? 'its call' : 'their calls'}`],
  ['collecting', () => 'saving who joined'],
  ['settling', () => 'almost ready'],
];

/**
 * The review page's banner, stage by stage (2026-09-17): a lesson still on read «1 lesson is waiting
 * for Google Meet to hand over its call», because every lesson not final yet was said as that one stage.
 * «1 lesson in progress»; «2 lessons not final yet: 1 in progress · 1 waiting for Google Meet to hand
 * over its call». A lesson without a stage is counted as waiting for Google Meet.
 */
export function waitingBannerText(lessons: (MeetWaiting | null | undefined)[]): string {
  const total = lessons.length;
  if (total === 0) return 'Syncing with Google Meet';
  const counts = new Map<MeetWaitingStage, number>();
  for (const waiting of lessons) {
    const stage = waiting?.stage ?? 'awaiting_google';
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  const present = BANNER_STAGE.filter(([stage]) => counts.has(stage));
  const noun = (n: number) => `${n} lesson${n === 1 ? '' : 's'}`;
  if (present.length === 1) {
    const [stage, words] = present[0];
    return `${noun(total)}${stage === 'collecting' ? ': ' : ' '}${words(total)}`;
  }
  return `${noun(total)} not final yet: ${present.map(([stage, words]) => `${counts.get(stage)} ${words(counts.get(stage)!)}`).join(' · ')}`;
}

const roomChecks = (calls: MeetWaitingCall[]) => calls.filter((c) => !c.lesson_call && c.started_at);

/** One sentence: what the lesson is waiting for right now. */
export function stageText(waiting: MeetWaiting): string {
  switch (waiting.stage) {
    case 'lesson_running':
      return `Who joined is read after the lesson ends at ${clock(waiting.ended_at)}.`;
    case 'call_open':
      return 'Google Meet still shows the call as open. Who joined is read once everyone has left.';
    case 'collecting':
      return 'Google Meet has handed over the call. The LMS is saving who joined and when.';
    case 'awaiting_google': {
      const checks = roomChecks(waiting.calls).length;
      return checks
        ? `Google Meet hasn’t handed over the lesson’s call yet — so far only ${checks} short room check${checks === 1 ? '' : 's'}.`
        : 'Google Meet hasn’t handed over the lesson’s call yet.';
    }
    case 'settling':
      return `The lesson’s call is saved. It is compared with the marks at ${clock(waiting.ready_at)}, in case anyone rejoins.`;
    default:
      return 'Waiting for Google Meet.';
  }
}

/** "Lesson ended 20:00 · waiting 1 h 25 min"; while the lesson is on, when it ends. */
export function waitedText(waiting: MeetWaiting, now: number): string {
  const ended = new Date(waiting.ended_at).getTime();
  if (now < ended) return `Ends at ${clock(waiting.ended_at)}`;
  return `Lesson ended ${clock(waiting.ended_at)} · waiting ${spanText(now - ended)}`;
}

/** Only while Google may never hand the call over: when the lesson is judged on what there is. */
export function judgeText(waiting: MeetWaiting): string | null {
  if (waiting.stage !== 'awaiting_google' && waiting.stage !== 'call_open') return null;
  return `If the call never comes through, the lesson is checked with what there is at ${clock(waiting.judge_at)}.`;
}

export type StepStatus = 'done' | 'active' | 'todo';

export interface WaitingStep {
  key: 'ended' | 'handed_over' | 'saved' | 'compared';
  label: string;
  status: StepStatus;
  detail: string | null;
}

function callSpan(calls: MeetWaitingCall[]): string | null {
  const lesson = calls.filter((c) => c.lesson_call && c.started_at);
  if (!lesson.length) return null;
  const last = lesson[lesson.length - 1].ended_at;
  return `Call ${clock(lesson[0].started_at)}–${last ? clock(last) : 'still open'}`;
}

function nextCheckText(sync: MeetSync | null | undefined, now: number): string {
  if (sync?.running) {
    if (sync.step === 'attendance' && sync.progress?.total) return `${sync.progress.done} of ${sync.progress.total} calls saved`;
    return 'In the check under way';
  }
  if (sync?.next_at && new Date(sync.next_at).getTime() > now) return `In the next check, at ${clock(sync.next_at)}`;
  return 'In the next check';
}

/** The four steps between a lesson ending and its record opening, each done, under way or still to come. */
export function waitingSteps(waiting: MeetWaiting, sync: MeetSync | null | undefined, now: number): WaitingStep[] {
  const { stage } = waiting;
  const running = stage === 'lesson_running';
  const handedOver = stage === 'collecting' || stage === 'settling';
  const checks = roomChecks(waiting.calls);
  const ended = new Date(waiting.ended_at).getTime();

  let handoverDetail: string | null = null;
  if (handedOver) handoverDetail = callSpan(waiting.calls);
  else if (stage === 'call_open') handoverDetail = 'The call is still open in Meet';
  else if (stage === 'awaiting_google') {
    handoverDetail = `Waiting ${spanText(now - ended)}`;
    if (checks.length) handoverDetail += ` · room checks at ${checks.map((c) => clock(c.started_at)).join(', ')}`;
  }

  return [
    { key: 'ended', label: running ? 'Lesson in progress' : 'Lesson ended', status: running ? 'active' : 'done',
      detail: running ? `Ends at ${clock(waiting.ended_at)}` : clock(waiting.ended_at) },
    { key: 'handed_over', label: 'Google Meet hands over the call', status: handedOver ? 'done' : running ? 'todo' : 'active',
      detail: handoverDetail },
    { key: 'saved', label: 'Who joined is saved', status: stage === 'settling' ? 'done' : stage === 'collecting' ? 'active' : 'todo',
      detail: stage === 'collecting' ? nextCheckText(sync, now) : null },
    { key: 'compared', label: 'Compared with the marks', status: stage === 'settling' ? 'active' : 'todo',
      detail: stage === 'settling' ? `At ${clock(waiting.ready_at)}` : null },
  ];
}

export interface SyncStatus {
  tone: 'active' | 'idle' | 'slow';
  text: string;
}

/** The LMS's check with Google Meet, in one line: under way (which step, how far), or when it last ran and runs next. */
export function syncStatus(sync: MeetSync | null | undefined, now: number): SyncStatus | null {
  if (!sync) return null;
  if (sync.running) {
    if (sync.slow && sync.started_at) {
      return { tone: 'slow', text: `Checking Google Meet since ${clock(sync.started_at)} — taking longer than usual` };
    }
    const step = sync.step ? ` · ${STEP_LABEL[sync.step]}` : '';
    const progress = sync.step === 'attendance' && sync.progress?.total
      ? ` · ${sync.progress.done} of ${sync.progress.total} calls` : '';
    return { tone: 'active', text: `Checking Google Meet now${step}${progress}` };
  }
  const last = sync.attendance_at ?? sync.finished_at;
  const parts = [last ? `Last checked with Google Meet at ${clock(last)} (${agoText(last, now)})` : 'Not checked with Google Meet yet'];
  if (sync.next_at) parts.push(new Date(sync.next_at).getTime() > now ? `next check at ${clock(sync.next_at)}` : 'next check starting');
  return { tone: 'idle', text: parts.join(' · ') };
}
