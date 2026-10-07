import type { MessageTable } from '../types';

/** Curator pages that admins and head teachers can open too: /curator/groups, parent reports, a curator's card, the CRM redirect. */
export const curatorPages = {
  // /curator/groups
  'curatorPages.groups.title': 'My groups',
  'curatorPages.groups.searchPlaceholder': 'Search groups…',
  'curatorPages.groups.loadFailed': 'Couldn’t load groups',
  'curatorPages.groups.empty': 'You don’t have any groups yet',
  'curatorPages.groups.nothingFound': 'Nothing found',
  'curatorPages.groups.finished': 'Finished',
  'curatorPages.groups.manageRoster': 'Manage students',

  // Roster dialog on /curator/groups
  'curatorPages.roster.loadFailed': 'Couldn’t load the group’s students',
  'curatorPages.roster.saved': 'Students updated: +{added} / −{removed}',
  'curatorPages.roster.saveFailed': 'Couldn’t save the changes to the group’s students',
  'curatorPages.roster.selected': { one: '{count} student selected', other: '{count} students selected' },
  'curatorPages.roster.pendingChanges': '{added} to add, {removed} to remove',
  'curatorPages.roster.searchPlaceholder': 'Search students by name or email…',
  'curatorPages.roster.hint': 'Tick a student to add them to the group; untick a current member to remove them.',
  'curatorPages.roster.searching': 'Searching…',
  'curatorPages.roster.empty': 'No students in this group yet. Find them with the search above.',
  'curatorPages.roster.member': 'In group',
  'curatorPages.roster.saving': 'Saving…',

  // /curator/parent-reports
  'curatorPages.parentReports.title': 'Parent reports',
  'curatorPages.parentReports.previousWeek': 'Previous week',
  'curatorPages.parentReports.nextWeek': 'Next week',
  'curatorPages.parentReports.noGroup': 'Open this page from a group card — it needs the parameter',
  'curatorPages.parentReports.loadFailed': 'Couldn’t load the group',
  'curatorPages.parentReports.bulkFailed': 'Bulk generation failed',
  'curatorPages.parentReports.loading': 'Loading…',
  'curatorPages.parentReports.generating': 'Generating…',
  'curatorPages.parentReports.generateMissing': 'Generate for everyone without a report ({count})',
  'curatorPages.parentReports.readyCount': '{done} of {total} ready',
  'curatorPages.parentReports.failedCount': 'Failed: {count} — open the card and try again',
  'curatorPages.parentReports.loadingRest': 'Loading the rest of the students’ data…',
  'curatorPages.parentReports.withTestSummary':
    'Tests this week: {withTest} of {loaded} — the rest will get reports without results, progress or a skills breakdown.',
  'curatorPages.parentReports.unknownTestSummary':
    'Unknown for {count}: the platform didn’t say whether there’s a test.',
  'curatorPages.parentReports.partlyMissingSummary':
    'A test in one course but not the other: {count} — their reports will ask the parent to follow up on the missing one.',
  'curatorPages.parentReports.loadingCard': 'Loading data…',
  'curatorPages.parentReports.bulkCardFailed': 'Couldn’t generate in the bulk run',
  'curatorPages.parentReports.noTest': 'No test this week — the report will have no results',
  'curatorPages.parentReports.testUnknown': 'The platform didn’t respond — unknown whether there’s a test',
  'curatorPages.parentReports.missingTests': 'No {courses} test — the report will ask the parent to follow up',
  'curatorPages.parentReports.and': 'and',

  // /head-curator/curator/:id
  'curatorPages.curatorDetail.loading': 'Loading curator data…',
  'curatorPages.curatorDetail.notFound': 'Curator not found',
  'curatorPages.curatorDetail.backToDashboard': 'Back to dashboard',
  'curatorPages.curatorDetail.students': 'Students',
  'curatorPages.curatorDetail.inGroups': { one: 'In {count} group', other: 'In {count} groups' },
  'curatorPages.curatorDetail.overdue': 'Overdue',
  'curatorPages.curatorDetail.overdueHomework': 'Overdue homework',
  'curatorPages.curatorDetail.avgProgressShort': 'Avg. progress',
  'curatorPages.curatorDetail.avgProgress': 'Average progress',
  'curatorPages.curatorDetail.overdueTrend': 'Overdue trend',
  'curatorPages.curatorDetail.overdueTrendHint': 'New overdue homework over the last 30 days',
  'curatorPages.curatorDetail.groupsAndStudents': 'Groups and students',
  'curatorPages.curatorDetail.groupsAndStudentsHint': 'Student details for each group',
  'curatorPages.curatorDetail.noGroups': 'This curator has no groups.',
  'curatorPages.curatorDetail.studentCount': { one: '{count} student', other: '{count} students' },
  'curatorPages.curatorDetail.overdueCount': '{count} overdue',
  'curatorPages.curatorDetail.leaderboard': 'Leaderboard',
  'curatorPages.curatorDetail.noStudents': 'No students found.',
  'curatorPages.curatorDetail.student': 'Student',
  'curatorPages.curatorDetail.progress': 'Progress',

  // /curator/tasks and /curator/onboarding → CRM
  'curatorPages.crmRedirect.onboardingTitle': 'Student onboarding is in the CRM',
  'curatorPages.crmRedirect.tasksTitle': 'Curator tasks now live in the CRM',
  'curatorPages.crmRedirect.onboardingBody': 'The onboarding board opens in the CRM. Sign in with the same account.',
  'curatorPages.crmRedirect.tasksBody':
    'Freezes, feedback, first and last lessons, exam dates and results — one list in the CRM. Sign in with the same account.',
  'curatorPages.crmRedirect.openOnboarding': 'Open onboarding',
  'curatorPages.crmRedirect.openTasks': 'Go to tasks',
  'curatorPages.crmRedirect.fallback': 'If you weren’t redirected automatically, use the button above.',
} as const satisfies MessageTable;
