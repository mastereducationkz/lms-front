import { describe, expect, it } from 'vitest';
import { attendanceBadge } from './attendanceBadge';

describe('attendanceBadge', () => {
  it('shows nothing when no register is owed', () => {
    expect(attendanceBadge({ total: 0, waiting: 0 })).toEqual({ count: 0, tone: 'none' });
  });

  it('is actionable when a register can be taken right now', () => {
    expect(attendanceBadge({ total: 2, waiting: 0 })).toEqual({ count: 2, tone: 'action' });
  });

  it('is muted while every owed register is still waiting on Google Meet', () => {
    // Nothing the teacher could do yet, so the badge must not shout at them.
    expect(attendanceBadge({ total: 2, waiting: 2 })).toEqual({ count: 2, tone: 'waiting' });
  });

  it('is actionable as soon as one of several stops waiting', () => {
    // This flip is the whole feature: it is how a teacher learns Meet's data has landed.
    expect(attendanceBadge({ total: 3, waiting: 2 })).toEqual({ count: 3, tone: 'action' });
  });

  it('treats a nonsensical waiting count as still waiting rather than shouting', () => {
    expect(attendanceBadge({ total: 1, waiting: 4 })).toEqual({ count: 1, tone: 'waiting' });
  });

  it('shows nothing before the first poll has answered', () => {
    expect(attendanceBadge(undefined)).toEqual({ count: 0, tone: 'none' });
  });
});
