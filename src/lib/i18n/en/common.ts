import type { MessageTable } from '../types';

/** Words every screen needs. Area-specific copy lives in its own namespace. */
export const common = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.back': 'Back',
  'common.retry': 'Try again',
  'common.loading': 'Loading…',
  'common.search': 'Search',
  'common.all': 'All',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.error': 'Something went wrong',
  'common.lessons': { one: '{count} lesson', other: '{count} lessons' },
  'common.students': { one: '{count} student', other: '{count} students' },
  'common.groups': { one: '{count} group', other: '{count} groups' },
  'common.minutes': { one: '{count} min', other: '{count} min' },
  'common.days': { one: '{count} day', other: '{count} days' },
} as const satisfies MessageTable;
