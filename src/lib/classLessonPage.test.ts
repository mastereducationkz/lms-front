import { describe, expect, it } from 'vitest';
import {
  almatyDay, asCalendarEvent, clockKz, heldLessonLink, joinState, journalUrl, lessonWhen, markEditable, registerChanges, registerSummary,
  scoreEditable, sectionFromHash, sectionOrder, stampKz, summaryLine,
} from './classLessonPage';
import type { LessonView, RegisterStudent } from '../services/api/classLessons';

const staff = { is_staff: true, is_student: false, can_view_meet: true };
const student = { is_staff: false, is_student: true, can_view_meet: false };
const all = { hasRegister: true, hasMe: true, hasLive: true, hasRequests: true, hasRecording: true, hasMeet: true };

describe('sectionOrder', () => {
  it('puts what matters now first, by status', () => {
    expect(sectionOrder('upcoming', { viewer: staff, ...all })).toEqual(['materials', 'homework', 'notes', 'requests']);
    expect(sectionOrder('live', { viewer: staff, ...all })[0]).toBe('live');
    expect(sectionOrder('finished', { viewer: staff, ...all }).slice(0, 2)).toEqual(['recording', 'register']);
  });
  it('never shows a student the register, the live room, Meet or requests', () => {
    expect(sectionOrder('finished', { viewer: student, ...all }))
      .toEqual(['me', 'recording', 'notes', 'homework', 'materials']);
    expect(sectionOrder('live', { viewer: student, ...all })).toEqual(['materials', 'notes', 'homework']);
  });
  it('drops sections the payload has nothing for', () => {
    const none = { hasRegister: false, hasMe: false, hasLive: false, hasRequests: false, hasRecording: false, hasMeet: false };
    expect(sectionOrder('live', { viewer: staff, ...none })).toEqual(['materials', 'notes', 'homework']);
    expect(sectionOrder('finished', { viewer: { ...staff, can_view_meet: false }, ...all })).not.toContain('meet');
    expect(sectionOrder('finished', { viewer: staff, ...all, hasRecording: false, hasMeet: false }))
      .toEqual(['register', 'notes', 'homework', 'materials', 'requests']);
  });
});

describe('sectionOrder: live-lesson activities', () => {
  it('shows «Activities» to whoever may run them, and to anyone with something listed', () => {
    expect(sectionOrder('live', { viewer: staff, ...all, canDriveLive: true }).slice(0, 2)).toEqual(['live', 'activities']);
    expect(sectionOrder('upcoming', { viewer: staff, ...all, canDriveLive: true })[0]).toBe('activities');
    expect(sectionOrder('finished', { viewer: student, ...all, hasActivities: true }))
      .toEqual(['me', 'recording', 'activities', 'notes', 'homework', 'materials']);
    expect(sectionOrder('finished', { viewer: student, ...all })).not.toContain('activities');
    expect(sectionFromHash('#activities')).toBe('activities');
  });
});

describe('joinState', () => {
  const base = { status: 'upcoming' as const, join: { url: 'https://meet.google.com/abc-defg-hij', opens_at: '2026-09-28T12:50:00' }, end: '2026-09-28T14:00:00' };
  it('opens ten minutes before and closes at the end', () => {
    expect(joinState(base, new Date('2026-09-28T12:40:00Z'))).toEqual({ kind: 'soon', opensAt: new Date('2026-09-28T12:50:00Z') });
    expect(joinState(base, new Date('2026-09-28T12:50:00Z'))).toEqual({ kind: 'open' });
    expect(joinState({ ...base, status: 'live' }, new Date('2026-09-28T13:30:00Z'))).toEqual({ kind: 'open' });
    expect(joinState({ ...base, status: 'live' }, new Date('2026-09-28T14:00:00Z'))).toEqual({ kind: 'hidden' });
  });
  it('is hidden without a link, when cancelled or finished', () => {
    const now = new Date('2026-09-28T13:00:00Z');
    expect(joinState({ ...base, join: { url: null, opens_at: null } }, now).kind).toBe('hidden');
    expect(joinState({ ...base, status: 'cancelled' }, now).kind).toBe('hidden');
    expect(joinState({ ...base, status: 'finished' }, now).kind).toBe('hidden');
  });
});

