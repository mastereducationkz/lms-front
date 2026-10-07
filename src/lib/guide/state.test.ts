import { describe, expect, it } from 'vitest';
import {
  NO_LOCAL_MARKS,
  TOUR_VERSION,
  autoTourFor,
  marksToSync,
  readUiState,
  replayTourFor,
  shouldAutoStartTour,
  shouldShowWelcome,
  tipDismissed,
  tourOwed,
  tourSeen,
  withTipDismissed,
  withTourSeen,
  type GuideUser,
} from './state';
import { readLocalMarks, readTourProgress, writeLocalMarks, writeTourProgress } from './storage';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
};

const fresh = { tour_version_seen: 0, tips: {} };
const user = (over: Partial<GuideUser> = {}): GuideUser => ({
  id: 7, role: 'student', onboarding_completed: true, assignment_zero_completed: true, ui_state: fresh, ...over,
});

describe('who gets which tour', () => {
  it('starts by itself for students, teachers and curators only', () => {
    expect(['student', 'teacher', 'curator'].map(autoTourFor)).toEqual(['student', 'teacher', 'curator']);
    for (const role of ['head_teacher', 'head_curator', 'admin', 'parent', null, undefined]) expect(autoTourFor(role)).toBeNull();
  });

  it('replays the curator tour for head curators, and nothing for the other head roles', () => {
    expect(replayTourFor('head_curator')).toBe('curator');
    for (const role of ['head_teacher', 'admin', 'parent']) expect(replayTourFor(role)).toBeNull();
  });
});

describe('the seen state', () => {
  it('is unknown, not «unseen», until the server says', () => {
    expect(readUiState(undefined)).toBeNull();
    expect(readUiState(null)).toBeNull();
    expect(readUiState([])).toBeNull();
    expect(readUiState({})).toEqual(fresh);
    expect(readUiState({ tour_version_seen: '2', tips: { a: 'x', b: 3 } })).toEqual({ tour_version_seen: 0, tips: { a: 'x' } });
  });

  it('someone who finished the old tour sees the new one once (the version bump)', () => {
    const finishedOld = user({ onboarding_completed: true, ui_state: fresh });
    expect(shouldAutoStartTour(finishedOld, '/dashboard', NO_LOCAL_MARKS)).toBe(true);
    const seenNew = user({ ui_state: { tour_version_seen: TOUR_VERSION, tips: {} } });
    expect(shouldAutoStartTour(seenNew, '/dashboard', NO_LOCAL_MARKS)).toBe(false);
  });

  it('a mark this device made counts even before the server confirms it', () => {
    expect(tourSeen(fresh, { tourVersion: TOUR_VERSION, tips: [] })).toBe(true);
    expect(shouldAutoStartTour(user(), '/dashboard', { tourVersion: TOUR_VERSION, tips: [] })).toBe(false);
    expect(tipDismissed('homework.late', fresh, { tourVersion: 0, tips: ['homework.late'] })).toBe(true);
    expect(tipDismissed('homework.late', { tour_version_seen: 0, tips: { 'homework.late': 't' } }, NO_LOCAL_MARKS)).toBe(true);
    expect(tipDismissed('homework.late', fresh, NO_LOCAL_MARKS)).toBe(false);
  });

  it('only on the dashboard, never while the state is unknown, never before Assignment Zero', () => {
    expect(shouldAutoStartTour(user(), '/homework', NO_LOCAL_MARKS)).toBe(false);
    expect(shouldAutoStartTour(user({ ui_state: undefined }), '/dashboard', NO_LOCAL_MARKS)).toBe(false);
    expect(shouldAutoStartTour(user({ assignment_zero_completed: false }), '/dashboard', NO_LOCAL_MARKS)).toBe(false);
    expect(shouldAutoStartTour(user({ assignment_zero_completed: false, special_group_only_student: true }), '/dashboard', NO_LOCAL_MARKS)).toBe(true);
    expect(shouldAutoStartTour(null, '/dashboard', NO_LOCAL_MARKS)).toBe(false);
  });

  it('never starts by itself for head roles, admins or parents — the old welcome loop', () => {
    for (const role of ['head_teacher', 'head_curator', 'admin', 'parent']) {
      expect(shouldAutoStartTour(user({ role, onboarding_completed: false }), '/dashboard', NO_LOCAL_MARKS)).toBe(false);
    }
  });

  it('shows the welcome only before a brand-new person’s first tour, never on a resume', () => {
    expect(shouldShowWelcome(user({ onboarding_completed: false }), false)).toBe(true);
    expect(shouldShowWelcome(user({ onboarding_completed: false }), true)).toBe(false);
    expect(shouldShowWelcome(user({ onboarding_completed: true }), false)).toBe(false);
  });

  it('keeps the visit for the tour while it is owed (the one-popup queue)', () => {
    expect(tourOwed(user(), NO_LOCAL_MARKS)).toBe(true);
    expect(tourOwed(user({ ui_state: { tour_version_seen: TOUR_VERSION, tips: {} } }), NO_LOCAL_MARKS)).toBe(false);
    // An older backend without ui_state: the old flag answers.
    expect(tourOwed(user({ ui_state: undefined, onboarding_completed: false }), NO_LOCAL_MARKS)).toBe(true);
    expect(tourOwed(user({ ui_state: undefined, onboarding_completed: true }), NO_LOCAL_MARKS)).toBe(false);
  });

  it('resends only what the server is missing', () => {
    expect(marksToSync(null, { tourVersion: 1, tips: ['a'] })).toEqual({ tourVersion: null, tips: [] });
    expect(marksToSync(fresh, { tourVersion: 1, tips: ['a', 'b'] })).toEqual({ tourVersion: 1, tips: ['a', 'b'] });
    expect(marksToSync({ tour_version_seen: 1, tips: { a: 't' } }, { tourVersion: 1, tips: ['a', 'b'] })).toEqual({ tourVersion: null, tips: ['b'] });
  });

  it('mirrors the server rules for the optimistic update', () => {
    expect(withTourSeen(null).tour_version_seen).toBe(TOUR_VERSION);
    expect(withTourSeen({ tour_version_seen: 5, tips: {} }).tour_version_seen).toBe(5);
    const first = withTipDismissed(fresh, 'x', new Date('2026-10-07T09:00:00.123Z'));
    expect(first.tips).toEqual({ x: '2026-10-07T09:00:00Z' });
    expect(withTipDismissed(first, 'x', new Date('2027-01-01T00:00:00Z'))).toBe(first);
  });
});

