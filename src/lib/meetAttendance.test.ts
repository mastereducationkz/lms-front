import { describe, expect, it } from 'vitest';
import {
  barFor,
  buildAxis,
  classOrder,
  clock,
  flagTextRu,
  flagText,
  hasIssue,
  isMismatch,
  issueCounts,
  lessonHeadline,
  mismatchIndex,
  needsAttention,
  position,
  reportCsv,
  tallyByTeacher,
  toParticipantsView,
} from './meetAttendance';
import type { MeetLessonSummary, MeetPresence, MeetRecord } from '../services/api/meetAttendance';

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


const summary = (id: number, teacherId: number, flags: MeetLessonSummary['flags'], extra: Partial<MeetLessonSummary> = {}): MeetLessonSummary => ({
  event_id: id, title: `Lesson ${id}`, start: '2026-09-10T14:00:00Z', end: '2026-09-10T15:00:00Z', state: 'ready',
  groups: [{ id: 1, name: 'July 8 SAT - Gulzada' }],
  teacher: { id: teacherId, name: teacherId === 1 ? 'Gulzada' : 'Aisha', first_join: '2026-09-10T14:04:00Z', last_leave: '2026-09-10T14:52:00Z' },
  students: 11, joined: 10, unknown: 0, held_back: false,
  mismatches: flags.filter((f) => f.code.startsWith('marked') || f.code === 'teacher_not_joined').length,
  flags, ...extra,
});
const T = (code: MeetLessonSummary['flags'][number]['code'], minutes?: number) => ({ code, minutes, user_id: 1, name: 'Gulzada', role: 'teacher' });
const S = (code: MeetLessonSummary['flags'][number]['code'], name = 'Аяулым', minutes?: number) => ({ code, minutes, user_id: 7, name, role: 'student' });

describe('reporting', () => {
  const items = [
    summary(1, 1, [T('teacher_late', 4), T('ended_early', 8), S('late', 'Аяулым', 7)]),
    summary(2, 1, [T('teacher_late', 12)]),
    summary(3, 2, [S('marked_present_not_joined', 'Шыңғыс, "Шока"')], { unknown: 2 }),
    summary(4, 2, [S('left_early', 'Елдана', 15)]),
  ];

  it('filters by issue, keeping teacher timing apart from student timing', () => {
    expect(items.filter((i) => hasIssue(i, 'teacher_late')).map((i) => i.event_id)).toEqual([1, 2]);
    expect(items.filter((i) => hasIssue(i, 'students_late')).map((i) => i.event_id)).toEqual([1]);
    expect(items.filter((i) => hasIssue(i, 'marks_disagree')).map((i) => i.event_id)).toEqual([3]);
    expect(items.filter((i) => hasIssue(i, 'to_confirm')).map((i) => i.event_id)).toEqual([3]);
  });

  it('counts each issue once per lesson', () => {
    expect(issueCounts(items)).toMatchObject({ teacher_late: 2, ended_early: 1, marks_disagree: 1, students_late: 1, left_early: 1, to_confirm: 1, teacher_not_joined: 0 });
  });

  it('asks for attention only where someone must act', () => {
    expect(items.map(needsAttention)).toEqual([true, true, true, false]);
  });

  it('tallies teachers, the one with most to discuss first', () => {
    const [first, second] = tallyByTeacher(items);
    expect(first).toMatchObject({ name: 'Gulzada', lessons: 2, teacher_late: 2, late_minutes: 16, ended_early: 1 });
    expect(second).toMatchObject({ name: 'Aisha', lessons: 2, marks_disagree: 1, to_confirm: 1 });
  });

  it('writes a spreadsheet Excel reads, with names quoted safely', () => {
    const csv = reportCsv(items);
    expect(csv.startsWith('﻿"Date","Start"')).toBe(true);
    const row1 = csv.split('\r\n')[1];
    expect(row1).toContain('"10/09/2026","19:00","20:00"');
    expect(row1).toContain('"Started 4 min late; Ended 8 min early"');
    expect(csv).toContain('"Шыңғыс, ""Шока"" (Marked present, never joined)"');
  });
});

describe('the class beside a recording', () => {
  const person = (name: string, first_join: string | null, mark: 'present' | 'absent' | null = 'present') => ({
    user_id: 1, name, role: 'student', mark, accounts: [], flags: [], sessions: [], joins: first_join ? 1 : 0,
    first_join, last_leave: first_join ? '2026-09-10T15:00:00Z' : null, minutes_in_lesson: first_join ? 60 : 0,
  });

  it('without a Meet record it is still the whole class, with marks', () => {
    const view = toParticipantsView({
      event_id: 1, title: 'L', start: '2026-09-10T14:00:00Z', end: '2026-09-10T15:00:00Z', state: 'no_room',
      roster: [{ user_id: 1, name: 'Аяулым', mark: 'present' }, { user_id: 2, name: 'Елдана', mark: null }],
    } as MeetRecord);
    expect(view.students.map((s) => [s.name, s.mark, s.first_join])).toEqual([['Аяулым', 'present', null], ['Елдана', null, null]]);
    expect(view.teacher).toBeNull();
  });

  it('lists who was in the room first, then who was not', () => {
    const rows = classOrder([person('Шыңғыс', null), person('Елдана', '2026-09-10T14:00:00Z'), person('Аяулым', '2026-09-10T14:07:00Z'), person('Айым', null, 'absent')]);
    expect(rows.map((r) => r.name)).toEqual(['Аяулым', 'Елдана', 'Айым', 'Шыңғыс']);
  });

  it('speaks Russian to accountants', () => {
    expect(flagTextRu({ code: 'late', minutes: 7 })).toBe('Опоздал на 7 мин');
    expect(flagTextRu({ code: 'marked_present_not_joined' })).toBe('Отмечен, но не заходил');
    expect(flagTextRu({ code: 'teacher_late', minutes: 4 })).toBe('Начал на 4 мин позже');
  });
});
