import { describe, expect, it } from 'vitest';
import type { AttendanceOwed, OwedItem } from '../services/api/attendanceOwed';
import { OWED_PREVIEW, owedByKind, owedLink, previewOwed, registersOwed, scoresOwed } from './attendanceOwed';

const item = (event_id: number, kind: OwedItem['kind']): OwedItem => ({
  event_id, title: `Урок ${event_id}`, group_id: 1, group_name: 'SAT', start: '2026-10-16T13:00:00Z', kind, missing: 3,
});
const owed = (items: OwedItem[], over: Partial<AttendanceOwed> = {}): AttendanceOwed => ({
  items, registers: items.filter((i) => i.kind === 'register').length, scores: items.filter((i) => i.kind === 'scores').length, waiting: 0, ...over,
});

describe('owedByKind', () => {
  it('splits the lessons by what they need and keeps the server’s order', () => {
    const split = owedByKind(owed([item(1, 'scores'), item(2, 'register'), item(3, 'scores')]));
    expect(split.scores.map((i) => i.event_id)).toEqual([1, 3]);
    expect(split.register.map((i) => i.event_id)).toEqual([2]);
  });

  it('is empty without an answer', () => {
    expect(owedByKind(null)).toEqual({ scores: [], register: [] });
    expect(owedByKind(undefined)).toEqual({ scores: [], register: [] });
  });
});

describe('previewOwed', () => {
  const many = Array.from({ length: OWED_PREVIEW + 3 }, (_, i) => i);
  it('shows the first few until the list is opened', () => {
    expect(previewOwed(many, false)).toHaveLength(OWED_PREVIEW);
    expect(previewOwed(many, true)).toHaveLength(OWED_PREVIEW + 3);
    expect(previewOwed([1, 2], false)).toEqual([1, 2]);
  });
});

describe('links and counts', () => {
  it('opens the lesson page at its register', () => {
    expect(owedLink(item(42, 'scores'))).toBe('/lessons/42#register');
  });

  it('counts what the server counted, or what it listed when it counted nothing', () => {
    expect(registersOwed(owed([item(1, 'register')], { registers: 4 }))).toBe(4);
    expect(registersOwed({ items: [item(1, 'register')] } as AttendanceOwed)).toBe(1);
    expect(scoresOwed({ items: [item(1, 'scores'), item(2, 'scores')] } as AttendanceOwed)).toBe(2);
    expect(registersOwed(null)).toBe(0);
    expect(scoresOwed(null)).toBe(0);
  });
});