const row = (over: Partial<RegisterStudent> = {}): RegisterStudent => ({
  user_id: 1, name: 'A', group_id: 1, status: 'attended', marked: true, excused: false, excuse_note: null,
  activity_score: null, state: null, meet: null, ...over,
});

describe('register editing', () => {
  it('locks frozen, no-access, cancelled and removed rows', () => {
    expect(markEditable(row(), true)).toBe(true);
    expect(markEditable(row(), false)).toBe(false);
    expect(markEditable(row({ state: 'frozen' }), true)).toBe(false);
    expect(markEditable(row({ status: 'removed' }), true)).toBe(false);
  });
  it('scores only students who came or are not marked yet', () => {
    expect(scoreEditable(row(), 'attended', true)).toBe(true);
    expect(scoreEditable(row(), 'registered', true)).toBe(true);
    expect(scoreEditable(row(), 'missed', true)).toBe(false);
    expect(scoreEditable(row({ state: 'no_access' }), 'attended', true)).toBe(false);
  });
  it('sends changed marks and scores, never a score for an absence', () => {
    const students = [
      row({ user_id: 1, status: 'attended', activity_score: 5 }),
      row({ user_id: 2, status: 'registered', marked: false }),
      row({ user_id: 3, status: 'attended' }),
      row({ user_id: 4, status: 'late', activity_score: 7 }),
    ];
    const draft = {
      status: new Map([[2, 'late' as const], [3, 'missed' as const], [4, 'late' as const]]),
      score: new Map([[1, 5], [2, 6], [3, 4], [4, 9]]),
    };
    expect(registerChanges(students, draft)).toEqual({
      marks: [{ student_id: 2, status: 'late' }, { student_id: 3, status: 'missed' }],
      scores: [{ student_id: 2, activity_score: 6 }, { student_id: 4, activity_score: 9 }],
    });
  });
});

describe('register editing: excused absences', () => {
  const draft = (excuse: Map<number, { excused: boolean; note: string | null }>) => ({ status: new Map(), score: new Map(), excuse });

  it('turns an unmarked student into an excused absence — the advance excuse', () => {
    const students = [row({ user_id: 1, status: 'registered', marked: false })];
    expect(registerChanges(students, draft(new Map([[1, { excused: true, note: '  болеет ' }]])))).toEqual({
      marks: [{ student_id: 1, status: 'missed', excused: true, excuse_note: 'болеет' }],
      scores: [],
    });
  });

  it('sends an excuse alone when the absence stays, and nothing when the excuse stays too', () => {
    const students = [
      row({ user_id: 1, status: 'missed', excused: false }),
      row({ user_id: 2, status: 'missed', excused: true, excuse_note: 'болеет' }),
      row({ user_id: 3, status: 'missed', excused: true, excuse_note: 'болеет' }),
    ];
    const excuse = new Map([
      [1, { excused: true, note: 'олимпиада' }],
      [2, { excused: false, note: null }],
      [3, { excused: true, note: 'болеет' }],
    ]);
    expect(registerChanges(students, draft(excuse)).marks).toEqual([
      { student_id: 1, status: 'missed', excused: true, excuse_note: 'олимпиада' },
      { student_id: 2, status: 'missed', excused: false, excuse_note: null },
    ]);
  });

  it('never scores an excused absence, and leaves untouched rows without excuse fields', () => {
    const students = [row({ user_id: 1, status: 'attended' }), row({ user_id: 2, status: 'registered', marked: false })];
    const changes = registerChanges(students, {
      status: new Map(), score: new Map([[2, 7]]), excuse: new Map([[2, { excused: true, note: 'болеет' }]]),
    });
    expect(changes.scores).toEqual([]);
    expect(changes.marks).toEqual([{ student_id: 2, status: 'missed', excused: true, excuse_note: 'болеет' }]);
  });

  it('corrects a Meet mark to an excused absence in one row', () => {
    const students = [row({ user_id: 1, status: 'attended' })];
    const changes = registerChanges(students, {
      status: new Map([[1, 'missed' as const]]), score: new Map(), excuse: new Map([[1, { excused: true, note: 'олимпиада' }]]),
    });
    expect(changes.marks).toEqual([{ student_id: 1, status: 'missed', excused: true, excuse_note: 'олимпиада' }]);
  });
});

