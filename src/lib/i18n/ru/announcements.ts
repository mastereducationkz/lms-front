import type { announcements as en } from '../en/announcements';
import type { RuTable } from '../types';

export const announcements: RuTable<typeof en> = {
  'announcements.invitations.intro': 'За пять минут до каждого урока в Meet-комнате LMS бот публикует приглашение в Telegram-чат группы — тот же текст, что копирует кнопка «Скопировать приглашение» в карточке урока. Привяжите каждую группу к её чату; совпадения по названию предлагаются вам на подтверждение.',
  'announcements.converter.placeholder': '📢 **SAT 2026**\n\nВаш текст здесь...',
};
