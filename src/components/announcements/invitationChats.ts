import type { InvitationChat, InvitationGroupRow, InvitationGroupStatus, InvitationLinks } from '../../services/api/announcements';

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

export const GROUP_STATUS_LABEL: Record<Exclude<InvitationGroupStatus, 'running'>, string> = {
  not_started: 'Not started',
  stopped: 'Stopped',
  finished: 'Finished',
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
export function groupOptionsFor(groups: InvitationGroupRow[]) {
  return [...groups]
    .sort((a, b) => (STATUS_ORDER[a.status ?? 'running'] - STATUS_ORDER[b.status ?? 'running'])
      || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    .map((g) => {
      const state = g.status && g.status !== 'running' ? GROUP_STATUS_LABEL[g.status].toLowerCase() : null;
      const now = g.link ? `now: ${g.link.chat_title ?? `chat ${g.link.chat_id}`}` : null;
      return { value: String(g.id), label: g.name, hint: [state, now].filter(Boolean).join(' · ') || undefined };
    });
}
