import { describe, expect, it } from 'vitest';
import {
  barFor,
  buildAxis,
  canFixMark,
  canReviewFlag,
  classOrder,
  clearedByReview,
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
  reasonText,
  reportCsv,
  reviewedCount,
  stillLoading,
  tallyByTeacher,
  toParticipantsView,
  canMark,
  rulesText,
  verdictDiffers,
  verdictIndex,
  verdictLine,
  verdictHint,
  verdictText,
  withoutReviewed,
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
    expect(flagText({ code: 'marked_absent_was_in_room', minutes: 50 })).toBe('Marked absent, in the lesson 50 min');
    expect(flagText({ code: 'marked_present_too_short', minutes: 30, required: 45 })).toBe('Marked present, in the lesson 30 of 45 min');
    expect(flagTextRu({ code: 'marked_present_too_short', minutes: 30, required: 45 })).toBe('Отмечен, но на уроке 30 из 45 мин');
    expect(flagText({ code: 'teacher_not_joined' })).toBe('Teacher never joined');
  });

  it('tells marks-disagree flags from timing ones', () => {
    expect(isMismatch('marked_present_not_joined')).toBe(true);
    expect(isMismatch('marked_present_too_short')).toBe(true);
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

  it('reads a lesson whose call has not come through as loading, never as an empty room (2026-09-15)', () => {
    const loading = summary(5, 1, [], { state: 'waiting', teacher: null, students: 0, joined: 0 });
    expect(stillLoading(loading)).toBe(true);
    expect(items.some(stillLoading)).toBe(false);
    expect(needsAttention(loading)).toBe(false);
    const row = reportCsv([loading]).split('\r\n')[1].split(',');
    expect(row).toHaveLength(26);
    expect(row[6]).toBe('"Loading"');
    expect(row.slice(7)).toEqual(Array(19).fill('""'));
    // The recording is known whether or not the call has come through.
    const recorded = reportCsv([{ ...loading, recording: { status: 'waiting', duration_seconds: null } }]).split('\r\n')[1].split(',');
    expect(recorded).toHaveLength(26);
    expect(recorded[25]).toBe('"Waiting for Google Meet"');
  });

  it('says where each lesson’s recording is, with its length once it can be watched', () => {
    const cell = (recording: MeetLessonSummary['recording']) =>
      reportCsv([summary(1, 1, [], { recording })]).split('\r\n')[1].split(',').pop();
    expect(reportCsv([]).split('\r\n')[0].endsWith('"Recording"')).toBe(true);
    expect(cell({ status: 'ready', duration_seconds: 3480 })).toBe('"Ready · 58 min"');
    expect(cell({ status: 'ready', duration_seconds: null })).toBe('"Ready"');
    expect(cell({ status: 'pending', duration_seconds: null })).toBe('"Processing"');
    expect(cell({ status: 'failed', duration_seconds: null })).toBe('"Failed"');
    expect(cell({ status: 'missing', duration_seconds: null })).toBe('"None"');
    expect(cell(undefined)).toBe('""');
  });
});

