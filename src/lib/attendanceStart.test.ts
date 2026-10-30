import { describe, expect, it } from 'vitest';
import {
  attendanceOpen, EXCUSE_BEFORE_START, isMarkWrite, msUntilOpen, notStartedHint, writeAllowed,
} from './attendanceStart';

// Lesson times come as naive UTC; Almaty is UTC+5. 14:00Z is 19:00 in Almaty.
const EVENING = '2026-10-30T14:00:00';

describe('attendanceOpen', () => {
  it('opens at the start minute itself, not a second before', () => {
    expect(attendanceOpen(EVENING, new Date('2026-10-30T13:59:59Z'))).toBe(false);
    expect(attendanceOpen(EVENING, new Date('2026-10-30T14:00:00Z'))).toBe(true);
    expect(attendanceOpen(EVENING, new Date('2026-10-30T14:00:30Z'))).toBe(true);
  });

  it('opens a start with seconds at its own minute', () => {
    expect(attendanceOpen('2026-10-30T14:00:45', new Date('2026-10-30T14:00:00Z'))).toBe(true);
    expect(attendanceOpen('2026-10-30T14:00:45', new Date('2026-10-30T13:59:59Z'))).toBe(false);
  });

  it('compares instants, whatever the start is spelled in', () => {
    expect(attendanceOpen('2026-10-30T19:00:00+05:00', new Date('2026-10-30T13:59:59Z'))).toBe(false);
    expect(attendanceOpen('2026-10-30T14:00:00Z', new Date('2026-10-30T14:00:00Z'))).toBe(true);
  });

  it('closes a lesson later today, not only one on a later day', () => {
    // 10:00 Almaty, the lesson is at 19:00 the same day.
    expect(attendanceOpen(EVENING, new Date('2026-10-30T05:00:00Z'))).toBe(false);
    expect(attendanceOpen('2026-10-31T14:00:00', new Date('2026-10-30T05:00:00Z'))).toBe(false);
  });

  it('leaves a lesson without a readable start to the server', () => {
    expect(attendanceOpen(null)).toBe(true);
    expect(attendanceOpen(undefined)).toBe(true);
    expect(attendanceOpen('not a date')).toBe(true);
  });
});

describe('msUntilOpen', () => {
  it('counts down to the start, then is null', () => {
    expect(msUntilOpen(EVENING, new Date('2026-10-30T13:59:00Z'))).toBe(60_000);
    expect(msUntilOpen(EVENING, new Date('2026-10-30T13:59:59Z'))).toBe(1_000);
    expect(msUntilOpen(EVENING, new Date('2026-10-30T14:00:00Z'))).toBeNull();
  });
});

describe('notStartedHint', () => {
  it('names the start in Almaty time, the server’s words', () => {
    expect(notStartedHint(EVENING, new Date('2026-10-30T05:00:00Z'), 'ru'))
      .toBe('Урок ещё не начался — отметить посещаемость можно с 19:00');
  });

  it('adds the date when the start is on another Almaty day', () => {
    expect(notStartedHint('2026-10-31T14:00:00', new Date('2026-10-30T05:00:00Z'), 'ru'))
      .toBe('Урок ещё не начался — отметить посещаемость можно с 19:00 31.10.2026');
  });

  it('reads a 00:30 Almaty lesson as 00:30 of the next Almaty day', () => {
    // 19:30Z on the 30th is 00:30 on the 31st in Almaty.
    const lateNight = '2026-10-30T19:30:00';
    expect(notStartedHint(lateNight, new Date('2026-10-30T14:00:00Z'), 'ru'))
      .toBe('Урок ещё не начался — отметить посещаемость можно с 00:30 31.10.2026');
    // Just after Almaty midnight it is the same day, so no date.
    expect(notStartedHint(lateNight, new Date('2026-10-30T19:05:00Z'), 'ru'))
      .toBe('Урок ещё не начался — отметить посещаемость можно с 00:30');
    expect(notStartedHint(lateNight, new Date('2026-10-30T19:30:00Z'), 'ru')).toBeNull();
  });

  it('is null at the boundary minute and after', () => {
    expect(notStartedHint(EVENING, new Date('2026-10-30T13:59:59Z'), 'ru')).not.toBeNull();
    expect(notStartedHint(EVENING, new Date('2026-10-30T14:00:00Z'), 'ru')).toBeNull();
  });
});

describe('isMarkWrite / writeAllowed', () => {
  const before = new Date('2026-10-30T13:00:00Z');
  const after = new Date('2026-10-30T14:00:00Z');

  it('refuses Был / Опоздал / Н/Б before the start and allows them from it', () => {
    for (const status of ['attended', 'late', 'missed', 'absent']) {
      expect(writeAllowed(EVENING, status, false, before)).toBe(false);
      expect(writeAllowed(EVENING, status, false, after)).toBe(true);
    }
  });

  it('never counts registered, removed, cancelled or unknown statuses as marks', () => {
    for (const status of ['registered', 'removed', 'cancelled', 'whatever', '']) {
      expect(isMarkWrite(status)).toBe(false);
      expect(writeAllowed(EVENING, status, false, before)).toBe(true);
    }
  });

  it('lets an excused absence through in advance while the switch is on', () => {
    expect(EXCUSE_BEFORE_START).toBe(true);
    expect(writeAllowed(EVENING, 'missed', true, before)).toBe(true);
    expect(writeAllowed(EVENING, 'absent', true, before)).toBe(true);
    // An «excuse» riding on a presence is still a presence.
    expect(writeAllowed(EVENING, 'attended', true, before)).toBe(false);
  });
});
