import { describe, expect, it } from 'vitest';
import { attendanceBadge } from './attendanceBadge';

describe('attendanceBadge', () => {
  it('shows nothing when no register is owed', () => {
    expect(attendanceBadge({ total: 0, waiting: 0 })).toEqual({ count: 0, tone: 'none', title: null });
  });

  it('is actionable when a register can be taken right now', () => {
    expect(attendanceBadge({ total: 2, waiting: 0 })).toEqual({ count: 2, tone: 'action', title: '2 to mark' });
  });

  it('is muted while every owed register is still waiting on Google Meet', () => {
    // Nothing the teacher could do yet, so the badge must not shout at them.
    expect(attendanceBadge({ total: 2, waiting: 2 })).toEqual({ count: 2, tone: 'waiting', title: '2 waiting on Meet' });
  });

  it('is actionable as soon as one of several stops waiting', () => {
    // This flip is the whole feature: it is how a teacher learns Meet's data has landed.
    expect(attendanceBadge({ total: 3, waiting: 2 })).toEqual({ count: 3, tone: 'action', title: '1 to mark · 2 waiting on Meet' });
  });

  it('treats a nonsensical waiting count as still waiting rather than shouting', () => {
    expect(attendanceBadge({ total: 1, waiting: 4 }).tone).toBe('waiting');
  });

  it('shows nothing before the first poll has answered', () => {
    expect(attendanceBadge(undefined)).toEqual({ count: 0, tone: 'none', title: null });
  });

  it('asks for activity scores once Meet takes the register', () => {
    expect(attendanceBadge({ total: 0, waiting: 0, scores: 2 })).toEqual({ count: 2, tone: 'action', title: '2 need activity scores' });
    expect(attendanceBadge({ total: 1, waiting: 1, scores: 1 })).toEqual({ count: 2, tone: 'action', title: '1 waiting on Meet · 1 need activity scores' });
  });
});
