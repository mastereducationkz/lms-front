/**
 * Files that may keep Russian text outside the ru catalog, each with its reason. Everything
 * else shows its copy through lib/i18n (t / useT) so a curator reads Russian and everyone else
 * English. Keep this list short: a new screen for any other role does NOT belong here.
 */
export const RUSSIAN_ALLOWED: Record<string, string> = {
  // Curator pages: built for curators in Russian, and kept that way (owner, 2026-10-07).
  // Head teachers and admins can open some of them; they read Russian there too.
  'src/pages/CuratorGroupsPage.tsx': 'curator page',
  'src/pages/CuratorHomeworksPage.tsx': 'curator page',
  'src/pages/CuratorParentReportsPage.tsx': 'curator page',
  'src/pages/CuratorTasksRedirect.tsx': 'curator page',
  'src/pages/HeadCuratorCuratorPage.tsx': 'curator page',
  'src/pages/HeadCuratorDashboard.tsx': 'curator dashboard',
  'src/pages/StudentReportPage.tsx': 'curator page (student report)',
  'src/pages/StudentProfilePage.tsx': 'curator page (student card)',
  'src/pages/StudentsJournalPage.tsx': 'curator page (students journal)',
  'src/components/parentReports/ParentReportCard.tsx': 'curator parent reports',
  'src/components/curator-homeworks/AssignmentCard.tsx': 'only CuratorHomeworksPage renders it',
  'src/components/curator-homeworks/GroupCard.tsx': 'only CuratorHomeworksPage renders it',
  'src/components/curator-homeworks/HomeworkFilters.tsx': 'only CuratorHomeworksPage renders it',
  'src/components/curator-homeworks/StudentsTable.tsx': 'only CuratorHomeworksPage renders it',
  // Tours and tips: every entry is written for one audience in that audience's language.
  'src/components/guide/tours.ts': 'the curator tour is Russian; each tour carries its own locale',
  'src/components/guide/tips.ts': 'curator tips are Russian; each tip carries its own locale',
  // Parsing and matching tables: words people type or that appear in titles, never shown.
  'src/lib/scheduleShorthand.ts': 'parses «пн пт 18:00» shorthand',
  'src/components/announcements/programs.ts': 'matches program names in Telegram chat titles',
  'src/components/announcements/curator.ts': 'matches «с куратором» in Telegram chat titles',
};
