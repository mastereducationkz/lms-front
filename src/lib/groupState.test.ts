import { describe, expect, it } from 'vitest';
import { defaultGroupState, groupOptionLabel } from './groupState';

describe('defaultGroupState', () => {
  it('roles with a group scope start on the running groups, as they always did', () => {
    for (const role of ['teacher', 'curator', 'head_teacher']) expect(defaultGroupState(role)).toBe('running');
  });

  it('admin and head curator start on everything - they always saw every student', () => {
    expect(defaultGroupState('admin')).toBe('all');
    expect(defaultGroupState('head_curator')).toBe('all');
    expect(defaultGroupState(' Admin ')).toBe('all');
  });

  it('an unknown or missing role gets the narrow default', () => {
    expect(defaultGroupState(undefined)).toBe('running');
    expect(defaultGroupState(null)).toBe('running');
    expect(defaultGroupState('student')).toBe('running');
  });
});

describe('groupOptionLabel', () => {
  it('names the teacher when there is one', () => {
    expect(groupOptionLabel({ name: 'SAT - Daniil', teacher_name: 'Daniil K.' }, 'finished')).toBe('SAT - Daniil — Daniil K.');
  });

  it('marks a finished group', () => {
    expect(groupOptionLabel({ name: 'SAT - Daniil', teacher_name: null, is_finished: true }, 'finished')).toBe('SAT - Daniil · finished');
    expect(groupOptionLabel({ name: 'SAT', teacher_name: 'T', is_finished: true }, 'завершена')).toBe('SAT — T · завершена');
  });

  it('leaves a running group unmarked', () => {
    expect(groupOptionLabel({ name: 'SAT', teacher_name: null, is_finished: false }, 'finished')).toBe('SAT');
  });
});