describe('this device’s storage', () => {
  it('round-trips the local marks and forgets them when empty', () => {
    const store = memory();
    expect(readLocalMarks(7, store)).toEqual(NO_LOCAL_MARKS);
    writeLocalMarks(7, { tourVersion: 1, tips: ['a'] }, store);
    expect(readLocalMarks(7, store)).toEqual({ tourVersion: 1, tips: ['a'] });
    expect(readLocalMarks(8, store)).toEqual(NO_LOCAL_MARKS);
    writeLocalMarks(7, NO_LOCAL_MARKS, store);
    expect(store.raw.size).toBe(0);
  });

  it('survives garbage and blocked storage', () => {
    const store = memory();
    store.setItem('guide:marks:7', '{not json');
    expect(readLocalMarks(7, store)).toEqual(NO_LOCAL_MARKS);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => undefined };
    expect(readLocalMarks(7, blocked)).toEqual(NO_LOCAL_MARKS);
    expect(() => writeLocalMarks(7, { tourVersion: 1, tips: [] }, blocked)).not.toThrow();
    expect(readTourProgress(7, blocked)).toBeNull();
  });

  it('remembers where a tour was, so a reload resumes it', () => {
    const store = memory();
    writeTourProgress(7, { kind: 'student', stepId: 'homework', origin: 'auto' }, store);
    expect(readTourProgress(7, store)).toEqual({ kind: 'student', stepId: 'homework', origin: 'auto' });
    writeTourProgress(7, null, store);
    expect(readTourProgress(7, store)).toBeNull();
    store.setItem('guide:tour:7', JSON.stringify({ kind: 'student', stepId: 'x', origin: 'other' }));
    expect(readTourProgress(7, store)).toBeNull();
  });
});
