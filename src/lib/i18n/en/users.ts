import type { MessageTable } from '../types';

/** User management: the users table, bulk actions, the user form and the staff student search. */
export const users = {
  'users.bulk.selected': 'selected',
  'users.bulk.clear': 'Clear selection',
  'users.bulk.addToGroup': 'Add to group',
  'users.bulk.activate': 'Activate',
  'users.bulk.deactivate': 'Deactivate',
  'users.bulk.activated': 'Activated: {count}',
  'users.bulk.deactivated': 'Deactivated: {count}',
  'users.bulk.partial': 'Done: {ok}, failed: {failed}',

  'users.addToGroup.done': { one: '{count} student added to “{group}”', other: '{count} students added to “{group}”' },
  'users.addToGroup.failed': 'Couldn’t add to the group',
  'users.addToGroup.selected': 'Students selected: {count}',
  'users.addToGroup.chooseGroup': 'Choose a group',
  'users.addToGroup.adding': 'Adding',
  'users.addToGroup.add': 'Add',

  'users.table.selectAll': 'Select all on this page',
  'users.table.selectOne': 'Select {name}',
  'users.table.user': 'User',
  'users.table.role': 'Role',
  'users.table.groups': 'Groups',
  'users.table.status': 'Status',
  'users.table.actions': 'Actions',
  'users.table.teacher': 'Teacher',
  'users.table.curator': 'Curator',
  'users.table.noGroup': 'No group',
  'users.table.trial': 'Trial',
  'users.table.active': 'Active',
  'users.table.inactive': 'Inactive',
  'users.table.hiddenFromAnalytics': 'Hidden from analytics',
  'users.table.createPlatformAccount': 'Create a platform account (SAT/IELTS)',
  'users.table.createAccount': 'Create account',
  'users.table.showInAnalytics': 'Show in analytics',
  'users.table.hideFromAnalytics': 'Hide from analytics',
  'users.table.editUser': 'Edit user',
  'users.table.deactivateUser': 'Deactivate user',

  'users.filter.label': 'Filters:',
  'users.filter.clearAll': 'Clear all',
  'users.filter.search': 'Search: “{query}”',
  'users.filter.role': 'Role: {role}',
  'users.filter.group': 'Group: {group}',
  'users.filter.statusActive': 'Status: active',
  'users.filter.statusInactive': 'Status: inactive',
  'users.filter.trialOnly': 'Trial only',

  'users.form.selectedCount': 'Selected: {count}',
  'users.form.remove': 'Remove {name}',
  'users.form.searchGroup': 'Search groups…',
  'users.form.searchStudent': 'Search students by name or email…',
  'users.form.nothingFound': 'Nothing found',
  'users.form.sendInvite': 'Email an invitation (login and password)',

  'users.analytics.hidden': '{name} is hidden from analytics and the dashboard',
  'users.analytics.shown': '{name} is visible in analytics and the dashboard again',

  'users.provision.created': '{platform}: account created — {name}',
  'users.provision.exists': '{platform}: account already exists — {name}',
  'users.provision.createdLinked': {
    one: '{platform}: account created, linked to {count} group — {name}',
    other: '{platform}: account created, linked to {count} groups — {name}',
  },
  'users.provision.existsLinked': {
    one: '{platform}: account already exists, linked to {count} group — {name}',
    other: '{platform}: account already exists, linked to {count} groups — {name}',
  },
  'users.provision.failed': 'Couldn’t create the {platform} account',

  'users.groups.programFilter': 'Program (database search)',
  'users.groups.allPrograms': 'All programs',
  'users.groups.program': 'Program',

  'users.bulkSchedule.placeholder': 'February 5 2026\tStudent Name\tTeacher Name\tSAT 4 months\t48\tmon wed fri 20 00',

  'users.bulkText.example': 'Aruzhan Sadykova\t87001234567\tNovember, December\tDecember 3 2025\taruzhan.sadykova@example.com\nDaniyar Akhmetov\t87007654321\tMarch\tDecember 3 2025\tdaniyar.akhmetov@example.com',
  'users.bulkText.sendInvites': 'Email invitations (login and password to each student)',
  'users.bulkText.copiedAll': 'Copied. Format: name, email, password (tab-separated)',
  'users.bulkText.copyAll': 'Copy all',
  'users.bulkText.clickToCopy': 'Click to copy',

  'users.search.placeholder': 'Find a student: name or email…',
  'users.search.searching': 'Searching…',
  'users.search.empty': 'No students found',
  'users.search.deactivated': 'deactivated',
} as const satisfies MessageTable;
