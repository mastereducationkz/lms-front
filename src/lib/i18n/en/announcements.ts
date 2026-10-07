import type { MessageTable } from '../types';

/** Telegram announcements: the page chrome (the messages themselves are written by staff). */
export const announcements = {
  'announcements.invitations.intro': 'Five minutes before each lesson held in an LMS Meet room, the bot posts the invitation to the group\'s Telegram chat — the same text the lesson card\'s "Copy invitation" button copies. Link each group to its chat; matches are suggested by name for you to confirm.',
  'announcements.converter.placeholder': '📢 **SAT 2026**\n\nYour text here...',
} as const satisfies MessageTable;
