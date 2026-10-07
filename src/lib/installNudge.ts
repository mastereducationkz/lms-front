/**
 * When the dashboard may invite someone to install the app (owner, 2026-10-07):
 *  - never on the first visit;
 *  - after about three distinct days of use, or after the first homework submission;
 *  - «Not now» snoozes it for 14 days; after the third dismissal it never comes back;
 *  - never once the app is installed.
 * Pure state transitions over a small JSON blob that `src/services/pwaInstall.ts` keeps in
 * localStorage per user. Days are calendar-day strings ("2026-10-07") the caller computes.
 */
export interface NudgeState {
  /** Distinct days with a visit, oldest first. Only the first few matter, so it's capped. */
  days: string[];
  /** First homework submission (ms). */
  submittedAt: number | null;
  dismissals: number;
  snoozedUntil: number | null;
  installedAt: number | null;
  /** The reminders card (shown once the app is installed) keeps its own snooze. */
  pushDismissals: number;
  pushSnoozedUntil: number | null;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const SNOOZE_MS = 14 * DAY_MS;
export const MAX_DISMISSALS = 3;
export const DAYS_OF_USE = 3;
const DAYS_KEPT = 5;

export const EMPTY_NUDGE: NudgeState = {
  days: [],
  submittedAt: null,
  dismissals: 0,
  snoozedUntil: null,
  installedAt: null,
  pushDismissals: 0,
  pushSnoozedUntil: null,
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Whatever was stored (or nothing, or garbage) → a valid state. Never throws. */
export function parseNudgeState(raw: string | null | undefined): NudgeState {
  if (!raw) return { ...EMPTY_NUDGE };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== 'object') return { ...EMPTY_NUDGE };
    const days = Array.isArray(o.days) ? o.days.filter((d): d is string => typeof d === 'string').slice(0, DAYS_KEPT) : [];
    return {
      days,
      submittedAt: num(o.submittedAt),
      dismissals: Math.max(0, num(o.dismissals) ?? 0),
      snoozedUntil: num(o.snoozedUntil),
      installedAt: num(o.installedAt),
      pushDismissals: Math.max(0, num(o.pushDismissals) ?? 0),
      pushSnoozedUntil: num(o.pushSnoozedUntil),
    };
  } catch {
    return { ...EMPTY_NUDGE };
  }
}

export function recordVisit(state: NudgeState, today: string): NudgeState {
  if (state.days.includes(today) || state.days.length >= DAYS_KEPT) return state;
  return { ...state, days: [...state.days, today] };
}

export function recordSubmission(state: NudgeState, now: number): NudgeState {
  return state.submittedAt ? state : { ...state, submittedAt: now };
}

export function recordDismiss(state: NudgeState, now: number): NudgeState {
  return { ...state, dismissals: state.dismissals + 1, snoozedUntil: now + SNOOZE_MS };
}

export function recordInstalled(state: NudgeState, now: number): NudgeState {
  return state.installedAt ? state : { ...state, installedAt: now };
}

export function recordPushDismiss(state: NudgeState, now: number): NudgeState {
  return { ...state, pushDismissals: state.pushDismissals + 1, pushSnoozedUntil: now + SNOOZE_MS };
}

export interface NudgeContext {
  now: number;
  today: string;
  /**
   * The day the person finished the welcome tour, if they did ("2026-09-01"). The tour runs on the
   * first visit, so a tour finished at least two days before today is proof of earlier use: someone
   * who has used the LMS for weeks shouldn't wait three more days after this ships.
   */
  tourDoneDay?: string | null;
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"); NaN when either is malformed. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

/** Enough use to be worth asking: never true on someone's first day. */
export function engagedEnough(state: NudgeState, ctx: NudgeContext): boolean {
  const days = state.days.includes(ctx.today) ? state.days.length : state.days.length + 1;
  if (days >= DAYS_OF_USE) return true;
  if (state.submittedAt && days >= 2) return true;
  return !!ctx.tourDoneDay && daysBetween(ctx.tourDoneDay, ctx.today) >= DAYS_OF_USE - 1;
}

/** Whether the install card may show now. The platform/installed checks live with the caller. */
export function installNudgeDue(state: NudgeState, ctx: NudgeContext): boolean {
  if (state.installedAt) return false;
  if (state.dismissals >= MAX_DISMISSALS) return false;
  if (state.snoozedUntil && state.snoozedUntil > ctx.now) return false;
  return engagedEnough(state, ctx);
}

/**
 * The «turn on lesson reminders» card, shown inside the installed app. No usage threshold:
 * installing was the commitment, and the first launch is the moment to ask (an iPhone's home-screen
 * app starts with empty storage anyway, so it couldn't count earlier days). Its own snooze.
 */
export function pushNudgeDue(state: NudgeState, now: number): boolean {
  if (state.pushDismissals >= MAX_DISMISSALS) return false;
  return !(state.pushSnoozedUntil && state.pushSnoozedUntil > now);
}
