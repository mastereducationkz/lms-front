/**
 * One calm popup at a time (owner, 2026-10-04). On a first login five things used to open on top of
 * each other — the welcome, Daily Questions, the tour, the achievements celebration and the Kasatik
 * spotlight — and it read like ads. Every auto-popup now asks this queue for the one slot:
 *
 * - At most ONE blocking popup per VISIT (a visit = one browser tab session, kept in sessionStorage),
 *   by priority: onboarding (welcome + tour) → achievements celebration → Daily Questions. A
 *   higher-priority popup that is still deciding (loading) holds the lower ones back, for at most
 *   DECIDE_TIMEOUT_MS.
 * - The visit in which onboarding runs shows ONLY onboarding; everything else waits for the next visit.
 * - Non-blocking nudges (the Kasatik spotlight, the referral strip) appear only on a quiet visit:
 *   not the first one, nothing blocking shown or held, every blocking candidate decided.
 */
import { useEffect, useSyncExternalStore } from 'react';

export type BlockingKind = 'onboarding' | 'celebration' | 'daily_questions';
export type Intent = 'unknown' | 'wants' | 'none';
export type NudgeKind = 'spotlight' | 'referral';

export const BLOCKING_ORDER: readonly BlockingKind[] = ['onboarding', 'celebration', 'daily_questions'];
/** How long a still-loading candidate may hold the others back. */
export const DECIDE_TIMEOUT_MS = 6000;
/** Nudges wait this long after a page load, so candidates mounting in the same render can register. */
export const QUIET_GRACE_MS = 1200;

export interface VisitState {
  /** This visit is the one in which onboarding runs (or is still owed). */
  onboarding: boolean;
  /** Onboarding actually started in this visit (a stale "pending" can't downgrade it). */
  onboardingStarted?: boolean;
  /** The one blocking popup this visit has shown. */
  shown: BlockingKind | null;
  /** Nudges already shown this visit — they stay up for the rest of it. */
  nudges?: NudgeKind[];
}

export interface IntentEntry {
  intent: Intent;
  since: number;
}

export interface QueueSnapshot {
  visit: VisitState;
  holder: BlockingKind | null;
  intents: Partial<Record<BlockingKind, IntentEntry>>;
  startedAt: number;
  now: number;
}

const decided = (e: IntentEntry | undefined, now: number) =>
  !e || e.intent === 'none' || (e.intent === 'unknown' && now - e.since >= DECIDE_TIMEOUT_MS);

/** Which blocking popup may hold the slot right now (null: none may open). */
export function grantedKind(s: QueueSnapshot): BlockingKind | null {
  if (s.holder) return s.holder;
  if (s.visit.shown) return null; // one blocking popup per visit
  for (const kind of BLOCKING_ORDER) {
    if (s.visit.onboarding && kind !== 'onboarding') return null; // first visit: onboarding only
    const e = s.intents[kind];
    if (e?.intent === 'wants') return kind;
    if (!decided(e, s.now)) return null; // a higher-priority popup is still deciding
  }
  return null;
}

/** A quiet visit: not the first, nothing blocking shown, held or wanted, every candidate decided. */
export function isQuietVisit(s: QueueSnapshot): boolean {
  if (s.visit.onboarding || s.visit.shown || s.holder) return false;
  if (s.now - s.startedAt < QUIET_GRACE_MS) return false;
  return BLOCKING_ORDER.every((k) => decided(s.intents[k], s.now));
}

/** The next moment a timeout changes the answer, so subscribers can re-render then. */
export function nextDeadline(s: QueueSnapshot): number | null {
  const times = Object.values(s.intents)
    .filter((e): e is IntentEntry => !!e && e.intent === 'unknown' && s.now - e.since < DECIDE_TIMEOUT_MS)
    .map((e) => e.since + DECIDE_TIMEOUT_MS);
  if (s.now - s.startedAt < QUIET_GRACE_MS) times.push(s.startedAt + QUIET_GRACE_MS);
  return times.length ? Math.min(...times) : null;
}

// ── the achievements celebration ────────────────────────────────────────────────────────

export type CelebrationMode = 'modal' | 'toasts' | 'defer' | 'none';

