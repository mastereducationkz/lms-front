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

function typesParams(types: string[]): Record<string, string> {
  return types.length ? { types: types.join(',') } : {};
}

export async function getNotifications(types: string[]): Promise<AppNotification[]> {
  const response = await api.get('/notifications', { params: typesParams(types), cache: false } as never);
  return response.data as AppNotification[];
}

export async function getUnreadNotificationCount(types: string[]): Promise<number> {
  const response = await api.get('/notifications/unread-count', {
    params: typesParams(types),
    cache: false,
  } as never);
  return (response.data?.count ?? 0) as number;
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(types: string[]): Promise<void> {
  await api.put('/notifications/read-all', null, { params: typesParams(types) } as never);
}
