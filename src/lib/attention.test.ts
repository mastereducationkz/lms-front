import { describe, expect, it } from 'vitest';
import {
  AttentionStore,
  DECIDE_TIMEOUT_MS,
  QUIET_GRACE_MS,
  REFERRAL_LEGACY_KEY,
  celebrationMode,
  dailyQuestionsAutoOpenedKey,
  dailyQuestionsDay,
  grantedKind,
  isQuietVisit,
  mayAutoOpenDailyQuestions,
  readReferralHidden,
  referralHiddenKey,
  type QueueSnapshot,
} from './attention';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
};

const snap = (over: Partial<QueueSnapshot> = {}): QueueSnapshot => ({
  visit: { onboarding: false, shown: null },
  holder: null,
  intents: {},
  startedAt: 0,
  now: 10_000,
  ...over,
});
const at = (intent: 'unknown' | 'wants' | 'none', since = 9_000) => ({ intent, since });

describe('one blocking popup per visit, by priority', () => {
  it('grants the highest-priority popup that wants the slot', () => {
    expect(grantedKind(snap({ intents: { celebration: at('wants'), daily_questions: at('wants') } }))).toBe('celebration');
    expect(grantedKind(snap({ intents: { celebration: at('none'), daily_questions: at('wants') } }))).toBe('daily_questions');
  });

  it('holds a lower popup back while a higher one is still deciding — until the timeout', () => {
    const s = snap({ intents: { celebration: at('unknown', 9_000), daily_questions: at('wants') } });
    expect(grantedKind(s)).toBeNull();
    expect(grantedKind({ ...s, now: 9_000 + DECIDE_TIMEOUT_MS })).toBe('daily_questions');
  });

  it('never opens a second blocking popup in the same visit', () => {
    const s = snap({ visit: { onboarding: false, shown: 'celebration' }, intents: { daily_questions: at('wants') } });
    expect(grantedKind(s)).toBeNull();
  });

  it('keeps the slot with whoever holds it', () => {
    expect(grantedKind(snap({ holder: 'daily_questions', intents: { celebration: at('wants') } }))).toBe('daily_questions');
  });

  it('on the first-login visit only onboarding may open', () => {
    const visit = { onboarding: true, shown: null };
    expect(grantedKind(snap({ visit, intents: { celebration: at('wants'), daily_questions: at('wants') } }))).toBeNull();
    expect(grantedKind(snap({ visit, intents: { onboarding: at('wants'), celebration: at('wants') } }))).toBe('onboarding');
  });
});

describe('nudges wait for a quiet visit', () => {
  it('is quiet only after the grace, with every candidate decided and nothing shown', () => {
    const decided = { celebration: at('none'), daily_questions: at('none') };
    expect(isQuietVisit(snap({ intents: decided }))).toBe(true);
    expect(isQuietVisit(snap({ intents: decided, now: QUIET_GRACE_MS - 1 }))).toBe(false);
    expect(isQuietVisit(snap({ intents: { ...decided, daily_questions: at('unknown') } }))).toBe(false);
    expect(isQuietVisit(snap({ intents: { ...decided, daily_questions: at('wants') } }))).toBe(false);
    expect(isQuietVisit(snap({ intents: decided, visit: { onboarding: false, shown: 'daily_questions' } }))).toBe(false);
    expect(isQuietVisit(snap({ intents: decided, visit: { onboarding: true, shown: null } }))).toBe(false);
  });
});

describe('how new achievements are announced', () => {
  const visit = { onboarding: false, shown: null };
  it('the first-login visit announces nothing — it all waits', () => {
    expect(celebrationMode({ count: 5, legendary: true, atVisitStart: true, visit: { onboarding: true, shown: null }, holder: null })).toBe('none');
  });
  it('a visit opens with the modal only for a legendary unlock or a big batch', () => {
    expect(celebrationMode({ count: 2, legendary: false, atVisitStart: true, visit, holder: null })).toBe('toasts');
    expect(celebrationMode({ count: 3, legendary: false, atVisitStart: true, visit, holder: null })).toBe('modal');
    expect(celebrationMode({ count: 1, legendary: true, atVisitStart: true, visit, holder: null })).toBe('modal');
  });
  it('keeps the big moment for the next visit when this one already had a popup', () => {
    expect(celebrationMode({ count: 6, legendary: false, atVisitStart: true, visit: { onboarding: false, shown: 'daily_questions' }, holder: null })).toBe('defer');
  });
  it('mid-session: a toast, unless a legendary unlock and no popup yet this visit', () => {
    expect(celebrationMode({ count: 4, legendary: false, atVisitStart: false, visit, holder: null })).toBe('toasts');
    expect(celebrationMode({ count: 1, legendary: true, atVisitStart: false, visit, holder: null })).toBe('modal');
    expect(celebrationMode({ count: 1, legendary: true, atVisitStart: false, visit: { onboarding: false, shown: 'celebration' }, holder: null })).toBe('toasts');
    expect(celebrationMode({ count: 1, legendary: true, atVisitStart: false, visit, holder: 'daily_questions' })).toBe('toasts');
  });
});

