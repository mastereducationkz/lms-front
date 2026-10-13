import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ api: { get: vi.fn() } }));

import { asMyLeague, asResultConsent } from './masterLeague';

const live = {
  launched: true,
  in_league: true,
  group: { id: 376, name: 'Master League Dreamville' },
  exam_date: '2026-11-07',
  days_to_exam: 25,
  phase: 'season',
  result_due: '2026-11-21',
  lessons: {
    total: 11,
    played: 2,
    items: [
      { id: 1, number: 1, starts_at: '2026-10-12T13:00:00Z', state: 'attended' },
      { id: 2, number: 2, starts_at: '2026-10-14T13:00:00Z', state: 'upcoming' },
    ],
  },
  next_lesson: { id: 2, number: 2, starts_at: '2026-10-14T13:00:00Z', title: 'Master League Dreamville: Lesson 2' },
  attendance: { attended: 1, marked: 1, percent: 100 },
  homework: { on_time: 0, due: 0 },
  squad_size: 8,
  achievements: [{ key: 'ml_signed', unlocked: true, progress: null }, { key: 'ml_hat_trick', unlocked: false, progress: { current: 1, target: 3 } }],
};

describe('the season answer', () => {
  it('reads a live season', () => {
    const league = asMyLeague(live)!;
    expect(league.group.name).toBe('Master League Dreamville');
    expect(league.phase).toBe('season');
    expect(league.lessons.items).toHaveLength(2);
    expect(league.next_lesson?.number).toBe(2);
    expect(league.achievements[1].progress).toEqual({ current: 1, target: 3 });
  });

  it('is nothing at all unless the league is launched and the student is in it', () => {
    expect(asMyLeague({ launched: false, in_league: false })).toBeNull();
    expect(asMyLeague({ ...live, launched: false })).toBeNull();
    expect(asMyLeague({ ...live, in_league: false })).toBeNull();
    expect(asMyLeague(null)).toBeNull();
    expect(asMyLeague('oops')).toBeNull();
  });

  it('hides a season that is over, an unknown phase and a group-less answer', () => {
    expect(asMyLeague({ ...live, phase: 'over' })).toBeNull();
    expect(asMyLeague({ ...live, phase: 'mid-air' })).toBeNull();
    expect(asMyLeague({ ...live, group: null })).toBeNull();
  });

  it('survives a thin answer: no exam date, no lessons, no goals', () => {
    const league = asMyLeague({ launched: true, in_league: true, phase: 'warmup', group: { id: 1, name: 'Master League KOD' } })!;
    expect(league.exam_date).toBeNull();
    expect(league.days_to_exam).toBeNull();
    expect(league.lessons).toEqual({ total: 0, played: 0, items: [] });
    expect(league.next_lesson).toBeNull();
    expect(league.attendance).toEqual({ attended: 0, marked: 0, percent: 0 });
    expect(league.achievements).toEqual([]);
  });

  it('drops lessons with an unknown state or no start, and goals with no key', () => {
    const league = asMyLeague({
      ...live,
      lessons: { total: 2, played: 0, items: [{ id: 1, number: 1, starts_at: 'x', state: 'weird' }, { id: 2, number: 2, state: 'upcoming' }, live.lessons.items[1]] },
      achievements: [{ unlocked: true }, live.achievements[0]],
    })!;
    expect(league.lessons.items.map((i) => i.number)).toEqual([2]);
    expect(league.achievements.map((a) => a.key)).toEqual(['ml_signed']);
  });
});

describe('the result consent answer', () => {
  const ask = { state: 'ask', result_total: 1520, decision: null, decided_at: null, can_answer: true };

  it('reads each state a card can show', () => {
    expect(asResultConsent(ask)).toEqual({ state: 'ask', result_total: 1520, decision: null, can_answer: true });
    expect(asResultConsent({ ...ask, state: 'yes', decision: 'yes' })?.decision).toBe('yes');
    expect(asResultConsent({ ...ask, state: 'no', decision: 'no', can_answer: false })?.can_answer).toBe(false);
    expect(asResultConsent({ ...ask, state: 'posted' })?.state).toBe('posted');
  });

  it('is nothing when there is nothing to decide, or the answer is not one', () => {
    expect(asResultConsent({ state: 'none' })).toBeNull();
    expect(asResultConsent({ ...ask, state: 'maybe' })).toBeNull();
    expect(asResultConsent({ ...ask, result_total: 0 })).toBeNull();
    expect(asResultConsent({ ...ask, result_total: null })).toBeNull();
    expect(asResultConsent(null)).toBeNull();
    expect(asResultConsent('nope')).toBeNull();
  });

  it('only a literal can_answer true lets the buttons work', () => {
    expect(asResultConsent({ ...ask, can_answer: 'true' })?.can_answer).toBe(false);
  });

  it('keeps an unknown decision out', () => {
    expect(asResultConsent({ ...ask, decision: 'да' })?.decision).toBeNull();
  });
});
