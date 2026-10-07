/**
 * Files that may keep Russian text outside the ru catalog, each with its reason. Everything
 * else shows its copy through lib/i18n (t / useT) so a curator reads Russian and everyone else
 * English. Keep this list short: a new screen for any other role does NOT belong here.
 */
export const RUSSIAN_ALLOWED: Record<string, string> = {
  // The curator dashboard: only curators and head curators ever see it (owner, 2026-10-07).
  'src/pages/HeadCuratorDashboard.tsx': 'curator dashboard',
  // Tours and tips: every entry is written for one audience in that audience's language.
  'src/components/guide/tours.ts': 'the curator tour is Russian; each tour carries its own locale',
  'src/components/guide/tips.ts': 'curator tips are Russian; each tip carries its own locale',
  // Parsing and matching tables: words people type or that appear in titles, never shown.
  'src/lib/scheduleShorthand.ts': 'parses «пн пт 18:00» shorthand',
  'src/components/announcements/programs.ts': 'matches program names in Telegram chat titles',
  'src/components/announcements/curator.ts': 'matches «с куратором» in Telegram chat titles',
};
