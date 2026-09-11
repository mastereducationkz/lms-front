// Pure round-trip / validation tests for reviewUrlState.ts -- no DOM, no router, just
// URLSearchParams (a Node global) in and out. See that module's header comment for why
// `revealed` must never appear in either direction; the last two tests below are the
// guard for that invariant.
import { describe, expect, it } from 'vitest'
import {
  buildReviewSearchParams,
  parseReviewRestoreIntent,
  type ReviewRestoreIntent,
} from './reviewUrlState'

const quizIntent: ReviewRestoreIntent = {
  courseId: 12,
  groupId: 34,
  lessonId: 56,
  mode: 'quiz',
  stepId: 78,
  index: 3,
}

const unitIntent: ReviewRestoreIntent = {
  courseId: 12,
  groupId: 34,
  lessonId: 56,
  mode: 'unit',
  stepId: null,
  index: 0,
}

describe('reviewUrlState round trip', () => {
  it('round-trips a single-step (quiz) intent', () => {
    const params = buildReviewSearchParams(quizIntent)
    expect(parseReviewRestoreIntent(params)).toEqual(quizIntent)
  })

  it('round-trips a whole-unit intent', () => {
    const params = buildReviewSearchParams(unitIntent)
    expect(parseReviewRestoreIntent(params)).toEqual(unitIntent)
  })

  it('round-trips a mid-question index, not just question 1', () => {
    const params = buildReviewSearchParams({ ...quizIntent, index: 21 })
    expect(parseReviewRestoreIntent(params)?.index).toBe(21)
  })
})

describe('reviewUrlState mode is the sole discriminator', () => {
  it('a whole-unit URL never carries a step_id', () => {
    const params = buildReviewSearchParams(unitIntent)
    expect(params.has('step_id')).toBe(false)
  })

  it('a stray step_id alongside mode=unit is ignored -- never restores as a single step', () => {
    const params = buildReviewSearchParams(quizIntent) // mode=quiz, step_id=78
    params.set('mode', 'unit') // flip the discriminator, leave the stale step_id in place
    const parsed = parseReviewRestoreIntent(params)
    expect(parsed?.mode).toBe('unit')
    expect(parsed?.stepId).toBeNull()
  })

  it('a single-step URL never restores as a whole unit', () => {
    const params = buildReviewSearchParams(quizIntent)
    const parsed = parseReviewRestoreIntent(params)
    expect(parsed?.mode).toBe('quiz')
    expect(parsed?.stepId).toBe(78)
  })
})

describe('reviewUrlState garbage, missing, and partial params', () => {
  it('an empty query string yields no restore', () => {
    expect(parseReviewRestoreIntent(new URLSearchParams(''))).toBeNull()
  })

  it('partial params (missing mode and step_id) yield no restore, not a half-built intent', () => {
    const params = new URLSearchParams()
    params.set('course_id', '1')
    params.set('group_id', '2')
    params.set('lesson_id', '3')
    params.set('q', '0')
    // no `mode` at all
    expect(parseReviewRestoreIntent(params)).toBeNull()
  })

  it('quiz mode missing its step_id yields no restore', () => {
    const params = new URLSearchParams()
    params.set('course_id', '1')
    params.set('group_id', '2')
    params.set('lesson_id', '3')
    params.set('mode', 'quiz')
    params.set('q', '0')
    // no step_id
    expect(parseReviewRestoreIntent(params)).toBeNull()
  })

  it('missing index yields no restore', () => {
    const params = buildReviewSearchParams(unitIntent)
    params.delete('q')
    expect(parseReviewRestoreIntent(params)).toBeNull()
  })

  it('an unrecognised mode value yields no restore', () => {
    const params = buildReviewSearchParams(unitIntent)
    params.set('mode', 'bogus')
    expect(parseReviewRestoreIntent(params)).toBeNull()
  })

  it.each([
    ['course_id', 'abc'],
    ['course_id', '-1'],
    ['course_id', '0'],
    ['course_id', '1.5'],
    ['group_id', 'NaN'],
    ['lesson_id', ''],
    ['q', '-1'],
    ['q', 'abc'],
    ['q', '1.5'],
  ])('garbage %s=%s yields no restore', (key, value) => {
    const params = buildReviewSearchParams(unitIntent)
    params.set(key, value)
    expect(parseReviewRestoreIntent(params)).toBeNull()
  })

  it('garbage step_id in quiz mode yields no restore', () => {
    const params = buildReviewSearchParams(quizIntent)
    params.set('step_id', 'not-a-number')
    expect(parseReviewRestoreIntent(params)).toBeNull()
  })

  it('q=0 (question 1) is a valid index, not treated as missing', () => {
    const params = buildReviewSearchParams({ ...unitIntent, index: 0 })
    expect(parseReviewRestoreIntent(params)?.index).toBe(0)
  })
})

describe('reviewUrlState never persists revealed', () => {
  it('buildReviewSearchParams never writes a revealed param, even if smuggled onto the intent', () => {
    const intentWithRevealed = { ...quizIntent, revealed: true } as ReviewRestoreIntent & { revealed: boolean }
    const params = buildReviewSearchParams(intentWithRevealed)
    expect(params.has('revealed')).toBe(false)
    expect(Array.from(params.keys())).not.toContain('revealed')
  })

  it('parseReviewRestoreIntent never reads a revealed param out of the URL', () => {
    const params = buildReviewSearchParams(quizIntent)
    params.set('revealed', 'true')
    const parsed = parseReviewRestoreIntent(params)
    expect(parsed).toEqual(quizIntent) // identical to the no-revealed-param round trip
    expect(parsed).not.toHaveProperty('revealed')
  })
})
