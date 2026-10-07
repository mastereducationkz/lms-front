import type { MessageTable } from '../types';

/** The student header's stars dropdown (GET /gamification/breakdown): the streak bonus panel. */
export const stars = {
  'stars.streak.title': 'Streak bonus',
  'stars.streak.titleWith': 'Streak bonus ×{multiplier}',
  'stars.streak.moreDays': { one: '{count} more day', other: '{count} more days' },
  'stars.streak.notStarted': {
    one: 'Learn {count} day in a row and every star you earn gets ×{next}.',
    other: 'Learn {count} days in a row and every star you earn gets ×{next}.',
  },
  'stars.streak.building': "You're on a {days}-day streak. Keep it going {more} and every star you earn gets ×{next}.",
  'stars.streak.active': 'Your {days}-day streak multiplies every star you earn by {multiplier}. Keep it going {more} to reach ×{next}.',
  'stars.streak.atMax': 'Your {days}-day streak multiplies every star you earn by {multiplier}, the highest it goes.',
  'stars.streak.rule':
    '×{start} from a {startDays}-day streak, then +{step} for every {stepDays} more days, ×{max} max. ' +
    'It is added to each award as you earn it, except teacher bonuses.',
} as const satisfies MessageTable;
