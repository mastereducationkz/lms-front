import { describe, expect, it } from 'vitest';
import type { SubstitutionLesson } from '../types';
import { splitSubstitutions, substitutionLink, substitutionStatus } from './substitutionLessons';

const lesson = (event_id: number, over: Partial<SubstitutionLesson> = {}): SubstitutionLesson => ({
  event_id, title: `SAT: Lesson ${event_id}`, start_datetime: `2026-10-${10 + event_id}T13:00:00Z`, end_datetime: `2026-10-${10 + event_id}T14:00:00Z`,
  group_id: 1, group_name: 'SAT', is_online: true, ...over,
});
const later = (start: string) => start >= '2026-10-16';

describe('substitutionStatus', () => {
  it('lists a lesson that owes a register or scores as needing marking', () => {
    expect(substitutionStatus(lesson(1, { owed: { register: 2, scores: 0 }, marked: true }), later)).toBe('owed');
    expect(substitutionStatus(lesson(1, { owed: { register: 0, scores: 3 }, marked: true }), later)).toBe('owed');
  });

  it('does not list a lesson that owes nothing, and waits for one Meet has not decided', () => {
    expect(substitutionStatus(lesson(1, { owed: { register: 0, scores: 0 }, marked: true }), later)).toBe('marked');
    expect(substitutionStatus(lesson(1, { owed: { register: 0, scores: 0 }, marked: false }), later)).toBe('waiting');
  });

  it('puts a lesson on a later day among the upcoming ones, whatever it owes', () => {
    expect(substitutionStatus(lesson(7, { owed: { register: 1, scores: 0 } }), later)).toBe('upcoming');
  });

  it('keeps the old rule when the server sends no `owed`', () => {
    expect(substitutionStatus(lesson(1, { marked: false }), later)).toBe('owed');
    expect(substitutionStatus(lesson(1, { marked: true }), later)).toBe('marked');
    expect(substitutionStatus(lesson(1), later)).toBe('owed');
  });
});

describe('splitSubstitutions', () => {
  it('sorts each section the way the tab always did', () => {
    const sections = splitSubstitutions([
      lesson(1, { owed: { register: 1, scores: 0 } }),
      lesson(3, { owed: { register: 0, scores: 2 } }),
      lesson(2, { owed: { register: 0, scores: 0 }, marked: true }),
      lesson(7), lesson(6),
    ], later);
    expect(sections.needsMarking.map((l) => l.event_id)).toEqual([3, 1]);
    expect(sections.marked.map((l) => l.event_id)).toEqual([2]);
    expect(sections.upcoming.map((l) => l.event_id)).toEqual([6, 7]);
  });
});

describe('substitutionLink', () => {
  it('opens the lesson page — at the register once the lesson has begun', () => {
    expect(substitutionLink(lesson(4), 'owed')).toBe('/lessons/4#register');
    expect(substitutionLink(lesson(4), 'upcoming')).toBe('/lessons/4');
  });
});