describe('Daily Questions opens by itself at most once a day', () => {
  const base = { pathname: '/dashboard', autoOpenedToday: false, dismissedThisSession: false, completedToday: false };
  it('only on the dashboard, once a day, not after a dismissal, never just to show a score', () => {
    expect(mayAutoOpenDailyQuestions(base)).toBe(true);
    expect(mayAutoOpenDailyQuestions({ ...base, pathname: '/courses' })).toBe(false);
    expect(mayAutoOpenDailyQuestions({ ...base, autoOpenedToday: true })).toBe(false);
    expect(mayAutoOpenDailyQuestions({ ...base, dismissedThisSession: true })).toBe(false);
    expect(mayAutoOpenDailyQuestions({ ...base, completedToday: true })).toBe(false);
  });
  it('uses the same UTC day as its caches (05:00 Almaty rollover)', () => {
    expect(dailyQuestionsDay(new Date('2026-10-04T23:30:00+05:00'))).toBe('2026-10-04');
    expect(dailyQuestionsDay(new Date('2026-10-05T05:00:00+05:00'))).toBe('2026-10-05');
    expect(dailyQuestionsAutoOpenedKey(7, '2026-10-04')).toBe('daily_questions_autoopened_7_2026-10-04');
  });
});

describe('the referral strip is hidden per student', () => {
  it('honours the old browser-wide key once, for the first student, then forgets it', () => {
    const s = memory();
    s.setItem(REFERRAL_LEGACY_KEY, 'true');
    expect(readReferralHidden(s, 1)).toBe(true);
    expect(s.getItem(referralHiddenKey(1))).toBe('true');
    expect(s.getItem(REFERRAL_LEGACY_KEY)).toBeNull();
    expect(readReferralHidden(s, 2)).toBe(false);
  });
});

describe('the per-tab store', () => {
  const make = (session = memory(), local = memory(), now = { t: 100_000 }) => ({
    store: new AttentionStore(() => session, () => local, () => now.t, 0),
    session,
    local,
    now,
  });

  it('a first-login visit holds everything but onboarding, and remembers it across reloads', () => {
    const { store, session, local } = make();
    store.begin(7, true);
    store.declare('celebration', 'wants');
    expect(store.granted('celebration')).toBe(false);
    expect(store.firstVisitDone()).toBe(false);
    store.markOnboardingVisit();
    // a reload in the same tab: same session storage, a new store
    const again = new AttentionStore(() => session, () => local, () => 100_000, 0);
    again.begin(7, false); // onboarding finished meanwhile — the visit still belongs to it
    again.declare('celebration', 'wants');
    expect(again.granted('celebration')).toBe(false);
  });

  it('a stale «onboarding owed» that never started is dropped on the next look', () => {
    const { store } = make();
    store.begin(7, true);
    store.begin(7, false);
    expect(store.visitState().onboarding).toBe(false);
    expect(store.firstVisitDone()).toBe(true);
  });

  it('one popup per visit: after take/release the slot stays spent', () => {
    const { store } = make();
    store.begin(7, false);
    store.declare('daily_questions', 'wants');
    expect(store.granted('daily_questions')).toBe(true);
    store.take('daily_questions');
    store.release('daily_questions');
    store.declare('celebration', 'wants');
    expect(store.granted('celebration')).toBe(false);
    expect(store.quiet()).toBe(false);
  });

  it('a nudge needs a quiet visit, then stays up for the rest of it', () => {
    const { store } = make();
    store.begin(7, false);
    store.declare('celebration', 'none');
    store.declare('daily_questions', 'none');
    expect(store.nudgeAllowed('spotlight')).toBe(true);
    store.noteNudgeShown('spotlight');
    store.declare('celebration', 'wants');
    expect(store.nudgeAllowed('spotlight')).toBe(true);
    expect(store.nudgeAllowed('referral')).toBe(false);
  });

  it('says nothing before a student is known', () => {
    const { store } = make();
    expect(store.quiet()).toBe(false);
    expect(store.nudgeAllowed('spotlight')).toBe(false);
    expect(store.granted('onboarding')).toBe(false);
  });
});
