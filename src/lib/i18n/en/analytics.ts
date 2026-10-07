import type { MessageTable } from '../types';

/** Course analytics (/analytics) and one student's analytics page. */
export const analytics = {
  'analytics.title': 'Analytics',
  'analytics.subtitle': 'Monitor student progress and course performance',
  'analytics.selectCourse': 'Select course',
  'analytics.filterByGroup': 'Filter by group',
  'analytics.allGroups': 'All Groups',

  'analytics.stats.totalStudents': 'Total Students',
  'analytics.stats.avgProgress': 'Avg. Progress',
  'analytics.stats.avgScore': 'Avg. Score',
  'analytics.stats.completionRate': 'Completion Rate',

  'analytics.tabs.overview': 'Overview',
  'analytics.tabs.students': 'Students',
  'analytics.tabs.groups': 'Groups',
  'analytics.tabs.quizzes': 'Quizzes',
  'analytics.tabs.topics': 'Topics',
  'analytics.tabs.engagement': 'Engagement',

  'analytics.students.searchPlaceholder': 'Search name or email…',
  'analytics.students.includeDeactivated': 'Include deactivated',
  'analytics.students.deactivated': 'deactivated',
  'analytics.groups.searchPlaceholder': 'Search group…',
  'analytics.groups.showArchived': 'Show archived',
  'analytics.groups.archived': 'archived',

  'analytics.student.back': 'Back to Course Analytics',
  'analytics.student.details': 'Student Details',
  'analytics.student.progressReport': 'Progress report',
  'analytics.student.totalStudyTime': 'Total Study Time',
  'analytics.student.progress': 'Progress',
  'analytics.student.lastActivity': 'Last Activity',
  'analytics.student.enrollmentStatus': 'Enrollment Status',
  'analytics.student.tabs.performance': 'Performance',
  'analytics.student.tabs.curriculum': 'Curriculum',
  'analytics.student.tabs.homework': 'Homework',
  'analytics.student.tabs.history': 'History',
} as const satisfies MessageTable;
