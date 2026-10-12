import { describe, expect, it } from 'vitest';
import type { Announcement } from '../../services/api/announcements';
import { STATUS_LABELS, STATUS_STYLES, canRecall, chatsNotCleared, isInFlight } from './shared';

const row = (status: Announcement['status']): Announcement =>
  ({ id: 1, status, created_at: '2026-10-12T08:00:00Z', started_at: '2026-10-12T08:00:00Z', finished_at: new Date().toISOString() }) as Announcement;

describe('a recall under way', () => {
  it('has its own label and style', () => {
    expect(STATUS_LABELS.recalling).toBe('announcements.status.recalling');
    expect(STATUS_STYLES.recalling).toBeTruthy();
  });

  it('keeps the screen polling, like a broadcast that is still going out', () => {
    expect(isInFlight('recalling')).toBe(true);
    expect(isInFlight('sending')).toBe(true);
    expect(isInFlight('scheduled')).toBe(true);
    expect(['draft', 'sent', 'partially_failed', 'canceled', 'recalled'].some((s) => isInFlight(s as Announcement['status']))).toBe(false);
  });

  it('cannot be asked for again while it runs', () => {
    expect(canRecall(row('sent'))).toBe(true);
    expect(canRecall(row('recalling'))).toBe(false);
    expect(canRecall(row('recalled'))).toBe(false);
  });
});

describe('chatsNotCleared', () => {
  it('counts the chats Telegram would not clear (a message older than ~48 hours)', () => {
    const targets = [{ error: null }, { error: 'recall: message can\'t be deleted for everyone' }, { error: 'recall: x' }, { error: 'other' }, {}];
    expect(chatsNotCleared({ targets })).toBe(2);
  });

  it('is zero when everything was deleted', () => {
    expect(chatsNotCleared({ targets: [{ error: null }, {}] })).toBe(0);
  });
});
