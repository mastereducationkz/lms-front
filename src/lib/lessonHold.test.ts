import { describe, expect, it } from 'vitest';
import { canRestoreHold, daysWaiting, holdStateLabelKey, isOpenRequest, isWaitingHold, newTimeProblem } from './lessonHold';

const NOW = new Date('2026-10-15T10:00:00Z'); // 15:00 in Almaty

const hold = (over: Record<string, unknown> = {}) =>
  ({ request_type: 'hold', status: 'approved', hold_state: 'waiting', ...over }) as any;

describe('a hold that waits for a new time', () => {
  it('is still open from the teacher\'s side, an approved cancel is not', () => {
    expect(isWaitingHold(hold())).toBe(true);
    expect(isOpenRequest(hold())).toBe(true);
    expect(isOpenRequest(hold({ status: 'pending', hold_state: null }))).toBe(true);
    expect(isOpenRequest(hold({ hold_state: 'scheduled' }))).toBe(false);
    expect(isOpenRequest({ request_type: 'cancel', status: 'approved' } as any)).toBe(false);
    expect(isWaitingHold({ request_type: 'cancel', status: 'approved', hold_state: 'waiting' } as any)).toBe(false);
  });

  it('names where the lesson is, and says nothing for another kind of request', () => {
    expect(holdStateLabelKey(hold())).toBe('lessonRequests.hold.state.waiting');
    expect(holdStateLabelKey(hold({ hold_state: 'scheduled' }))).toBe('lessonRequests.hold.state.scheduled');
    expect(holdStateLabelKey(hold({ hold_state: 'cancelled' }))).toBe('lessonRequests.hold.state.cancelled');
    expect(holdStateLabelKey(hold({ hold_state: 'restored' }))).toBe('lessonRequests.hold.state.restored');
    expect(holdStateLabelKey(hold({ hold_state: null }))).toBeNull();
    expect(holdStateLabelKey({ request_type: 'cancel', hold_state: null } as any)).toBeNull();
  });
});

describe('days waiting', () => {
  it('counts whole days since the approval', () => {
    expect(daysWaiting('2026-10-15T08:00:00Z', NOW)).toBe(0);
    expect(daysWaiting('2026-10-13T10:00:00Z', NOW)).toBe(2);
    expect(daysWaiting('2026-10-12T09:00:00Z', NOW)).toBe(3);
  });

  it('is unknown without a date, and never negative', () => {
    expect(daysWaiting(null, NOW)).toBeNull();
    expect(daysWaiting('not a date', NOW)).toBeNull();
    expect(daysWaiting('2026-10-20T00:00:00Z', NOW)).toBe(0);
  });
});

describe('putting the lesson back at its original time', () => {
  it('is offered only while that time is still ahead', () => {
    expect(canRestoreHold(hold({ lesson_start_datetime: '2026-10-19T14:00:00Z' }), NOW)).toBe(true);
    expect(canRestoreHold(hold({ lesson_start_datetime: '2026-10-15T09:00:00Z' }), NOW)).toBe(false);
    expect(canRestoreHold(hold({ lesson_start_datetime: null }), NOW)).toBe(false);
    expect(canRestoreHold(hold({ lesson_start_datetime: '2026-10-19T14:00:00Z', hold_state: 'scheduled' }), NOW)).toBe(false);
  });
});

describe('the new time a head types', () => {
  it('must be filled in', () => {
    expect(newTimeProblem('', NOW)).toBe('empty');
    expect(newTimeProblem('2026-10-19', NOW)).toBe('empty');
  });

  it('is read as school time, so 16:00 in Almaty is ahead of 15:00 in Almaty', () => {
    expect(newTimeProblem('2026-10-15T16:00', NOW)).toBeNull();
    expect(newTimeProblem('2026-10-15T15:00', NOW)).toBe('past');
    expect(newTimeProblem('2026-10-14T20:00', NOW)).toBe('past');
    expect(newTimeProblem('2026-10-19T19:00', NOW)).toBeNull();
  });
});
