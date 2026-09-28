import { describe, expect, it } from 'vitest';
import { groupLine, lessonChips, todaySummary } from './todayLessons';
import type { TodayLesson } from '../services/api/classLessons';

const base: TodayLesson = {
  id: 1, title: 'IELTS Oct - Лайла: Lesson 26', topic: null,
  start: '2026-10-05T13:00:00Z', end: '2026-10-05T14:00:00Z', status: 'finished',
  groups: [{ id: 9, name: 'IELTS Oct - Лайла', lesson_number: 26 }],
  join: { url: null, opens_at: '2026-10-05T12:50:00Z' },
  register: { students: 12, meet_marks: false, unmarked: 3, scores_missing: 5 },
  homework: false, plan: false, recap: false, recording: null, live: null,
  todo: ['marks', 'scores', 'homework', 'recap'], done: false,
};
const keys = (l: TodayLesson, locale: 'ru' | 'en' = 'en') => lessonChips(l, locale).map((c) => c.key);

describe('lessonChips', () => {
  it('lists what is left, most urgent first, each leading to its section', () => {
    const chips = lessonChips(base, 'en');
    expect(chips.map((c) => [c.key, c.label, c.section])).toEqual([
      ['marks', '3 not marked', 'register'],
      ['scores', '5 scores missing', 'register'],
      ['homework', 'No homework', 'homework'],
      ['recap', 'No recap', 'notes'],
    ]);
    expect(lessonChips(base, 'ru').map((c) => c.label)).toEqual(['3 не отмечены', 'Без балла: 5', 'Нет ДЗ', 'Нет итогов']);
  });
  it('says Meet takes the register instead of asking for marks', () => {
    const meet = { ...base, register: { ...base.register!, meet_marks: true }, todo: ['scores' as const] };
    expect(keys(meet)).toEqual(['meet', 'scores']);
  });
  it('shows the live room, a ready recording, and «all done»', () => {
    const live = { ...base, status: 'live' as const, todo: [], live: { updated_at: '', teacher_in: true, in_room: 9, expected: 12, missing: [], unknown: 0 } };
    expect(lessonChips(live, 'en')[0].label).toBe('9 of 12 in the room');
    const done = { ...base, todo: [], done: true, recording: { status: 'ready' as const } };
    expect(keys(done)).toEqual(['done', 'recording']);
  });
  it('a cancelled lesson says only that', () => {
    expect(keys({ ...base, status: 'cancelled' })).toEqual(['cancelled']);
  });
});

describe('todaySummary', () => {
  const clock = (iso: string) => iso.slice(11, 16);
  const up = { ...base, id: 2, status: 'upcoming' as const, start: '2026-10-05T15:00:00Z', todo: ['homework' as const], register: null };
  it('counts lessons, names what is next and how many need the teacher', () => {
    expect(todaySummary([base, up], new Date('2026-10-05T14:30:00Z'), 'en', clock))
      .toBe('2 lessons · next at 15:00 · 1 needs you');
    expect(todaySummary([base, up], new Date('2026-10-05T14:30:00Z'), 'ru', clock))
      .toBe('2 урока · следующий в 15:00 · ждут действий: 1');
  });
  it('all done when every lesson is', () => {
    expect(todaySummary([{ ...base, todo: [], done: true }], new Date('2026-10-05T20:00:00Z'), 'en', clock))
      .toBe('1 lesson · all done');
  });
});

describe('groupLine', () => {
  it('drops the teacher from the group name and adds the lesson number', () => {
    expect(groupLine(base, 'en')).toBe('IELTS Oct · lesson 26');
    expect(groupLine({ ...base, groups: [] }, 'ru')).toBe('IELTS Oct - Лайла: Lesson 26');
  });
});
