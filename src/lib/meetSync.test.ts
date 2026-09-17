import { describe, expect, it } from 'vitest';
import { judgeText, spanText, stageText, syncStatus, waitedText, waitingBannerText, waitingSteps } from './meetSync';
import type { MeetSync, MeetWaiting } from '../services/api/meetAttendance';

// Lesson 19:00–20:00 Almaty = 14:00–15:00 UTC; "now" is 21:25 Almaty.
const NOW = Date.parse('2026-09-15T16:25:00Z');

const waiting = (extra: Partial<MeetWaiting> = {}): MeetWaiting => ({
  stage: 'awaiting_google',
  ended_at: '2026-09-15T15:00:00Z',
  ready_at: '2026-09-15T15:20:00Z',
  judge_at: '2026-09-15T21:00:00Z',
  calls: [
    { started_at: '2026-09-15T13:58:08Z', ended_at: '2026-09-15T13:58:13Z', saved: true, lesson_call: false },
    { started_at: '2026-09-15T13:59:42Z', ended_at: '2026-09-15T14:00:01Z', saved: true, lesson_call: false },
  ],
  ...extra,
});

const sync = (extra: Partial<MeetSync> = {}): MeetSync => ({
  running: false, step: null, progress: null, started_at: '2026-09-15T16:15:00Z', finished_at: '2026-09-15T16:21:00Z',
  attendance_at: '2026-09-15T16:20:00Z', next_at: '2026-09-15T16:26:00Z', slow: false, ...extra,
});

describe('how long, never a promise', () => {
  it('says spans in minutes and hours', () => {
    expect(spanText(20_000)).toBe('less than a minute');
    expect(spanText(12 * 60_000)).toBe('12 min');
    expect(spanText(85 * 60_000)).toBe('1 h 25 min');
    expect(spanText(120 * 60_000)).toBe('2 h');
  });

  it('says how long a lesson has waited since it ended', () => {
    expect(waitedText(waiting(), NOW)).toBe('Lesson ended 20:00 · waiting 1 h 25 min');
    expect(waitedText(waiting({ stage: 'lesson_running' }), Date.parse('2026-09-15T14:30:00Z'))).toBe('Ends at 20:00');
  });
});

describe('the banner says what each lesson is waiting for (2026-09-17)', () => {
  it('a lesson still on is «in progress», not waiting for Google Meet', () => {
    expect(waitingBannerText([waiting({ stage: 'lesson_running' })])).toBe('1 lesson in progress');
    expect(waitingBannerText([waiting(), waiting()])).toBe('2 lessons waiting for Google Meet to hand over their calls');
    expect(waitingBannerText([waiting({ stage: 'collecting' })])).toBe('1 lesson: saving who joined');
  });

  it('mixed stages are listed in the order a lesson moves through them', () => {
    expect(waitingBannerText([
      waiting({ stage: 'settling' }), waiting({ stage: 'lesson_running' }), waiting(), waiting({ stage: 'lesson_running' }),
    ])).toBe('4 lessons not final yet: 2 in progress · 1 waiting for Google Meet to hand over its call · 1 almost ready');
    expect(waitingBannerText([waiting({ stage: 'call_open' }), null])).toBe(
      '2 lessons not final yet: 1 with its call still open in Google Meet · 1 waiting for Google Meet to hand over its call');
  });

  it('with nothing waiting it is only the sync running', () => {
    expect(waitingBannerText([])).toBe('Syncing with Google Meet');
  });
});

describe('what a lesson waits for (2026-09-15)', () => {
  it('names Google, and the room checks that are not the lesson', () => {
    expect(stageText(waiting())).toBe('Google Meet hasn’t handed over the lesson’s call yet — so far only 2 short room checks.');
    expect(stageText(waiting({ calls: [] }))).toBe('Google Meet hasn’t handed over the lesson’s call yet.');
    expect(judgeText(waiting())).toBe('If the call never comes through, the lesson is checked with what there is at 02:00.');
    expect(judgeText(waiting({ stage: 'collecting' }))).toBeNull();
  });

  it('walks the steps: ended, handed over, saved, compared', () => {
    const steps = waitingSteps(waiting(), sync(), NOW);
    expect(steps.map((s) => s.status)).toEqual(['done', 'active', 'todo', 'todo']);
    expect(steps[1].detail).toBe('Waiting 1 h 25 min · room checks at 18:58, 18:59');

    const collecting = waitingSteps(waiting({
      stage: 'collecting',
      calls: [{ started_at: '2026-09-15T13:58:16Z', ended_at: '2026-09-15T15:01:17Z', saved: false, lesson_call: true }],
    }), sync({ running: true, step: 'attendance', progress: { done: 12, total: 38 }, next_at: null }), NOW);
    expect(collecting.map((s) => s.status)).toEqual(['done', 'done', 'active', 'todo']);
    expect(collecting[1].detail).toBe('Call 18:58–20:01');
    expect(collecting[2].detail).toBe('12 of 38 calls saved');

    const settling = waitingSteps(waiting({ stage: 'settling' }), null, NOW);
    expect(settling.map((s) => s.status)).toEqual(['done', 'done', 'done', 'active']);
    expect(settling[3].detail).toBe('At 20:20');
  });

  it('says the next check is when the worker will look, not a guess', () => {
    const steps = waitingSteps(waiting({ stage: 'collecting' }), sync(), NOW);
    expect(steps[2].detail).toBe('In the next check, at 21:26');
  });
});

describe('the check with Google Meet', () => {
  it('under way: which step, how far', () => {
    expect(syncStatus(sync({ running: true, step: 'attendance', progress: { done: 3, total: 9 }, next_at: null }), NOW))
      .toEqual({ tone: 'active', text: 'Checking Google Meet now · Saving who joined · 3 of 9 calls' });
    expect(syncStatus(sync({ running: true, step: 'claimed', next_at: null }), NOW)?.text)
      .toBe('Checking Google Meet now · Looking for new recordings');
  });

  it('between checks: when it last looked and looks next', () => {
    expect(syncStatus(sync(), NOW)).toEqual({
      tone: 'idle', text: 'Last checked with Google Meet at 21:20 (5 min ago) · next check at 21:26',
    });
  });

  it('says so when a check runs far too long', () => {
    expect(syncStatus(sync({ running: true, slow: true, started_at: '2026-09-15T15:40:00Z' }), NOW))
      .toEqual({ tone: 'slow', text: 'Checking Google Meet since 20:40 — taking longer than usual' });
  });

  it('says nothing before the worker has ever run', () => {
    expect(syncStatus(null, NOW)).toBeNull();
  });
});
