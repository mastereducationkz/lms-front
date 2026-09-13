import { describe, expect, it } from 'vitest';
import { recipientSelectionFromAnnouncement } from './resend';
import type { AnnouncementDetail, TelegramGroup } from '../../services/api/announcements';

const approvedGroups: TelegramGroup[] = [
  {
    id: 11,
    telegram_chat_id: -10011,
    title: 'SAT A',
    chat_type: 'supergroup',
    status: 'approved',
    is_active: true,
    bot_is_admin: true,
    approved_by_email: 'admin@example.com',
    approved_at: '2026-09-01T10:00:00Z',
    discovered_at: '2026-09-01T09:00:00Z',
    last_seen_at: null,
  },
  {
    id: 12,
    telegram_chat_id: -10012,
    title: 'IELTS B',
    chat_type: 'supergroup',
    status: 'approved',
    is_active: true,
    bot_is_admin: true,
    approved_by_email: 'admin@example.com',
    approved_at: '2026-09-01T10:00:00Z',
    discovered_at: '2026-09-01T09:00:00Z',
    last_seen_at: null,
  },
];

const announcement = (targets: AnnouncementDetail['targets']): AnnouncementDetail => ({
  id: 1,
  body: 'Original message',
  status: 'sent',
  created_by_email: 'admin@example.com',
  created_by_name: 'Admin',
  pin: false,
  silent: false,
  target_all_students: false,
  scheduled_for: null,
  total_count: targets.length,
  sent_count: targets.length,
  failed_count: 0,
  started_at: null,
  finished_at: null,
  recalled_at: null,
  created_at: '2026-09-01T10:00:00Z',
  images: [],
  targets,
});

describe('recipientSelectionFromAnnouncement', () => {
  it('prefills current approved groups and the all-linked-students choice from frozen targets', () => {
    const selection = recipientSelectionFromAnnouncement(
      announcement([
        { id: 1, kind: 'group', telegram_chat_id: -10011, label: 'SAT A', status: 'sent', attempts: 1, error: null, pinned: false, sent_at: null },
        { id: 2, kind: 'chat', telegram_chat_id: 12345, label: 'Student', status: 'sent', attempts: 1, error: null, pinned: false, sent_at: null },
      ]),
      approvedGroups,
    );

    expect([...selection.groupIds]).toEqual([11]);
    expect(selection.allStudents).toBe(true);
  });

  it('does not select a group that is no longer approved and active', () => {
    const selection = recipientSelectionFromAnnouncement(
      announcement([
        { id: 1, kind: 'group', telegram_chat_id: -10099, label: 'Removed group', status: 'sent', attempts: 1, error: null, pinned: false, sent_at: null },
      ]),
      approvedGroups,
    );

    expect([...selection.groupIds]).toEqual([]);
    expect(selection.allStudents).toBe(false);
  });

  it('retains an explicitly selected student audience even when it had no targets', () => {
    const selection = recipientSelectionFromAnnouncement(
      { ...announcement([]), target_all_students: true },
      approvedGroups,
    );

    expect(selection.allStudents).toBe(true);
  });
});
