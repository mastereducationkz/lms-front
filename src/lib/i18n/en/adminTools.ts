import type { MessageTable } from '../types';

/** Admin and teacher tools: course creation, the event editor and the quiz lesson editor. */
export const adminTools = {
  'adminTools.course.type': 'Course type',

  'adminTools.events.saveFailed': 'Couldn’t save the event',
  'adminTools.events.loadFailed': 'Couldn’t load the event',

  'adminTools.quiz.audioMode': 'Audio playback mode',
  'adminTools.quiz.audioFlexible': 'Flexible mode',
  'adminTools.quiz.audioFlexibleHint': 'Students can rewind, pause and replay the audio as often as they like. Good for practice and learning.',
  'adminTools.quiz.audioStrict': 'Exam mode',
  'adminTools.quiz.audioStrictHint': 'Students can’t rewind the audio and get only 2 replays. Good for exams and tests.',
} as const satisfies MessageTable;
