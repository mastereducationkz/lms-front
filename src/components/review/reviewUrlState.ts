// Pure URL <-> intent mapping for review mode's mid-session refresh recovery. No network,
// router, or React imports here on purpose -- same reasoning as reviewSessionReducer.ts's
// header comment: it lets this be unit-tested directly in plain node, with no jsdom shim.
// useReviewSession.ts's restoreFromUrl is the only place that turns a parsed intent back
// into real fetches (through the shared request-token guard, same as every other async
// action there); this module never touches the network itself.
//
// `revealed` (and gapIndex) are deliberately NEVER part of this shape, in either direction.
// This screen is projected to a live class -- restoring into an already-revealed answer, or
// a mid-gap-revealed state, would put the answer key on the wall the instant a refresh (or
// a browser Back) lands. A restored review always re-enters at gap 1, unrevealed -- exactly
// what reviewSessionReducer's 'started'/'startedUnit'/'index' cases already produce, since
// none of them ever set `revealed` to true. See reviewUrlState.test.ts's guard tests.

export type ReviewRestoreMode = 'quiz' | 'unit'

export interface ReviewRestoreIntent {
  courseId: number
  groupId: number
  lessonId: number
  mode: ReviewRestoreMode
  /** The step being reviewed -- populated only in 'quiz' mode. Always null in 'unit' mode:
   *  a whole-unit review has no single step, by construction (see
   *  reviewSessionReducer's 'startedUnit'). */
  stepId: number | null
  /** Which question in the deck to land back on. */
  index: number
}

const PARAM = {
  course: 'course_id',
  group: 'group_id',
  lesson: 'lesson_id',
  mode: 'mode',
  step: 'step_id',
  index: 'q',
} as const

function parsePositiveInt(raw: string | null): number | null {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

function parseNonNegativeInt(raw: string | null): number | null {
  if (raw === null || !/^(0|[1-9]\d*)$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

/**
 * Parses a review URL's search params into a restore intent, or null if the params do not
 * describe a complete, well-formed review session. Deliberately all-or-nothing: garbage,
 * missing, and partial params all return null rather than a half-built intent -- the caller
 * (useReviewSession's restoreFromUrl) only ever attempts to restore a full session, never a
 * guess assembled from whatever happened to be present.
 *
 * This only validates SHAPE (well-formed positive integers, a recognised mode). It does NOT
 * know whether the course/group/lesson/step actually still exist, still belong to this
 * teacher, or belong to each other -- a deleted group, a removed quiz, or a step id copied
 * from another course all parse into a perfectly well-formed intent here. That's by design:
 * confirming those against real data means a network round trip, which belongs in
 * useReviewSession's restoreFromUrl (through the request-token guard), not in this pure
 * module.
 */
export function parseReviewRestoreIntent(params: URLSearchParams): ReviewRestoreIntent | null {
  const courseId = parsePositiveInt(params.get(PARAM.course))
  const groupId = parsePositiveInt(params.get(PARAM.group))
  const lessonId = parsePositiveInt(params.get(PARAM.lesson))
  const index = parseNonNegativeInt(params.get(PARAM.index))
  const mode = params.get(PARAM.mode)

  if (courseId === null || groupId === null || lessonId === null || index === null) return null

  // `mode` is the sole discriminator between the two shapes -- never step_id's presence or
  // absence. A stray/stale step_id sitting in the URL alongside mode=unit is simply not
  // read: it can never flip a whole-unit intent into a single-step one, or vice versa.
  if (mode === 'unit') {
    return { courseId, groupId, lessonId, mode: 'unit', stepId: null, index }
  }
  if (mode === 'quiz') {
    const stepId = parsePositiveInt(params.get(PARAM.step))
    if (stepId === null) return null
    return { courseId, groupId, lessonId, mode: 'quiz', stepId, index }
  }
  return null // missing or unrecognised mode -- no restore
}

/**
 * The exact inverse of parseReviewRestoreIntent: buildReviewSearchParams(intent), parsed
 * back with parseReviewRestoreIntent, reproduces the same intent (see
 * reviewUrlState.test.ts's round-trip test). Only ever writes step_id in 'quiz' mode -- a
 * 'unit' mode URL carries no step_id at all, so there is nothing left over for a later
 * parse to misread as a stale single-step choice.
 */
export function buildReviewSearchParams(intent: ReviewRestoreIntent): URLSearchParams {
  const params = new URLSearchParams()
  params.set(PARAM.course, String(intent.courseId))
  params.set(PARAM.group, String(intent.groupId))
  params.set(PARAM.lesson, String(intent.lessonId))
  params.set(PARAM.mode, intent.mode)
  if (intent.mode === 'quiz' && intent.stepId !== null) {
    params.set(PARAM.step, String(intent.stepId))
  }
  params.set(PARAM.index, String(intent.index))
  return params
}
