import { describe, expect, it } from 'vitest';
import { ML_PROGRESS_NOTIFICATION_TYPES, ML_RESULT_NOTIFICATION_TYPES, isMlProgressNotice } from './leagueNotifications';

describe('the Master League digest notices', () => {
  it('knows its two types and no others', () => {
    expect(ML_PROGRESS_NOTIFICATION_TYPES).toEqual(['ml_progress_score', 'ml_progress_weekly']);
    expect(isMlProgressNotice('ml_progress_weekly')).toBe(true);
    expect(isMlProgressNotice('ml_progress_score')).toBe(true);
    expect(isMlProgressNotice('achievement_unlocked')).toBe(false);
    expect(isMlProgressNotice('')).toBe(false);
  });
});

describe('the Master League result question in the bell', () => {
  it('is read in full like the digest, and is a bell type', () => {
    expect(ML_RESULT_NOTIFICATION_TYPES).toEqual(['ml_result_consent']);
    expect(isMlProgressNotice('ml_result_consent')).toBe(true);
  });
});
