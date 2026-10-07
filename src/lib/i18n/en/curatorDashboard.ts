import type { MessageTable } from '../types';

/** The curator and head-curator dashboard (pages/HeadCuratorDashboard). */
export const curatorDashboard = {
  'curatorDashboard.greeting': 'Good to see you, {name}',
  'curatorDashboard.subtitle.headCurator': 'Curator performance and student activity at a glance',
  'curatorDashboard.subtitle.curator': 'Your groups’ progress and student activity at a glance',
  'curatorDashboard.updating': 'Updating…',
  'curatorDashboard.filter.allGroups': 'All groups',
  'curatorDashboard.period.pick': 'Pick a period',
  'curatorDashboard.period.presets': 'Periods',
  'curatorDashboard.period.allTime': 'All time',

  'curatorDashboard.attendance.missing': 'Attendance not marked ({count})',
  'curatorDashboard.attendance.open': 'Go to attendance',
  'curatorDashboard.attendance.fill': 'Fill in',

  'curatorDashboard.kpi.totalCurators': 'Total curators',
  'curatorDashboard.kpi.totalGroups': 'Total groups',
  'curatorDashboard.kpi.activeOnPlatform': 'Active on the platform',
  'curatorDashboard.kpi.assignedToYou': 'Assigned to you',
  'curatorDashboard.kpi.totalStudents': 'Total students',
  'curatorDashboard.kpi.active7d': { one: '{count} active in the last 7 days', other: '{count} active in the last 7 days' },
  'curatorDashboard.kpi.overdueHomework': 'Overdue homework',
  'curatorDashboard.kpi.needsAttention': 'Needs attention',
  'curatorDashboard.kpi.inactive': 'Inactive',
  'curatorDashboard.kpi.inactiveFor7d': 'No activity for 7 days',

  'curatorDashboard.chart.activity': 'Student activity (%)',
  'curatorDashboard.chart.activityTooltip': 'Activity',
  'curatorDashboard.chart.curatorPerformance': 'Curator performance (%)',
  'curatorDashboard.chart.groupProgress': 'Progress by group (%)',
  'curatorDashboard.chart.curatorPerformanceHint': 'Based on students’ average progress, how little is overdue and how quickly work gets graded.',
  'curatorDashboard.chart.groupProgressHint': 'Students’ average course progress in each group.',
  'curatorDashboard.chart.avgProgress': 'Avg. progress (%)',

  'curatorDashboard.table.byCurator': 'Summary by curator',
  'curatorDashboard.table.byGroup': 'Summary by group',
  'curatorDashboard.table.curator': 'Curator',
  'curatorDashboard.table.group': 'Group',
  'curatorDashboard.table.groups': 'Groups',
  'curatorDashboard.table.students': 'Students',
  'curatorDashboard.table.avgProgress': 'Avg. progress',
  'curatorDashboard.table.overdue': 'Overdue',
  'curatorDashboard.table.pendingGrading': 'To grade',
  'curatorDashboard.table.actions': 'Actions',
  'curatorDashboard.table.ofTotal': 'of {total} ({percent}%)',
  'curatorDashboard.table.view': 'View',

  'curatorDashboard.atRisk.title': 'Groups with overdue work',
  'curatorDashboard.atRisk.description': 'Groups with students who missed a deadline or handed work in late.',
  'curatorDashboard.atRisk.empty': 'No groups with overdue work. Everything is on track.',
} as const satisfies MessageTable;
