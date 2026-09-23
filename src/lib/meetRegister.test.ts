import { describe, expect, it } from 'vitest';
import type { RegisterCounts, StudentRegister } from '../services/api/meetRegister';
import {
  overrideFlag, overridesToAsk, reasonComplete, reasonPayload, registerIndex, registerNote, registerSummary,
  scoreDue,
} from './meetRegister';

const reg = (over: Partial<StudentRegister> = {}): StudentRegister => ({
  state: 'written', mode: 'live', status: 'absent', skip_reason: null, verdict: 'absent',
  minutes: 0, required: 45, late_minutes: 0, override: null, ...over,
});

describe('overrideFlag', () => {
  it('names the flag a contradicting mark raises', () => {
    expect(overrideFlag(reg(), 'attended')).toBe('marked_present_not_joined');
    expect(overrideFlag(reg({ minutes: 20 }), 'late')).toBe('marked_present_too_short');
    expect(overrideFlag(reg({ verdict: 'present', status: 'present', minutes: 55 }), 'missed')).toBe('marked_absent_was_in_room');
  });
  it('asks nothing when the mark agrees about attending, or Meet did not decide it', () => {
    expect(overrideFlag(reg({ verdict: 'late', status: 'late', minutes: 50 }), 'attended')).toBeNull();
    expect(overrideFlag(reg(), 'missed')).toBeNull();
    expect(overrideFlag(reg({ state: 'held', verdict: null }), 'attended')).toBeNull();
    expect(overrideFlag(reg({ state: 'override' }), 'attended')).toBeNull();
    expect(overrideFlag(reg({ mode: 'shadow', state: 'would_write' }), 'attended')).toBeNull();
    expect(overrideFlag(undefined, 'attended')).toBeNull();
  });
});

describe('overridesToAsk', () => {
  const students = [
    { student_id: 1, student_name: 'Аяулым', lessons: { '3': { attendance_status: 'attended', event_id: 10 } } },
    { student_id: 2, student_name: 'Елдана', lessons: { '3': { attendance_status: 'attended', event_id: 10 } } },
  ];
  const register = new Map([['10:1', reg()], ['10:2', reg()]]);
  it('asks only for changed students, once per cell, and not again once answered', () => {
    const ask = overridesToAsk(students, new Set([1]), register, new Map(), (k) => `Урок ${k}`);
    expect(ask).toEqual([{ key: '1:3', studentName: 'Аяулым', lessonLabel: 'Урок 3', flag: 'marked_present_not_joined' }]);
    expect(overridesToAsk(students, new Set([1]), register, new Map([['1:3', { code: 'excused', text: null }]]), (k) => k)).toEqual([]);
  });
});

describe('reasons', () => {
  it('needs a preset, and words for «Другое»', () => {
    expect(reasonComplete(undefined)).toBe(false);
    expect(reasonComplete({ code: 'excused', text: null })).toBe(true);
    expect(reasonComplete({ code: 'other', text: '  ' })).toBe(false);
    expect(reasonComplete({ code: 'other', text: 'болел' })).toBe(true);
  });
  it('sends a reason only where one was given', () => {
    expect(reasonPayload(undefined)).toEqual({});
    expect(reasonPayload({ code: 'other', text: 'болел' })).toEqual({ override_reason_code: 'other', override_reason_text: 'болел' });
  });
});

describe('scoreDue', () => {
  it('asks for a score on present students of lessons Meet marked', () => {
    expect(scoreDue(reg({ status: 'present', verdict: 'present' }), 'attended', null)).toBe(true);
    expect(scoreDue(reg({ status: 'present', verdict: 'present' }), 'attended', 7)).toBe(false);
    expect(scoreDue(reg({ state: 'kept', status: 'late', verdict: 'late' }), 'late', undefined)).toBe(true);
    expect(scoreDue(reg(), 'missed', null)).toBe(false);
    expect(scoreDue(reg({ mode: 'shadow', state: 'would_write' }), 'attended', null)).toBe(false);
    expect(scoreDue(undefined, 'attended', null)).toBe(false);
  });
});

describe('registerNote', () => {
  it('says what Meet did, in the viewer’s language', () => {
    expect(registerNote(reg({ status: 'late', verdict: 'late', minutes: 50, late_minutes: 7 }), 'ru'))
      .toBe('Meet отметил: опоздал · 50 мин (нужно 45) · опоздание 7 мин');
    expect(registerNote(reg({ status: 'present', verdict: 'present', minutes: 60 }), 'en'))
      .toBe('Marked by Meet: present · 60 min (45 needed)');
    expect(registerNote(reg({ state: 'held', verdict: null, skip_reason: 'held_back' }), 'en'))
      .toBe('Meet: waiting — an unconfirmed account was in the room');
  });
  it('adds a person’s change with the reason and who made it, without repeating Meet’s verdict', () => {
    const o = { status: 'present', reason_code: 'excused', reason_label: 'Отпросился', text: null, by: 'Гульзада', at: '2026-10-05T14:00:00Z', via: 'lms' as const };
    expect(registerNote(reg({ state: 'override', override: o }), 'ru'))
      .toBe('Изменено: был — Отпросился (Гульзада)');
    expect(registerNote(reg({ state: 'override', override: { ...o, reason_code: null, reason_label: null, by: null, via: 'external' } }), 'ru'))
      .toBe('Изменено: был — без причины (вне LMS)');
  });
  it('says a reverted mark was undone', () => {
    expect(registerNote(reg({ state: 'reverted' }), 'ru')).toBe('Meet: отметка Meet отменена (откат)');
    expect(registerNote(reg({ state: 'reverted' }), 'en')).toBe('Meet: its mark was undone');
  });
});

describe('registerIndex', () => {
  it('keys by lesson and student', () => {
    const index = registerIndex([{ event_id: 10, verdicts: [{ user_id: 1, register: reg() }] }] as never);
    expect(index.get('10:1')?.state).toBe('written');
  });
});

describe('registerSummary', () => {
  const counts = (over: Partial<RegisterCounts> = {}): RegisterCounts => ({
    lessons: 1, decided: 1, writes: 1, changes: 1, held: 1, overrides: 1, left_alone: {}, ...over,
  });
  it('counts in words that agree with the numbers', () => {
    expect(registerSummary(counts(), true))
      .toBe('1 lesson · Meet wrote 1 mark · 1 student waited for a teacher · 1 changed after Meet');
    expect(registerSummary(counts({ lessons: 2, writes: 3, held: 0, overrides: 2 }), true))
      .toBe('2 lessons · Meet wrote 3 marks · 0 students waited for a teacher · 2 changed after Meet');
    expect(registerSummary(counts(), false))
      .toBe('1 lesson · Meet would write 1 mark · 1 would contradict the teacher (present ↔ absent) · 1 student would wait for a teacher');
  });
});
