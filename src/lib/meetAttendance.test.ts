import { describe, expect, it } from 'vitest';
import {
  barFor,
  buildAxis,
  clock,
  flagText,
  isMismatch,
  lessonHeadline,
  mismatchIndex,
  position,
} from './meetAttendance';
import type { MeetPresence } from '../services/api/meetAttendance';

// Lesson 19:00–20:00 Almaty = 14:00–15:00 UTC.
const lesson = { start: '2026-09-10T14:00:00Z', end: '2026-09-10T15:00:00Z' };
const row = (...spans: [string, string | null][]): MeetPresence => ({
  sessions: spans.map(([joined_at, left_at]) => ({ joined_at, left_at })),
  joins: spans.length,
  first_join: spans[0]?.[0] ?? null,
  last_leave: spans[spans.length - 1]?.[1] ?? null,
  minutes_in_lesson: 0,
});

describe('clock', () => {
  it('reads the Almaty clock', () => {
    expect(clock('2026-09-10T13:54:07Z')).toBe('18:54');
    expect(clock(null)).toBe('—');
    expect(clock('not a date')).toBe('—');
  });
});

describe('buildAxis', () => {
  it('frames the lesson with ten minutes either side when everyone was on time', () => {
    const axis = buildAxis(lesson, [row(['2026-09-10T14:00:00Z', '2026-09-10T15:00:00Z'])]);
    expect(clock(new Date(axis.from).toISOString())).toBe('18:50');
    expect(clock(new Date(axis.to).toISOString())).toBe('20:10');
    expect(axis.ticks.map((t) => t.label)).toEqual(['19:00', '19:15', '19:30', '19:45', '20:00']);
  });

  it('stretches to an early arrival, but never past thirty minutes', () => {
    const early = buildAxis(lesson, [row(['2026-09-10T13:44:00Z', '2026-09-10T15:03:49Z'])]);
    expect(clock(new Date(early.from).toISOString())).toBe('18:40');
    expect(clock(new Date(early.to).toISOString())).toBe('20:10');
    const hours = buildAxis(lesson, [row(['2026-09-10T11:00:00Z', '2026-09-10T18:00:00Z'])]);
    expect(clock(new Date(hours.from).toISOString())).toBe('18:30');
    expect(clock(new Date(hours.to).toISOString())).toBe('20:30');
  });

  it('thins the ticks on a long axis', () => {
    const long = buildAxis({ start: '2026-09-10T14:00:00Z', end: '2026-09-10T16:30:00Z' }, []);
    expect(long.ticks.map((t) => t.label)).toEqual(['19:00', '19:30', '20:00', '20:30', '21:00', '21:30']);
  });
});

describe('bars', () => {
  const axis = buildAxis(lesson, []);

  it('places a session on the axis', () => {
    expect(position(axis, axis.lessonStart)).toBeCloseTo((10 / 80) * 100);
    const bar = barFor(axis, { joined_at: '2026-09-10T14:00:00Z', left_at: '2026-09-10T15:00:00Z' })!;
    expect(bar.left).toBeCloseTo(12.5);
    expect(bar.width).toBeCloseTo(75);
  });

  it('keeps a few seconds visible and drops an empty or backwards session', () => {
    const blink = barFor(axis, { joined_at: '2026-09-10T14:10:00Z', left_at: '2026-09-10T14:10:05Z' })!;
    expect(blink.width).toBeGreaterThan(0);
    expect(barFor(axis, { joined_at: '2026-09-10T14:10:00Z', left_at: '2026-09-10T14:10:00Z' })).toBeNull();
  });

  it('runs a session that has not closed to now', () => {
    const now = new Date('2026-09-10T14:30:00Z').getTime();
    const open = barFor(axis, { joined_at: '2026-09-10T14:00:00Z', left_at: null }, now)!;
    expect(open.left + open.width).toBeCloseTo(position(axis, now));
  });
});

describe('flags', () => {
  it('says each flag the same way everywhere', () => {
    expect(flagText({ code: 'late', minutes: 7 })).toBe('Late 7 min');
    expect(flagText({ code: 'marked_absent_was_in_room', minutes: 15 })).toBe('Marked absent, in the room 15 min');
    expect(flagText({ code: 'teacher_not_joined' })).toBe('Teacher never joined');
  });

  it('tells marks-disagree flags from timing ones', () => {
    expect(isMismatch('marked_present_not_joined')).toBe(true);
    expect(isMismatch('late')).toBe(false);
  });

  it('reads a lesson in one line, most serious first', () => {
    expect(lessonHeadline({ mismatches: 0, unknown: 0, flags: [] })).toBe('All clear');
    expect(lessonHeadline({
      mismatches: 1,
      unknown: 2,
      flags: [
        { code: 'marked_present_not_joined', user_id: 1, name: 'A', role: 'student' },
        { code: 'teacher_late', minutes: 4, user_id: 9, name: 'T', role: 'teacher' },
        { code: 'late', minutes: 7, user_id: 2, name: 'B', role: 'student' },
      ],
    })).toBe('1 mark disagree · Started 4 min late · 1 late · 2 to confirm');
  });

  it('indexes only students whose marks disagree, for the journal', () => {
    const index = mismatchIndex([{
      event_id: 5,
      flags: [
        { code: 'marked_present_not_joined', user_id: 1, name: 'A', role: 'student' },
        { code: 'late', minutes: 7, user_id: 2, name: 'B', role: 'student' },
        { code: 'teacher_not_joined', user_id: 9, name: 'T', role: 'teacher' },
      ],
    }]);
    expect([...index.keys()]).toEqual(['5:1']);
  });
});
