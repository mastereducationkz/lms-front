import { describe, expect, it } from 'vitest';

import { substitutionBadge } from './substitutionBadge';

const lesson = (over: Record<string, unknown> = {}) => ({
  teacher_id: 2294,
  teacher_name: 'Қайратқызы Дина',
  group_teacher_name: 'Орынбасар Ақжол',
  is_substitution: true,
  ...over,
}) as never;

describe('the substitution badge', () => {
  it('tells the stand-in that they are covering the lesson', () => {
    const badge = substitutionBadge(lesson(), { id: 2294, role: 'teacher' });
    expect(badge?.text).toBe('You are substituting for Орынбасар Ақжол');
    expect(badge?.tone).toBe('covering');
  });

  it("tells the group's own teacher who covered for them", () => {
    const badge = substitutionBadge(lesson(), { id: 777, role: 'teacher' });
    expect(badge?.text).toBe('Substituted by: Қайратқызы Дина');
    expect(badge?.tone).toBe('covered');
  });

  it('names the substitute to an admin, who is substituting nobody', () => {
    const badge = substitutionBadge(lesson(), { id: 1, role: 'admin' });
    expect(badge?.text).toBe('Substitute: Қайратқызы Дина instead of Орынбасар Ақжол');
    expect(badge?.tone).toBe('covered');
  });

  it('names the substitute to a head teacher and a curator too', () => {
    for (const role of ['head_teacher', 'curator', 'head_curator']) {
      expect(substitutionBadge(lesson(), { id: 1, role })?.text)
        .toBe('Substitute: Қайратқызы Дина instead of Орынбасар Ақжол');
    }
  });

  it('still says something useful when the owner is unknown', () => {
    const badge = substitutionBadge(lesson({ group_teacher_name: null }), { id: 1, role: 'admin' });
    expect(badge?.text).toBe('Substitute: Қайратқызы Дина');
  });

  it('falls back when nobody is named', () => {
    const badge = substitutionBadge(lesson({ teacher_name: null }), { id: 1, role: 'admin' });
    expect(badge?.text).toBe('Substitute: another teacher');
  });

  it('says nothing about an ordinary lesson', () => {
    expect(substitutionBadge(lesson({ is_substitution: false }), { id: 1, role: 'admin' })).toBeNull();
    expect(substitutionBadge(lesson({ is_substitution: false }), { id: 2294, role: 'teacher' })).toBeNull();
  });

  it('says nothing to a signed-out reader', () => {
    expect(substitutionBadge(lesson(), null)).toBeNull();
  });
});
