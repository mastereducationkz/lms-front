/**
 * Files that may keep Russian text outside the ru catalog, each with its reason. Everything
 * else shows its copy through lib/i18n (t / useT), so every screen speaks the viewer's language,
 * whichever role they have. Only text that is never shown belongs here.
 */
export const RUSSIAN_ALLOWED: Record<string, string> = {
  // Parsing and matching tables: words people type or that appear in titles, never shown.
  'src/lib/scheduleShorthand.ts': 'parses «пн пт 18:00» shorthand',
  'src/components/announcements/programs.ts': 'matches program names in Telegram chat titles',
  'src/components/announcements/curator.ts': 'matches «с куратором» in Telegram chat titles',
};
