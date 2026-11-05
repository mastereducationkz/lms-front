import { afterEach, describe, expect, it } from 'vitest';
import { joinLogLine } from './meetJoinLog';
import { setActiveLocale } from './i18n';
import type { MeetPerson, MeetRecord } from '../services/api/meetAttendance';
import type { StudentRegister } from '../services/api/meetRegister';

// Lesson 19:00–19:45 Almaty = 14:00–14:45 UTC; the viewer's own zone must not matter.
const clockInfo = { start: '2026-09-10T14:00:00Z', end: '2026-09-10T14:45:00Z', count_until: '2026-09-10T14:45:00Z',
  held_minutes: 45, required_minutes: 34, follows_teacher: true };
const record = (extra: Partial<MeetRecord> = {}): MeetRecord => ({
  event_id: 1, title: 'x', start: clockInfo.start, end: clockInfo.end, state: 'ready', clock: clockInfo, unknown: [], ...extra,
});
const reg = (extra: Partial<StudentRegister>): StudentRegister => ({
  state: 'written', mode: 'live', status: 'present', skip_reason: null, verdict: 'present', minutes: 41, required: 34,
  late_minutes: 0, override: null, ...extra,
});
const student = (extra: Partial<MeetPerson> = {}): MeetPerson => ({
  user_id: 7, name: 'Aya', role: 'student', mark: 'present', accounts: [], flags: [], joins: 2,
  sessions: [
    { joined_at: '2026-09-10T14:04:00Z', left_at: '2026-09-10T14:12:00Z' },
    { joined_at: '2026-09-10T14:15:00Z', left_at: '2026-09-10T14:45:00Z' },
  ],
  first_join: '2026-09-10T14:04:00Z', last_leave: '2026-09-10T14:45:00Z', minutes_in_lesson: 38,
  verdict: { verdict: 'present', held_back: false, provisional: 'present', attended: true, minutes: 41, required: 34, late_minutes: 4 },
  register: reg({}), ...extra,
});

afterEach(() => setActiveLocale('en'));

describe('joinLogLine', () => {
  it('says when they came, left and came back, in Almaty time, with the minutes needed', () => {
    setActiveLocale('en');
    expect(joinLogLine(student(), record())).toBe(
      'Joined 19:04, left 19:12, rejoined 19:15, left 19:45 — 41 of 45 min, needs 34. The mark (Present) is Meet’s, set from this record.');
  });

  it('says so in Russian for a curator', () => {
    setActiveLocale('ru');
    expect(joinLogLine(student(), record())).toContain('Вход 19:04, выход 19:12, снова вход 19:15, выход 19:45 — 41 из 45 мин, нужно 34.');
  });

  it('says a stretch still open is still in the room', () => {
    setActiveLocale('en');
    const open = student({ sessions: [{ joined_at: '2026-09-10T14:04:00Z', left_at: null }] });
    expect(joinLogLine(open, record())).toContain('Joined 19:04, still in the room');
  });

  it('says a student who never came did not join, and who the mark belongs to', () => {
    setActiveLocale('en');
    const absent = student({ sessions: [], mark: 'absent', register: null,
      verdict: { verdict: 'absent', held_back: false, provisional: 'absent', attended: false, minutes: 0, required: 34, late_minutes: 0 } });
    expect(joinLogLine(absent, record())).toBe('Did not join the room — 0 of 45 min, needs 34. The mark is the teacher’s.');
  });

  it('names the unconfirmed guest that holds the verdict back', () => {
    setActiveLocale('en');
    const held = student({ sessions: [], mark: null, register: reg({ state: 'held', skip_reason: 'held_back' }),
      verdict: { verdict: null, held_back: true, provisional: 'absent', attended: null, minutes: 0, required: 34, late_minutes: 0 } });
    const line = joinLogLine(held, record({ held_back: true, unknown: [{ participant_id: 3, kind: 'guest', display_name: 'Zere' } as never] }));
    expect(line).toContain('No confirmed account of theirs joined');
    expect(line).toContain('an unconfirmed guest was in the room and may be this student');
    expect(joinLogLine(held, record({ held_back: true, unknown: [{ participant_id: 3, kind: 'signed_in', display_name: 'Z' } as never] })))
      .toContain('an unconfirmed account was in the room');
  });

  it('tells a teacher’s mark Meet agreed with, a change after Meet, and a mark nobody set yet', () => {
    setActiveLocale('en');
    expect(joinLogLine(student({ register: reg({ state: 'kept' }) }), record())).toContain('The mark is the teacher’s, and Meet’s count agrees');
    const changed = student({ mark: 'absent', register: reg({ state: 'override', override: {
      status: 'absent', reason_code: 'excused_early', reason_label: 'Left early with permission', text: null, by: 'Gulzada', at: null, via: 'lms' } }) });
    expect(joinLogLine(changed, record())).toContain('Meet decided, then Gulzada changed the mark to Absent: Left early with permission.');
    expect(joinLogLine(student({ mark: null, register: null }), record())).toContain('Not marked yet. By Meet’s count: Present.');
  });
});
