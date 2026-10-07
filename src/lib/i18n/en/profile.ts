import type { MessageTable } from '../types';

/** The profile page: who you are (settings — theme, password, notifications — live in Settings). */
export const profile = {
  'profile.title': 'Profile',
  'profile.editName': 'Edit name',
  'profile.nameLabel': 'Full name',
  'profile.namePlaceholder': 'Enter your full name',
  'profile.nameSaved': 'Name updated',
  'profile.nameFailed': 'Couldn’t update your name. Please try again.',
  'profile.unsavedTitle': 'Unsaved name change',
  'profile.unsavedBody': 'You changed your name but didn’t save it. Leave anyway? The change will be lost.',
  'profile.email': 'Email',
  'profile.role': 'Role',
  'profile.studentId': 'Student ID',
  'profile.memberSince': 'Member since {date}',
  'profile.customise': 'Customise your orca',
  'profile.customiseDone': 'Done',
  'profile.settingsHint': 'Theme, password and notifications are in Settings.',
  'profile.openSettings': 'Open Settings',

  'profile.groups.student': 'Your groups',
  'profile.groups.teacher': 'Groups you teach',
  'profile.groups.curator': 'Groups you curate',
  'profile.groups.empty': 'You’re not in a group yet.',
  'profile.groups.emptyStaff': 'No groups yet.',
  'profile.groups.loadFailed': 'Couldn’t load your groups.',
  'profile.groups.teacherLabel': 'Teacher',
  'profile.groups.curatorLabel': 'Curator',
  'profile.groups.notAssigned': 'Not assigned yet',
  'profile.groups.message': 'Message {name}',

  'profile.exam.title': 'Your exam',
  'profile.exam.notSet': 'No date yet',
  'profile.exam.in': { one: 'in {count} day', other: 'in {count} days' },
  'profile.exam.today': 'today',
  'profile.exam.passed': 'date passed',
  'profile.exam.nearestOfficial': 'The nearest official date — set yours so your curator knows.',
  'profile.exam.set': 'Set date',
  'profile.exam.change': 'Change date',

  'profile.substitutions.title': 'Hide from substitution requests',
  'profile.substitutions.body': 'When on, other teachers won’t see you as available for substitutions.',
} as const satisfies MessageTable;
