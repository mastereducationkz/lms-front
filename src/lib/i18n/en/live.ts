import type { MessageTable } from '../types';

/** The live lesson's connection notes (Meet panel, lesson page, student live page). */
export const live = {
  'live.reconnecting': 'Reconnecting…',
  'live.offline': 'Couldn’t reach the server. Try again.',
  'live.failed': 'That didn’t work. Try again.',
} as const satisfies MessageTable;
