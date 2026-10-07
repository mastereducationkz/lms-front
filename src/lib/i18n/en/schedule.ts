import type { MessageTable } from '../types';

/** The group schedule generator, its «what will happen» preview and the quick-entry parser. */
export const schedule = {
  'schedule.length.minutes': '{minutes} min',
  'schedule.length.hours': '{hours} h',
  'schedule.length.hoursMinutes': '{hours} h {minutes} min',

  'schedule.generator.title': 'Generate class schedule',
  'schedule.generator.quickEntry': 'Quick entry (mon wed fri 19:00-20:30)',
  'schedule.generator.quickEntryPlaceholder': 'tue thu 20 00 sat 12 00',
  'schedule.generator.startDate': 'Start date',
  'schedule.generator.weekly': 'Weekly schedule',
  'schedule.generator.badTimes': 'Use HH:MM times (00:00–23:59): {days}',
  'schedule.generator.lessonsCount': 'Number of lessons',
  'schedule.generator.lessonsCountHint': 'For the whole course, including lessons already held',
  'schedule.generator.generate': 'Generate',
  'schedule.generator.generating': 'Generating schedule…',
  'schedule.generator.pickDay': 'Please select at least one day',
  'schedule.generator.generated': 'Schedule generated successfully',
  'schedule.generator.generateFailed': 'Failed to generate schedule',

  'schedule.preview.failed': 'Couldn’t calculate the preview — you can still save',
  'schedule.preview.calculating': 'Calculating…',
  'schedule.preview.showDates': 'Show dates',
  'schedule.preview.hideDates': 'Hide dates',
  'schedule.preview.before': 'Before: {lesson}',
  'schedule.preview.started': 'Held so far: {amount}',
  'schedule.preview.planned': 'To be scheduled: {amount}{range}',
  'schedule.preview.total': 'Course total: {amount}',
  'schedule.preview.changes': 'Moved: {moved} · length changed: {resized} · new: {created} · switched off: {off}{offDates}',
  'schedule.preview.tag.move': 'moved',
  'schedule.preview.tag.resize': 'length',
  'schedule.preview.tag.create': 'new',

  'schedule.shorthand.unreadable': 'Can’t read “{text}”',
  'schedule.shorthand.noDay': 'No day for “{text}”',
  'schedule.shorthand.badLength': '“{text}” — a lesson must last from {min} minutes to {max} hours',
  'schedule.shorthand.noTime': 'No time for: {days}',
} as const satisfies MessageTable;
