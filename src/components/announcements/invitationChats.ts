import type { InvitationChat, InvitationGroupRow, InvitationGroupStatus, InvitationLinks } from '../../services/api/announcements';
import { activeLocale, t, type Locale, type MessageKey } from '../../lib/i18n';
import '@/lib/i18n/catalogs/announcements';

export interface ChatRow {
  chat: InvitationChat;
  groups: InvitationGroupRow[];
}

/** Every approved chat with the LMS group(s) it serves: the group list, read from Telegram's side. */
export function chatRows(data: InvitationLinks): ChatRow[] {
  return data.chats
    .map((chat) => ({ chat, groups: data.groups.filter((g) => g.link?.chat_id === chat.id) }))
    .sort((a, b) => a.chat.title.localeCompare(b.chat.title, undefined, { numeric: true, sensitivity: 'base' }));
}

const STATUS_ORDER: Record<InvitationGroupStatus, number> = { running: 0, not_started: 1, stopped: 2, finished: 3 };

/** Message keys: show with t(GROUP_STATUS_LABEL[status]). */
export const GROUP_STATUS_LABEL: Record<Exclude<InvitationGroupStatus, 'running'>, MessageKey> = {
  not_started: 'announcements.groupState.notStarted',
  stopped: 'announcements.groupState.stopped',
  finished: 'announcements.groupState.finished',
};

/** Hidden from the groups table unless asked for: nothing left to invite them to. */
export function isInactive(group: Pick<InvitationGroupRow, 'status'>): boolean {
  return group.status === 'stopped' || group.status === 'finished';
}

/**
 * Every LMS group as a "Link to a group" option: running ones first, then groups not started
 * yet (a new group's chat can be linked before its first student), then stopped and finished.
 * The hint says which, and which chat a group already has — picking it moves that link.
 */
export function groupOptionsFor(groups: InvitationGroupRow[], locale: Locale = activeLocale()) {
  return [...groups]
    .sort((a, b) => (STATUS_ORDER[a.status ?? 'running'] - STATUS_ORDER[b.status ?? 'running'])
      || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    .map((g) => {
      const state = g.status && g.status !== 'running' ? t(GROUP_STATUS_LABEL[g.status], undefined, locale).toLowerCase() : null;
      const chat = g.link ? g.link.chat_title ?? t('announcements.chats.hintChat', { id: g.link.chat_id }, locale) : null;
      const now = chat !== null ? t('announcements.chats.hintNow', { chat }, locale) : null;
      return { value: String(g.id), label: g.name, hint: [state, now].filter(Boolean).join(' · ') || undefined };
    });
}