describe('registerSummary', () => {
  it('counts marks and scores among those who came, skipping frozen rows', () => {
    const s = registerSummary([
      { status: 'attended', activity_score: 8 }, { status: 'late', activity_score: null },
      { status: 'missed', activity_score: null }, { status: 'registered', activity_score: 5 },
      { status: 'attended', activity_score: null, state: 'frozen' },
    ]);
    expect(s).toEqual({ present: 1, late: 1, absent: 1, unmarked: 1, scored: 1, attended: 2 });
    expect(summaryLine(s, 'ru')).toBe('Был 1 · Опоздал 1 · Не был 1 · Не отмечено 1 · баллы 1/2');
    expect(summaryLine({ ...s, unmarked: 0 }, 'en')).toBe('Present 1 · Late 1 · Absent 1 · scores 1/2');
  });
});

describe('times, on the school clock in the viewer\'s language', () => {
  it('writes the lesson slot, a clock time and a stamp in both languages', () => {
    expect(lessonWhen('2026-09-28T13:00:00', '2026-09-28T14:00:00', 'en')).toBe('Mon 28 Sept, 18:00–19:00');
    expect(lessonWhen('2026-09-28T13:00:00', '2026-09-28T14:00:00', 'ru')).toBe('пн, 28 сент., 18:00–19:00');
    expect(clockKz(new Date('2026-09-28T12:50:00Z'), 'en')).toBe('17:50');
    expect(stampKz('2026-09-28T13:05:00', 'en')).toBe('28 Sept, 18:05');
    expect(stampKz('2026-09-28T13:05:00', 'ru')).toBe('28 сент., 18:05');
  });
});

describe('links', () => {
  it('opens the journal at the lesson week, by role', () => {
    expect(journalUrl('teacher', 12, '2026-09-28T19:30:00')).toBe('/attendance?groupId=12&date=2026-09-29');
    expect(journalUrl('curator', 12, '2026-09-28T13:00:00')).toBe('/curator/leaderboard?groupId=12&date=2026-09-28');
    expect(journalUrl('student', 12, '2026-09-28T13:00:00')).toBeNull();
    expect(almatyDay('2026-09-28T18:59:59')).toBe('2026-09-28');
  });
  it('knows its anchors', () => {
    expect(sectionFromHash('#materials')).toBe('materials');
    expect(sectionFromHash('#nope')).toBeNull();
    expect(sectionFromHash('')).toBeNull();
  });
  it('builds the calendar event shape the old sections take', () => {
    const view = {
      id: 5, title: 'T', start: 's', end: 'e', status: 'finished', join: { url: 'u', opens_at: null },
      groups: [{ id: 1, name: 'G', lesson_number: 1, prev: null, next: null }], teacher: { id: 2, name: 'N' },
      is_substitution: false,
    } as unknown as LessonView;
    const ev = asCalendarEvent(view);
    expect([ev.id, ev.event_type, ev.meeting_url, ev.group_ids, ev.teacher_id]).toEqual([5, 'class', 'u', [1], 2]);
  });
});

describe('heldLessonLink', () => {
  it('sends whoever can set the time to the queue of held lessons, and the teacher to their own requests', () => {
    expect(heldLessonLink('admin')).toEqual({ to: '/admin/lesson-requests?tab=holds', label: 'classLesson.page.heldSetTime' });
    expect(heldLessonLink('head_teacher')?.to).toBe('/head-teacher/lesson-requests?tab=holds');
    expect(heldLessonLink('head_curator')?.to).toBe('/head-teacher/lesson-requests?tab=holds');
    expect(heldLessonLink('teacher')).toEqual({ to: '/my-requests', label: 'classLesson.page.heldPropose' });
  });

  it('has nothing for a student or a curator, who can do nothing about it', () => {
    expect(heldLessonLink('student')).toBeNull();
    expect(heldLessonLink('curator')).toBeNull();
  });
});
