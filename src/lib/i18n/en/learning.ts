import type { MessageTable } from '../types';

/** A student's learning screens: the course list, completion lines, the lesson and its quiz. */
export const learning = {
  'learning.completion.lessons': { one: '{done} of {count} lesson', other: '{done} of {count} lessons' },
  'learning.completion.checkpoints': 'Checkpoints: {taken} of {opened}',
  'learning.completion.checkpointsWithAverage': 'Checkpoints: {taken} of {opened} · average {average}%',

  'learning.courses.title': 'Courses',
  'learning.courses.manage': 'Manage Courses',
  'learning.courses.teacher': 'Teacher: {name}',
  'learning.courses.loadFailed': 'Failed to load courses',
  'learning.courses.errorTitle': 'Error loading courses',
  'learning.courses.readOnlyNote': 'View only: open any lesson, quiz answers included. Nothing you do is saved as progress.',
  'learning.courses.search': 'Search courses',
  'learning.courses.empty': 'No courses available',
  'learning.courses.emptyStudentHint': 'Contact your teacher to get enrolled in courses',
  'learning.courses.yourGroups': 'Your groups',
  'learning.courses.draft': 'Draft',
  'learning.courses.completed': 'Course completed',
  'learning.courses.continue': 'Continue learning',
  'learning.courses.view': 'View course',

  'learning.lesson.loadFailed': 'Couldn’t load the lesson. Reload the page or message your curator.',
  'learning.lesson.staffPreview': 'Preview',
  'learning.lesson.staffPreviewHint': 'You are previewing as staff: no progress, attempts or completions are saved.',
  'learning.lesson.skip': 'Skip',
  'learning.lesson.skipHint': 'Next lesson (nothing is marked complete)',
  'learning.lesson.back': 'Back to course',
  'learning.lesson.lessons': 'Lessons',

  'learning.flashcards.easy': 'Easy',
  'learning.flashcards.hard': 'Hard',
  'learning.flashcards.reveal': 'Click to reveal',
  'learning.flashcards.flipBack': 'Click to flip back',
  'learning.flashcards.remove': 'Remove from favorites',
  'learning.flashcards.frontImage': 'Front',
  'learning.flashcards.backImage': 'Back',
  'learning.flashcards.stillLearning': 'Still learning',
  'learning.flashcards.gotIt': 'Got it',
  'learning.flashcards.stillLearningHint': 'Cards you’re still learning come back before the deck ends and are kept in My Flashcards.',
  'learning.flashcards.savedToMine': 'Saved to My Flashcards',

  'learning.quiz.answerAll': 'Answer every question ({answered}/{total})',
} as const satisfies MessageTable;
