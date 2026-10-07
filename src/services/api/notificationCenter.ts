import { api } from './client';

/**
 * The caller's own notification settings and personal Telegram link (lms-backend
 * src/notifications/routes.py, mounted at /me). These answer whether or not the notification
 * center is switched on (NOTIFICATION_CENTER_ENABLED), so people can set things up first.
 * Never cached: every answer reflects a switch the person just flipped.
 */
export type ChannelKey = 'in_app' | 'email' | 'telegram' | 'push' | 'web_push';

export interface EventChannelState {
  enabled: boolean;
  default: boolean;
  switchable: boolean;
}

export interface NotificationEvent {
  key: string;
  /** Already in the reader's language (the server's catalogue). */
  label: string;
  description: string;
  channels: Partial<Record<ChannelKey, EventChannelState>>;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // "22:00"
  end: string; // "08:00"
  timezone: string;
}

export interface NotificationSettings {
  language: 'en' | 'ru';
  /** Whether each channel can reach this person now (Telegram linked, a browser subscribed…). */
  channels: Partial<Record<ChannelKey, { available: boolean }>>;
  events: NotificationEvent[];
  quiet_hours: QuietHours;
}

export interface NotificationSettingsUpdate {
  /** Only the switches being changed: { event key: { channel: on/off } }. */
  events?: Record<string, Partial<Record<ChannelKey, boolean>>>;
  quiet_hours?: QuietHours;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await api.get('/me/notification-settings', { cache: false } as never);
  return response.data as NotificationSettings;
}

/** Answers with the whole document again, effective values included. */
export async function saveNotificationSettings(update: NotificationSettingsUpdate): Promise<NotificationSettings> {
  const response = await api.put('/me/notification-settings', update);
  return response.data as NotificationSettings;
}

export interface TelegramStatus {
  status: 'unlinked' | 'pending' | 'linked' | 'blocked';
  linked: boolean;
  blocked: boolean;
  /** The person muted the bot in Telegram. */
  muted: boolean;
  telegram_username: string | null;
  linked_at: string | null;
  /** Support couldn't be reached: this is the last known status. */
  stale: boolean;
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const response = await api.get('/me/telegram/status', { cache: false } as never);
  return response.data as TelegramStatus;
}

/** A t.me deep link that connects this account to the bot once the person taps Start. */
export async function createTelegramLink(): Promise<{ deep_link: string; expires_at?: string | null }> {
  const response = await api.post('/me/telegram/link');
  return response.data as { deep_link: string; expires_at?: string | null };
}

export async function unlinkTelegram(): Promise<TelegramStatus> {
  const response = await api.delete('/me/telegram/link');
  return response.data as TelegramStatus;
}

export interface RevokeOthersResult {
  access_token: string;
  refresh_token: string;
  revoked_sessions: number;
}

/**
 * «Sign out other devices» (lms-backend src/auth/routes/sessions.py): every other session ends
 * at once; this device keeps its chain and its live socket (named by `socket_id`) and gets new
 * tokens, which the caller must store in place of the old ones.
 */
export async function revokeOtherSessions(refreshToken: string | null, socketId: string | null): Promise<RevokeOthersResult> {
  const response = await api.post('/auth/sessions/revoke-others', {
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    ...(socketId ? { socket_id: socketId } : {}),
  });
  return response.data as RevokeOthersResult;
}
