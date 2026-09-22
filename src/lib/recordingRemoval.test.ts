import { describe, expect, it } from 'vitest';
import { canRemoveRecording, removalNotice } from './recordingRemoval';

describe('canRemoveRecording', () => {
  it('allows admins and head teachers', () => {
    expect(canRemoveRecording('admin')).toBe(true);
    expect(canRemoveRecording('head_teacher')).toBe(true);
  });

  it('refuses everyone else, including head curators who can watch everything', () => {
    // Mirrors recording_removal.REMOVAL_ROLES: watching every recording is not the same
    // permission as pulling one.
    for (const role of ['head_curator', 'teacher', 'curator', 'student', undefined]) {
      expect(canRemoveRecording(role)).toBe(false);
    }
  });
});

describe('removalNotice', () => {
  it('says nothing for a recording nobody removed', () => {
    expect(removalNotice({ status: 'ready' })).toBeNull();
  });

  it('explains a removed recording to staff, with the reason', () => {
    expect(removalNotice({ status: 'removed', hidden_reason: 'Личные данные' }))
      .toBe('Removed by staff — Личные данные');
  });

  it('still marks it removed when no reason came back', () => {
    // Retention purges produce `removed` with no reason; it must not read as a staff action.
    expect(removalNotice({ status: 'removed' })).toBe('No longer available');
  });
});