/**
 * How new unlocks are announced. A visit opens with the full modal only for a legendary unlock or a
 * big batch (≥ 3, e.g. the launch grant); anything smaller, and anything arriving during a session,
 * is a toast — except a legendary one while this visit has had no blocking popup yet.
 */
export function celebrationMode(i: {
  count: number;
  legendary: boolean;
  atVisitStart: boolean;
  visit: VisitState;
  holder: BlockingKind | null;
}): CelebrationMode {
  if (i.visit.onboarding || i.count === 0) return 'none'; // first visit: it all waits
  if (i.atVisitStart) {
    if (!i.legendary && i.count < 3) return 'toasts';
    return i.visit.shown ? 'defer' : 'modal'; // a reload after another popup keeps it for the next visit
  }
  return i.legendary && !i.visit.shown && !i.holder ? 'modal' : 'toasts';
}

// ── Daily Questions ─────────────────────────────────────────────────────────────────────

/** The same UTC day the Daily Questions caches use (it rolls over at 05:00 Almaty). */
export const dailyQuestionsDay = (d: Date = new Date()) => d.toISOString().split('T')[0];
export const dailyQuestionsAutoOpenedKey = (userId: string | number, day: string) =>
  `daily_questions_autoopened_${userId}_${day}`;

/** Opens by itself at most once a day, only on the dashboard, never just to show a finished score. */
export function mayAutoOpenDailyQuestions(i: {
  pathname: string;
  autoOpenedToday: boolean;
  dismissedThisSession: boolean;
  completedToday: boolean;
}): boolean {
  return i.pathname === '/dashboard' && !i.autoOpenedToday && !i.dismissedThisSession && !i.completedToday;
}

// ── the referral strip ──────────────────────────────────────────────────────────────────

export const REFERRAL_LEGACY_KEY = 'studentReferralBannerHidden';
export const referralHiddenKey = (userId: string | number) => `studentReferralBannerHidden:${userId}`;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Whether this student hid the referral strip. The old key was shared by everyone on the browser;
 * the first student to load after the change inherits a «hidden» from it, once, and it's removed.
 */
export function readReferralHidden(storage: StorageLike | null, userId: string | number): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(referralHiddenKey(userId)) === 'true') return true;
    if (storage.getItem(REFERRAL_LEGACY_KEY) === 'true') {
      storage.setItem(referralHiddenKey(userId), 'true');
      storage.removeItem(REFERRAL_LEGACY_KEY);
      return true;
    }
  } catch {
    /* storage blocked: show it */
  }
  return false;
}

export function hideReferral(storage: StorageLike | null, userId: string | number): void {
  try {
    storage?.setItem(referralHiddenKey(userId), 'true');
  } catch {
    /* storage blocked: hidden for this render only */
  }
}

// ── the per-tab store ───────────────────────────────────────────────────────────────────

const visitKey = (userId: string) => `attention:visit:${userId}`;
const firstVisitDoneKey = (userId: string) => `attention:first-visit-done:${userId}`;

const storageOf = (kind: 'sessionStorage' | 'localStorage'): StorageLike | null => {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch {
    return null;
  }
};

