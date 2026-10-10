import type { MessageKey } from './i18n';
import '@/lib/i18n/catalogs/announcements';

/** The kinds of automatic Telegram message the record can be filtered by (lms-backend `src/announcements/automatic.py`). */
export const AUTOMATIC_KINDS = [
  'weekly_test', 'digest', 'homework', 'lesson_invite', 'lesson_change', 'no_show',
  'class_materials', 'webinar', 'pinned_timetable', 'greeting', 'fines', 'other',
] as const;

export type AutomaticKind = (typeof AUTOMATIC_KINDS)[number];

export const KIND_LABELS: Record<AutomaticKind, MessageKey> = {
  weekly_test: 'announcements.automatic.kind.weekly_test',
  digest: 'announcements.automatic.kind.digest',
  homework: 'announcements.automatic.kind.homework',
  lesson_invite: 'announcements.automatic.kind.lesson_invite',
  lesson_change: 'announcements.automatic.kind.lesson_change',
  no_show: 'announcements.automatic.kind.no_show',
  class_materials: 'announcements.automatic.kind.class_materials',
  webinar: 'announcements.automatic.kind.webinar',
  pinned_timetable: 'announcements.automatic.kind.pinned_timetable',
  greeting: 'announcements.automatic.kind.greeting',
  fines: 'announcements.automatic.kind.fines',
  other: 'announcements.automatic.kind.other',
};

/** A text this long is clipped in the list and opens on a click. */
export const isLongText = (text: string): boolean => text.length > 400 || text.split('\n').length > 6;
