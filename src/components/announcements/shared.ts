import type {
  Announcement,
  AnnouncementStatus,
  GroupStatus,
} from '../../services/api/announcements';
import { formatDateTime as formatAppDateTime, type MessageKey } from '../../lib/i18n';
import '@/lib/i18n/catalogs/announcements';

/** The message to show for a failed call, preferring the backend's own reason. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return formatAppDateTime(value, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STATUS_STYLES: Record<AnnouncementStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  sending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  partially_failed: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  canceled: 'bg-muted text-muted-foreground',
  recalled: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
};

/** Message keys: show with t(STATUS_LABELS[status]). */
export const STATUS_LABELS: Record<AnnouncementStatus, MessageKey> = {
  draft: 'announcements.status.draft',
  scheduled: 'announcements.status.scheduled',
  sending: 'announcements.status.sending',
  sent: 'announcements.status.sent',
  partially_failed: 'announcements.status.partiallyFailed',
  canceled: 'announcements.status.canceled',
  recalled: 'announcements.status.recalled',
};

/** A group's approval state, as a message key. */
export const GROUP_STATUS_LABELS: Record<GroupStatus, MessageKey> = {
  pending: 'announcements.groupStatus.pending',
  approved: 'announcements.groupStatus.approved',
  rejected: 'announcements.groupStatus.rejected',
};

/** One delivery's state (a recipient of an announcement, or a lesson invitation), as a message key. */
export const DELIVERY_STATUS_LABELS: Record<string, MessageKey> = {
  pending: 'announcements.delivery.pending',
  sent: 'announcements.delivery.sent',
  failed: 'announcements.delivery.failed',
  skipped: 'announcements.delivery.skipped',
};

/** A group's approval state, in the same palette as announcement states. */
export const GROUP_STATUS_STYLES: Record<GroupStatus, string> = {
  approved: STATUS_STYLES.sent,
  pending: STATUS_STYLES.scheduled,
  rejected: STATUS_STYLES.recalled,
};

/**
 * Telegram lets a bot delete its own messages for about 48 hours. Past that a
 * recall still runs but every chat refuses it, so the button is hidden rather
 * than offering something that cannot work.
 */
const RECALL_WINDOW_MS = 48 * 60 * 60 * 1000;

const RECALLABLE: AnnouncementStatus[] = ['sent', 'partially_failed', 'sending'];

/**
 * Whether Recall is still worth offering.
 *
 * The 48 hours run from when the messages were SENT, not from when the
 * announcement was written. Measuring from creation hid the button on anything
 * scheduled more than two days ahead the moment it went out. The latest
 * delivery time is used so a long broadcast stays recallable for as long as any
 * of its messages still can be — a partial recall reports the stragglers.
 */
export function canRecall(row: Announcement, now: number = Date.now()): boolean {
  if (!RECALLABLE.includes(row.status)) return false;
  const deliveredAt = row.finished_at ?? row.started_at ?? row.created_at;
  return now - new Date(deliveredAt).getTime() < RECALL_WINDOW_MS;
}
