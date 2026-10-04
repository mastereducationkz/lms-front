import { LIBRARY_NOTIFICATION_TYPES } from '../../lib/library';
import { api } from './client';

/**
 * The generic notifications system (`src/messages/routes/notifications.py`), narrowed to the
 * types a caller cares about via an optional `types` query param (Task 8). Never cached — see
 * `cache.ts`'s TTL rule for `/notifications`.
 */
export interface AppNotification {
  id: number;
  title: string;
  content: string;
  notification_type: string;
  related_id: number | null;
  is_read: boolean;
  created_at: string;
}

/** The types the bell (Task 15) cares about — new lesson materials, and one removed by a moderator. */
export const CLASS_MATERIAL_NOTIFICATION_TYPES = ['class_materials', 'class_material_removed'];

/** A student unlocked an achievement (Kasatik Achievements, 2026-10-04); related_id = the unlock's id. */
export const ACHIEVEMENT_NOTIFICATION_TYPES = ['achievement_unlocked'];

/** Everything the bell shows: lesson materials, the library's (new items, an item removed by a moderator), achievements. */
export const BELL_NOTIFICATION_TYPES = [
  ...CLASS_MATERIAL_NOTIFICATION_TYPES,
  ...LIBRARY_NOTIFICATION_TYPES,
  ...ACHIEVEMENT_NOTIFICATION_TYPES,
];

function typesParams(types: string[]): Record<string, string> {
  return types.length ? { types: types.join(',') } : {};
}

export async function getNotifications(types: string[]): Promise<AppNotification[]> {
  const response = await api.get('/notifications', { params: typesParams(types), cache: false } as never);
  // Anything but a list (an empty body after a dropped request, an error envelope, a proxy's
  // HTML page) is "no notifications", never a value that crashes `.some`/`.map` in the bell
  // and takes the page down with it (LMS-FRONT-5).
  return Array.isArray(response?.data) ? (response.data as AppNotification[]) : [];
}

export async function getUnreadNotificationCount(types: string[]): Promise<number> {
  const response = await api.get('/notifications/unread-count', {
    params: typesParams(types),
    cache: false,
  } as never);
  const count = response?.data?.count;
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 0;
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(types: string[]): Promise<void> {
  await api.put('/notifications/read-all', null, { params: typesParams(types) } as never);
}
