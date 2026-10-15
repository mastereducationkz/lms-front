import type { HoldState, LessonRequest } from '../types';
import { fromDatetimeLocalKZ } from './datetime';
import type { MessageKey } from './i18n';
import '@/lib/i18n/catalogs/lessonRequests';

/**
 * «Временная отмена»: a lesson that cannot be held, with no new time agreed yet.
 *
 * The lesson waits off the calendar; a head teacher or admin later sets its new time, turns it into a
 * real cancel, or puts it back at its original time. Pure rules only — the page owns the fetching.
 */

type HoldLike = Pick<LessonRequest, 'request_type' | 'hold_state'>;

/** A hold that still needs somebody to say when the lesson comes back. */
export const isWaitingHold = (req: HoldLike): boolean => req.request_type === 'hold' && req.hold_state === 'waiting';

/** Still open from the teacher's side: waiting for a decision, or approved and waiting for a time. */
export const isOpenRequest = (req: HoldLike & Pick<LessonRequest, 'status'>): boolean =>
  req.status === 'pending' || req.status === 'pending_teacher' || isWaitingHold(req);

const STATE_LABELS: Record<HoldState, MessageKey> = {
  waiting: 'lessonRequests.hold.state.waiting',
  scheduled: 'lessonRequests.hold.state.scheduled',
  cancelled: 'lessonRequests.hold.state.cancelled',
  restored: 'lessonRequests.hold.state.restored',
};

/** The words for where a held lesson is; `null` for a request that is not a hold. */
export const holdStateLabelKey = (req: HoldLike): MessageKey | null =>
  req.request_type === 'hold' && req.hold_state ? STATE_LABELS[req.hold_state] ?? null : null;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since the hold was approved (at least 1 once it has waited that long); `null` when unknown. */
export function daysWaiting(resolvedAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!resolvedAt) return null;
  const since = Date.parse(resolvedAt);
  if (Number.isNaN(since)) return null;
  return Math.max(0, Math.floor((now.getTime() - since) / DAY_MS));
}

/** «Вернуть на прежнее время» is only offered while that time is still ahead — the server refuses after. */
export function canRestoreHold(
  req: HoldLike & Pick<LessonRequest, 'lesson_start_datetime'>,
  now: Date = new Date(),
): boolean {
  if (!isWaitingHold(req) || !req.lesson_start_datetime) return false;
  const start = Date.parse(req.lesson_start_datetime);
  return !Number.isNaN(start) && start > now.getTime();
}

/**
 * Checks the `datetime-local` value a head typed as the lesson's new time (school time, as everywhere):
 * what is wrong with it, or `null`. The server checks again — a clash with another lesson of the group
 * can only be known there.
 */
export function newTimeProblem(local: string, now: Date = new Date()): 'empty' | 'past' | null {
  if (!local || !local.includes('T')) return 'empty';
  const at = Date.parse(fromDatetimeLocalKZ(local));
  if (Number.isNaN(at)) return 'empty';
  return at <= now.getTime() ? 'past' : null;
}
