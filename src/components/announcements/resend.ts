import type { AnnouncementDetail, TelegramGroup } from '../../services/api/announcements';

export interface RecipientSelection {
  groupIds: Set<number>;
  allStudents: boolean;
}

/**
 * Convert an announcement's frozen delivery targets back into a fresh composer
 * selection. Only groups that are still approved and active can be selected;
 * the normal composer validation remains the final guard before sending.
 */
export function recipientSelectionFromAnnouncement(
  announcement: AnnouncementDetail,
  approvedGroups: TelegramGroup[],
): RecipientSelection {
  const selectedChatIds = new Set(
    announcement.targets
      .filter((target) => target.kind === 'group')
      .map((target) => target.telegram_chat_id),
  );

  return {
    groupIds: new Set(
      approvedGroups
        .filter((group) => selectedChatIds.has(group.telegram_chat_id))
        .map((group) => group.id),
    ),
    allStudents: announcement.targets.some((target) => target.kind === 'chat'),
  };
}
