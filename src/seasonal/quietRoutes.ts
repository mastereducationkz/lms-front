/**
 * Screens a season never decorates (owner, 2026-10-26): taking a quiz, test or homework, the
 * projector screens a teacher shows a class, printouts, and the Meet add-on. The palette still
 * follows the season there; nothing else does — no pumpkins, bats, costumes or hunt.
 */
const QUIET: readonly RegExp[] = [
  /^\/quiz\/[^/]+/, // taking a quiz
  /^\/homework\/\d+(\/record)?\/?$/, // doing or recording a homework (not the list, not /homework/new)
  /^\/lecture\//, // the lesson player, quizzes inside
  /^\/assignment-zero/, // the entry self-assessment
  /^\/review/, // quiz review on the projector
  /^\/live\/present\//, // the live-lesson presenter
  /\/practice-print$/, // printouts
  /^\/meet-addon/, // Google Meet side panel
  /^\/watch\//, // a recording opened with a watch link
];

export function isQuietRoute(pathname: string): boolean {
  return QUIET.some((rule) => rule.test(pathname));
}