export class AttentionStore {
  private userId: string | null = null;
  private visit: VisitState = { onboarding: false, shown: null };
  private holder: BlockingKind | null = null;
  private intents: Partial<Record<BlockingKind, IntentEntry>> = {};
  private version = 0;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly session: () => StorageLike | null,
    private readonly local: () => StorageLike | null,
    private readonly clock: () => number = () => Date.now(),
    private readonly startedAt: number = Date.now(),
  ) {}

  /** The signed-in student; creates this tab's visit the first time it's seen. Idempotent. */
  begin(userId: string | number, onboardingPending: boolean): void {
    const id = String(userId);
    if (this.userId !== id) {
      this.userId = id;
      this.holder = null;
      this.intents = {};
      this.visit = this.readVisit(id) ?? { onboarding: onboardingPending, shown: null };
      if (!this.visit.onboarding) this.markFirstVisitDone(id);
      this.persist();
    } else if (this.visit.onboarding && !this.visit.onboardingStarted && !onboardingPending) {
      // The first sight came from a stale "onboarding owed" (an old cookie); it never started.
      this.visit = { ...this.visit, onboarding: false };
      this.markFirstVisitDone(id);
      this.persist();
    }
  }

  /** Onboarding is starting now: this visit belongs to it. */
  markOnboardingVisit(): void {
    this.visit = { ...this.visit, onboarding: true, onboardingStarted: true };
    this.persist();
  }

  declare(kind: BlockingKind, intent: Intent): void {
    const cur = this.intents[kind];
    if (cur?.intent === intent) return;
    this.intents = { ...this.intents, [kind]: { intent, since: this.clock() } };
    this.changed();
  }

  granted(kind: BlockingKind): boolean {
    return this.userId !== null && grantedKind(this.snapshot()) === kind;
  }

  /** The popup is opening: it holds the slot, and it's this visit's one blocking popup. */
  take(kind: BlockingKind): void {
    this.holder = kind;
    this.visit = { ...this.visit, shown: this.visit.shown ?? kind };
    this.persist();
  }

  release(kind: BlockingKind): void {
    if (this.holder !== kind) return;
    this.holder = null;
    this.changed();
  }

  quiet(): boolean {
    return this.userId !== null && isQuietVisit(this.snapshot());
  }

  /** A nudge may show: on a quiet visit, or because it already showed earlier in this visit. */
  nudgeAllowed(kind: NudgeKind): boolean {
    if (this.userId === null) return false;
    if (this.visit.nudges?.includes(kind)) return true;
    return this.quiet();
  }

  noteNudgeShown(kind: NudgeKind): void {
    if (this.visit.nudges?.includes(kind)) return;
    this.visit = { ...this.visit, nudges: [...(this.visit.nudges ?? []), kind] };
    this.persist();
  }

  visitState(): VisitState {
    return this.visit;
  }

  holderNow(): BlockingKind | null {
    return this.holder;
  }

  /** Past the onboarding visit (remembered per student; storage blocked → the visit flag decides). */
  firstVisitDone(): boolean {
    if (!this.userId || this.visit.onboarding) return false;
    try {
      const local = this.local();
      return local ? local.getItem(firstVisitDoneKey(this.userId)) === '1' : true;
    } catch {
      return true;
    }
  }

  snapshot(): QueueSnapshot {
    return { visit: this.visit, holder: this.holder, intents: this.intents, startedAt: this.startedAt, now: this.clock() };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  private readVisit(id: string): VisitState | null {
    try {
      const raw = this.session()?.getItem(visitKey(id));
      return raw ? (JSON.parse(raw) as VisitState) : null;
    } catch {
      return null;
    }
  }

  private markFirstVisitDone(id: string): void {
    try {
      this.local()?.setItem(firstVisitDoneKey(id), '1');
    } catch {
      /* storage blocked: the visit flag alone decides */
    }
  }

  private persist(): void {
    if (this.userId) {
      try {
        this.session()?.setItem(visitKey(this.userId), JSON.stringify(this.visit));
      } catch {
        /* storage blocked: the in-memory visit still holds for this page */
      }
    }
    this.changed();
  }

  private changed(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const at = nextDeadline(this.snapshot());
    if (at !== null && typeof setTimeout !== 'undefined') {
      this.timer = setTimeout(() => this.changed(), Math.max(0, at - this.clock()) + 10);
    }
  }
}

export const attention = new AttentionStore(() => storageOf('sessionStorage'), () => storageOf('localStorage'));

/**
 * Subscribes to the queue and starts this tab's visit for the signed-in student (in an effect — the
 * store notifies listeners, which must never happen during another component's render).
 */
export function useAttention(user: { id: string | number; role?: string; onboarding_completed?: boolean } | null | undefined): AttentionStore {
  useSyncExternalStore(attention.subscribe, attention.getVersion, attention.getVersion);
  const userId = user?.role === 'student' ? user.id : null;
  const pending = userId !== null && onboardingOwed(userId, user?.onboarding_completed);
  useEffect(() => {
    if (userId !== null) attention.begin(userId, pending);
  }, [userId, pending]);
  return attention;
}

/** Whether the onboarding tour is still owed to this user (mirrors OnboardingManager). */
export function onboardingOwed(userId: string | number, onboardingCompleted?: boolean): boolean {
  if (onboardingCompleted) return false;
  try {
    return window.localStorage.getItem(`onboarding_completed_${userId}`) !== 'true';
  } catch {
    return true;
  }
}