describe('Meet’s verdict (owner, 2026-09-16)', () => {
  const v = (verdict: 'present' | 'late' | 'absent' | null, extra: Record<string, number> = {}) => ({
    verdict, held_back: verdict === null, minutes: 60, required: 45, late_minutes: 0, ...extra,
  });

  it('says the verdict with its reason, in both languages', () => {
    expect(verdictText(v('present'))).toBe('Present');
    expect(verdictText(v('late', { late_minutes: 12 }))).toBe('Late 12 min');
    expect(verdictText(v('absent', { minutes: 30 }))).toBe('Absent · 30 of 45 min');
    expect(verdictText(v('absent', { minutes: 0 }))).toBe('Absent · not in the lesson');
    expect(verdictText(v(null))).toBe('Not known yet');
    // Held back, it says what the confirmed accounts show, with a «?» — never a bare «not known» beside a
    // confirmed account (2026-09-17: «Google · Алуа» read as the unconfirmed one).
    expect(verdictText({ ...v(null, { late_minutes: 9 }), provisional: 'late' })).toBe('Late 9 min?');
    expect(verdictText({ ...v(null, { minutes: 20 }), provisional: 'absent' }, 'ru')).toBe('Не был: 20 из 45 мин?');
    expect(verdictHint(v(null))).toContain('Someone else in the room');
    expect(verdictHint(v('present'))).toBeNull();
    expect(verdictText(v('absent', { minutes: 30 }), 'ru')).toBe('Не был: 30 из 45 мин');
    expect(verdictText(v('late', { late_minutes: 7 }), 'ru')).toBe('Опоздал на 7 мин');
  });

  it('tells a mark that says something else, ignoring what can’t be compared', () => {
    expect(verdictDiffers('present', v('late'))).toBe(true);
    expect(verdictDiffers('absent', v('absent'))).toBe(false);
    expect(verdictDiffers(null, v('absent'))).toBe(false);
    expect(verdictDiffers('present', v(null))).toBe(false);
    expect(verdictDiffers('removed', v('absent'))).toBe(false);
  });

  it('states the rules from the server’s numbers', () => {
    expect(rulesText({ late_after_minutes: 5, present_share: 0.75 })).toContain('late after 5 min, absent under 75% of the lesson (45 of 60 min)');
    expect(rulesText(undefined)).toBeNull();
  });

  it('reads a lesson’s verdicts in one line and indexes them for the journal', () => {
    const counts = { present: 12, late: 2, absent: 1, held_back: 0, unmarked: 3, applicable: 3, compared: 12, agree: 11 };
    expect(verdictLine(counts)).toBe('Meet: 12 present · 2 late · 1 absent · 3 not marked');
    expect(verdictLine(null)).toBeNull();
    const index = verdictIndex([{ event_id: 5, verdicts: [{ user_id: 7, ...v('late', { late_minutes: 9 }) }] }, { event_id: 6 }]);
    expect(index.get('5:7')?.late_minutes).toBe(9);
    expect(index.size).toBe(1);
  });

  it('files unmarked students and the new disagreement under their issues, and tallies agreement', () => {
    const counts = (unmarked: number, compared: number, agree: number) => ({
      present: 0, late: 0, absent: 0, held_back: 0, unmarked, applicable: unmarked, compared, agree,
    });
    const lessons = [
      summary(1, 1, [S('marked_present_too_short', 'Аяулым', 30)], { verdict_summary: counts(0, 10, 9) }),
      summary(2, 1, [], { verdict_summary: counts(4, 6, 6) }),
      summary(3, 2, []),
    ];
    expect(lessons.filter((i) => hasIssue(i, 'marks_disagree')).map((i) => i.event_id)).toEqual([1]);
    expect(lessons.filter((i) => hasIssue(i, 'not_marked')).map((i) => i.event_id)).toEqual([2]);
    expect(needsAttention(lessons[1])).toBe(false); // not marked is a filter, not attention
    const gulzada = tallyByTeacher(lessons).find((r) => r.name === 'Gulzada');
    expect(gulzada).toMatchObject({ verdict_compared: 16, verdict_agree: 15 });
    const header = reportCsv([]).split('\r\n')[0];
    expect(header).toContain('"Meet: present","Meet: late","Meet: absent","Meet: not known yet","Not marked","Marks agree with Meet"');
    const row = reportCsv([lessons[0]]).split('\r\n')[1];
    expect(row).toContain('"0","0","0","0","0","9 of 10"');
    expect(row).toContain('Аяулым (Marked present, in the lesson 30 of ? min)');
  });

  it('lets only people who mark correct the new disagreement', () => {
    expect(canFixMark('teacher', 'marked_present_too_short')).toBe(true);
    expect(canFixMark('curator', 'marked_present_too_short')).toBe(false);
    expect(canMark('head_curator')).toBe(true);
    expect(canMark('curator')).toBe(false);
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

describe('reviewed flags (owner, 2026-09-11)', () => {
  const excused = { reason_code: 'excused', reason_label: 'Отпросился', text: null, by: 'Гульзада', at: '2026-09-11T16:40:00Z' };
  const answered = { ...S('marked_present_not_joined', 'Аяулым'), review: excused };
  const open = S('marked_present_not_joined', 'Шыңғыс');

  it('says the reason: the preset, the comment, or only the words for «Другое»', () => {
    expect(reasonText(excused)).toBe('Отпросился');
    expect(reasonText({ ...excused, text: 'написала куратору' })).toBe('Отпросился — написала куратору');
    expect(reasonText({ reason_code: 'other', reason_label: 'Другое', text: 'Сидела у брата' })).toBe('Сидела у брата');
    expect(reasonText({ reason_label: 'Другое', text: 'С телефона мамы' })).toBe('С телефона мамы');
    expect(reasonText({ reason_code: null, reason_label: null, text: null })).toBeNull();
    expect(reasonText(null)).toBeNull();
  });

  it('takes a lesson out of Needs attention once everything that put it there is answered', () => {
    const cleared = summary(1, 1, [answered], { mismatches: 0 });
    expect(needsAttention(cleared)).toBe(false);
    expect(clearedByReview(cleared)).toBe(true);
    const half = summary(2, 1, [answered, open], { mismatches: 1 });
    expect(needsAttention(half)).toBe(true);
    expect(clearedByReview(half)).toBe(false);
    const teacher = summary(3, 1, [{ ...T('teacher_late', 9), review: { reason_code: 'tech', reason_label: 'Технические проблемы', text: null } }]);
    expect(needsAttention(teacher)).toBe(false);
    expect(clearedByReview(teacher)).toBe(true);
    // A late student never needed attention, so answering one brings nothing back.
    expect(clearedByReview(summary(4, 1, [{ ...S('late', 'Елдана', 7), review: excused }]))).toBe(false);
  });

  it('hides reviewed flags from issues and tallies until «Show reviewed»', () => {
    const items = [summary(1, 1, [answered, T('teacher_late', 4)]), summary(2, 1, [open])];
    expect(reviewedCount(items)).toBe(1);
    expect(issueCounts(items.map(withoutReviewed)).marks_disagree).toBe(1);
    expect(issueCounts(items).marks_disagree).toBe(2);
    expect(withoutReviewed(items[1])).toBe(items[1]);
  });

  it('reads the headline without the answered ones, and says how many were', () => {
    expect(lessonHeadline(summary(1, 1, [answered, open]))).toBe('1 mark disagree · 1 reviewed');
    expect(lessonHeadline(summary(2, 1, [T('teacher_not_joined')]))).toBe('Teacher never joined');
  });

  it('keeps the answer in the journal index and the spreadsheet', () => {
    const index = mismatchIndex([summary(5, 1, [answered])]);
    expect(index.get('5:7')?.[0].review?.reason_label).toBe('Отпросился');
    expect(reportCsv([summary(6, 1, [answered])])).toContain('"Аяулым (Marked present, never joined; reviewed: Отпросился)"');
  });

  it('lets teachers and curators answer students, and only heads answer the teacher', () => {
    for (const role of ['teacher', 'curator', 'head_curator', 'head_teacher', 'admin']) {
      expect(canReviewFlag(role, 'marked_present_not_joined')).toBe(true);
    }
    expect(canReviewFlag('student', 'late')).toBe(false);
    expect(canReviewFlag('teacher', 'teacher_late')).toBe(false);
    expect(canReviewFlag('curator', 'teacher_not_joined')).toBe(false);
    expect(canReviewFlag('head_teacher', 'ended_early')).toBe(true);
    expect(canFixMark('teacher', 'marked_present_not_joined')).toBe(true);
    expect(canFixMark('curator', 'marked_present_not_joined')).toBe(false);
    expect(canFixMark('admin', 'late')).toBe(false);
  });
});

describe('talk time in the report (owner, 2026-09-11)', () => {
  const talk = (teacher_share: number | null, silent: number[] = []) => ({
    teacher_share, students_share: teacher_share == null ? null : 1 - teacher_share, speech_seconds: 3000,
    teacher_seconds: 2000, silent, seconds: {},
  });

  it('filters by silent students without asking for attention', () => {
    const quiet = summary(1, 1, [], { talk: talk(0.7, [7, 8]) });
    expect(hasIssue(quiet, 'silent_students')).toBe(true);
    expect(needsAttention(quiet)).toBe(false);
    expect(issueCounts([quiet, summary(2, 1, [])]).silent_students).toBe(1);
  });

  it('averages each teacher’s share of the talk over the lessons that have it', () => {
    const [row] = tallyByTeacher([
      summary(1, 1, [], { talk: talk(0.8) }), summary(2, 1, [], { talk: talk(0.6) }), summary(3, 1, [], { talk: null }),
    ]);
    expect(row.talk_lessons).toBe(2);
    expect(row.avg_teacher_share).toBeCloseTo(0.7);
    expect(tallyByTeacher([summary(4, 2, [])])[0].avg_teacher_share).toBeNull();
  });

  it('puts the teacher’s share and the silent students in the spreadsheet', () => {
    const row = reportCsv([summary(1, 1, [], { talk: talk(0.72, [7]) })]).split('\r\n')[1];
    expect(row.endsWith('"72%","1","0","0",""')).toBe(true);
  });
});

describe('Meet took the register (2026-09-23)', () => {
  const withRegister = (states: string[], written: boolean[] = states.map((s) => s === 'written')) => ({
    ...summary(3, 3, []),
    verdicts: states.map((state, i) => ({ user_id: i + 1, verdict: 'absent', held_back: false, provisional: 'absent',
      minutes: 0, required: 45, late_minutes: 0,
      register: { state, mode: 'live', status: 'absent', skip_reason: null, verdict: 'absent', minutes: 0, required: 45,
        late_minutes: 0, override: null, written: written[i] } })),
  }) as never;

  it('filters lessons where a person changed a mark after Meet', () => {
    expect(hasIssue(withRegister(['written', 'override']), 'overrides')).toBe(true);
    expect(hasIssue(withRegister(['written', 'kept']), 'overrides')).toBe(false);
  });

  it('puts what Meet wrote and what was changed in the spreadsheet, before the recording', () => {
    const header = reportCsv([]).split('\r\n')[0];
    expect(header).toContain('"Meet wrote","Changed after Meet","Recording"');
    // Meet wrote all three; a person changed one after — it still counts as Meet's write (the backend's rule).
    const row = reportCsv([withRegister(['written', 'written', 'override'], [true, true, true])]).split('\r\n')[1].split(',');
    expect(row.slice(-3, -1)).toEqual(['"3"', '"1"']);
    const kept = reportCsv([withRegister(['kept', 'override'], [false, false])]).split('\r\n')[1].split(',');
    expect(kept.slice(-3, -1)).toEqual(['"0"', '"1"']);
  });
});
