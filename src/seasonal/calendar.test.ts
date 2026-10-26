import { describe, expect, it } from 'vitest';
import { nextChangeAt, seasonAt } from './calendar';

const at = (iso: string) => new Date(iso).getTime();

describe('seasonAt — Halloween 2026 in Almaty time (UTC+5)', () => {
  it('is Halloween during the week before 31 October', () => {
    expect(seasonAt(at('2026-10-27T09:00:00+05:00'))).toBe('halloween');
  });

  it('is still Halloween in the last minute of 31 October in Almaty', () => {
    expect(seasonAt(at('2026-10-31T23:59:59+05:00'))).toBe('halloween');
  });

  it('ends at midnight Almaty, even when the device clock reads another zone', () => {
    // 1 November 00:00 in Almaty is 31 October 19:00 UTC.
    expect(seasonAt(at('2026-10-31T19:00:00Z'))).toBeNull();
    expect(seasonAt(at('2026-10-31T18:59:59Z'))).toBe('halloween');
  });

  it('is nothing before the season or a year later', () => {
    expect(seasonAt(at('2026-10-25T23:59:59+05:00'))).toBeNull();
    expect(seasonAt(at('2027-10-28T12:00:00+05:00'))).toBeNull();
  });
});

describe('nextChangeAt', () => {
  it('during the season, is the moment it ends', () => {
    expect(nextChangeAt(at('2026-10-28T12:00:00+05:00'))).toBe(at('2026-11-01T00:00:00+05:00'));
  });

  it('before the season, is the moment it starts', () => {
    expect(nextChangeAt(at('2026-10-20T12:00:00+05:00'))).toBe(at('2026-10-26T00:00:00+05:00'));
  });

  it('after every season, is nothing', () => {
    expect(nextChangeAt(at('2026-11-02T00:00:00+05:00'))).toBeNull();
  });
});
