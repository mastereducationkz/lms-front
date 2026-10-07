import { describe, expect, it } from 'vitest';
import type { Group } from '@/types';
import { groupsFromStaffRows, groupsWithContacts, programChip } from './profileGroups';

const group = (over: Partial<Group>): Group => ({
  id: 1, name: 'SAT Oct-26 Timur', student_count: 0, created_at: '2026-10-01', is_active: true, is_over: false,
  teacher_id: 5, curator_id: 6, program_type: 'sat', ...over,
} as Group);

describe('profile groups', () => {
  it('names a student’s teacher and curator from the people they can message', () => {
    const rows = groupsWithContacts([group({})], [
      { user_id: 6, name: 'Aigerim Nurlanova', role: 'curator', avatar_url: null, mascot: null },
      { user_id: 5, name: 'Timur Akhmetov', role: 'teacher', avatar_url: '/a.png', mascot: null },
      { user_id: 9, name: 'Asel Demo-Admin', role: 'admin' },
    ]);
    expect(rows).toEqual([{
      id: 1, name: 'SAT Oct-26 Timur', program: 'sat',
      teacher: { id: 5, name: 'Timur Akhmetov', avatarUrl: '/a.png', mascot: null },
      curator: { id: 6, name: 'Aigerim Nurlanova', avatarUrl: null, mascot: null },
    }]);
  });

  it('leaves a person out rather than showing a bare id', () => {
    const [row] = groupsWithContacts([group({ curator_id: 42 })], [{ user_id: 5, name: 'Timur Akhmetov', role: 'teacher' }]);
    expect(row.teacher?.name).toBe('Timur Akhmetov');
    expect(row.curator).toBeNull();
  });

  it('drops finished and archived groups', () => {
    const rows = groupsFromStaffRows([
      group({ id: 1, teacher_name: 'T', curator_name: 'C' }),
      group({ id: 2, is_over: true }),
      group({ id: 3, is_active: false }),
    ]);
    expect(rows.map((r) => r.id)).toEqual([1]);
    expect(rows[0].curator).toEqual({ id: 6, name: 'C' });
  });

  it('labels the programmes it knows', () => {
    expect(programChip('general_english')).toBe('English');
    expect(programChip('ielts')).toBe('IELTS');
    expect(programChip('robotics')).toBeNull();
    expect(programChip(null)).toBeNull();
  });
});
