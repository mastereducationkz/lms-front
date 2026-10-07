import type { MessageTable } from '../types';

/** The curator's homework overview (/curator/homeworks) and the curator-homeworks components. */
export const curatorHomeworks = {
  'curatorHomeworks.title': 'Homework',
  'curatorHomeworks.loadError': 'Couldn’t load homework',
  'curatorHomeworks.teacherFallback': 'Teacher #{id}',
  'curatorHomeworks.allGroups': 'All groups',

  // Overview rollup: a number followed by its label
  'curatorHomeworks.stats.groups': { one: 'group', other: 'groups' },
  'curatorHomeworks.stats.assignments': { one: 'assignment', other: 'assignments' },
  'curatorHomeworks.stats.submitted': 'submitted',
  'curatorHomeworks.stats.notSubmitted': 'not submitted',
  'curatorHomeworks.stats.overdue': 'overdue',

  // Per-group and per-assignment counters
  'curatorHomeworks.count.overdue': '{count} overdue',
  'curatorHomeworks.count.notSubmitted': '{count} not submitted',
  'curatorHomeworks.count.allSubmitted': 'all submitted',
  'curatorHomeworks.count.submittedOf': '{submitted}/{expected} submitted',
  'curatorHomeworks.count.inReview': '{count} in review',
  'curatorHomeworks.count.graded': '{graded}/{submitted} graded',

  // Groups
  'curatorHomeworks.group.finished': 'Finished',
  'curatorHomeworks.group.assignments': { one: '{count} assignment', other: '{count} assignments' },
  'curatorHomeworks.group.students': { one: '{count} student', other: '{count} students' },
  'curatorHomeworks.group.noAssignments': 'This group has no assignments',
  'curatorHomeworks.group.empty': 'No assignments',

  // A group's assignments table
  'curatorHomeworks.table.assignment': 'Assignment',
  'curatorHomeworks.table.due': 'Due',
  'curatorHomeworks.table.sortByDue': 'Sort by due date',
  'curatorHomeworks.table.submitted': 'Submitted',
  'curatorHomeworks.assignment.due': 'Due: {date}',

  // Empty overview
  'curatorHomeworks.empty.title': 'No homework yet',
  'curatorHomeworks.empty.hint': 'Your groups’ assignments will appear here',

  // Filters
  'curatorHomeworks.filter.searchGroups': 'Search groups…',
  'curatorHomeworks.filter.teacher': 'Teacher',
  'curatorHomeworks.filter.allTeachers': 'All teachers',
  'curatorHomeworks.filter.needsAttention': 'Needs attention only',
  'curatorHomeworks.filter.showFinished': 'Show finished groups',
  'curatorHomeworks.filter.allOnTrack': 'All groups are on track',
  'curatorHomeworks.filter.nothingFound': 'Nothing found',
  'curatorHomeworks.filter.searchStudents': 'Search by student name…',
  'curatorHomeworks.filter.status': 'Status',
  'curatorHomeworks.filter.graded': 'Graded',

  // Students of one assignment
  'curatorHomeworks.students.noneInAssignment': 'No students in this assignment',
  'curatorHomeworks.students.noneMatch': 'No students match the filters',
  'curatorHomeworks.students.student': 'Student',
  'curatorHomeworks.students.submittedAt': 'Submitted',
  'curatorHomeworks.students.status': 'Status',
  'curatorHomeworks.students.actions': 'Actions',
  'curatorHomeworks.students.view': 'View',
} as const satisfies MessageTable;
