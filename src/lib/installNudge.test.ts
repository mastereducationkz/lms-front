import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  EMPTY_NUDGE,
  MAX_DISMISSALS,
  SNOOZE_MS,
  daysBetween,
  installNudgeDue,
  parseNudgeState,
  pushNudgeDue,
  recordDismiss,
  recordInstalled,
  recordPushDismiss,
  recordSubmission,
  recordVisit,
  type NudgeState,
} from './installNudge';

const NOW = Date.parse('2026-10-07T09:00:00Z');
const ctx = (today: string, extra: Partial<{ now: number; tourDoneDay: string | null }> = {}) => ({ now: NOW, today, ...extra });
const visited = (...days: string[]): NudgeState => days.reduce(recordVisit, { ...EMPTY_NUDGE });

describe('installNudgeDue: when the dashboard card may show', () => {
  it('never on the first visit, even after a homework submission that day', () => {
    const first = visited('2026-10-07');
    expect(installNudgeDue(first, ctx('2026-10-07'))).toBe(false);
    expect(installNudgeDue(recordSubmission(first, NOW), ctx('2026-10-07'))).toBe(false);
    // Nothing stored yet at all (the very first load) counts as that first day too.
    expect(installNudgeDue({ ...EMPTY_NUDGE }, ctx('2026-10-07'))).toBe(false);
  });

  it('after three distinct days of use', () => {
    expect(installNudgeDue(visited('2026-10-01', '2026-10-03'), ctx('2026-10-03'))).toBe(false);
    expect(installNudgeDue(visited('2026-10-01', '2026-10-03', '2026-10-07'), ctx('2026-10-07'))).toBe(true);
    // Today not recorded yet still counts as today's visit.
    expect(installNudgeDue(visited('2026-10-01', '2026-10-03'), ctx('2026-10-07'))).toBe(true);
  });

  it('or on a later day once the first homework went in', () => {
    const submitted = recordSubmission(visited('2026-10-06'), NOW - DAY_MS);
    expect(installNudgeDue(submitted, ctx('2026-10-06'))).toBe(false);
    expect(installNudgeDue(recordVisit(submitted, '2026-10-07'), ctx('2026-10-07'))).toBe(true);
  });

  it('someone who finished the welcome tour days ago is not new: no three-day wait after this ships', () => {
    const firstLoadSinceRelease = visited('2026-10-07');
    expect(installNudgeDue(firstLoadSinceRelease, ctx('2026-10-07', { tourDoneDay: '2026-09-01' }))).toBe(true);
    expect(installNudgeDue(firstLoadSinceRelease, ctx('2026-10-07', { tourDoneDay: '2026-10-05' }))).toBe(true);
    // The tour runs on the first visit: finishing it today or yesterday proves nothing.
    expect(installNudgeDue(firstLoadSinceRelease, ctx('2026-10-07', { tourDoneDay: '2026-10-07' }))).toBe(false);
    expect(installNudgeDue(firstLoadSinceRelease, ctx('2026-10-07', { tourDoneDay: '2026-10-06' }))).toBe(false);
  });

  it('«Not now» snoozes for 14 days', () => {
    const engaged = visited('2026-10-01', '2026-10-03', '2026-10-07');
    const dismissed = recordDismiss(engaged, NOW);
    expect(dismissed.snoozedUntil).toBe(NOW + SNOOZE_MS);
    expect(installNudgeDue(dismissed, ctx('2026-10-08', { now: NOW + DAY_MS }))).toBe(false);
    expect(installNudgeDue(dismissed, ctx('2026-10-20', { now: NOW + 13 * DAY_MS }))).toBe(false);
    expect(installNudgeDue(dismissed, ctx('2026-10-21', { now: NOW + 14 * DAY_MS + 1 }))).toBe(true);
  });

  it('stops for good after the third dismissal', () => {
    let state = visited('2026-10-01', '2026-10-03', '2026-10-07');
    for (let i = 0; i < MAX_DISMISSALS; i++) state = recordDismiss(state, NOW + i * 15 * DAY_MS);
    expect(state.dismissals).toBe(3);
    expect(installNudgeDue(state, ctx('2027-06-01', { now: NOW + 365 * DAY_MS }))).toBe(false);
  });

  it('never once installed', () => {
    const installed = recordInstalled(visited('2026-10-01', '2026-10-03', '2026-10-07'), NOW);
    expect(installNudgeDue(installed, ctx('2026-10-07'))).toBe(false);
    expect(recordInstalled(installed, NOW + DAY_MS).installedAt).toBe(NOW);
  });
});

describe('pushNudgeDue: the reminders card inside the installed app', () => {
  it('asks on the first launch, snoozes 14 days, stops after three dismissals', () => {
    expect(pushNudgeDue({ ...EMPTY_NUDGE }, NOW)).toBe(true);
    const once = recordPushDismiss({ ...EMPTY_NUDGE }, NOW);
    expect(pushNudgeDue(once, NOW + DAY_MS)).toBe(false);
    expect(pushNudgeDue(once, NOW + SNOOZE_MS + 1)).toBe(true);
    const thrice = recordPushDismiss(recordPushDismiss(once, NOW), NOW);
    expect(pushNudgeDue(thrice, NOW + 100 * DAY_MS)).toBe(false);
  });
});

describe('state bookkeeping', () => {
  it('counts each day once and keeps only the first few', () => {
    let s = visited('2026-10-01', '2026-10-01', '2026-10-02');
    expect(s.days).toEqual(['2026-10-01', '2026-10-02']);
    for (const d of ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']) s = recordVisit(s, d);
    expect(s.days).toHaveLength(5);
  });

  it('keeps the first submission time', () => {
    const s = recordSubmission(recordSubmission({ ...EMPTY_NUDGE }, NOW), NOW + DAY_MS);
    expect(s.submittedAt).toBe(NOW);
  });

  it('parses whatever is in storage without throwing', () => {
    expect(parseNudgeState(null)).toEqual(EMPTY_NUDGE);
    expect(parseNudgeState('not json')).toEqual(EMPTY_NUDGE);
    expect(parseNudgeState('42')).toEqual(EMPTY_NUDGE);
    expect(parseNudgeState('{"days":["2026-10-01",7],"dismissals":"x","snoozedUntil":5}')).toEqual({
      ...EMPTY_NUDGE,
      days: ['2026-10-01'],
      snoozedUntil: 5,
    });
    const round = recordDismiss(visited('2026-10-01'), NOW);
    expect(parseNudgeState(JSON.stringify(round))).toEqual(round);
  });

  it('daysBetween counts calendar days', () => {
    expect(daysBetween('2026-10-05', '2026-10-07')).toBe(2);
    expect(daysBetween('2026-09-30', '2026-10-01')).toBe(1);
    expect(Number.isNaN(daysBetween('nope', '2026-10-01'))).toBe(true);
  });
});
