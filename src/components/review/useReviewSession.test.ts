// The reducer's reveal-adjacent resets are the other half of the reveal boundary (see
// ReviewQuestionView.test.ts for gapStepHtml): moving anywhere -- a new question, a new gap --
// must never leave a previous answer on screen, and a no-op move (already at the first/last
// gap) must never erase the answer already on screen either (#4). Tested directly against the
// reducer, no rendering needed -- it's a pure function of (state, action).
//
// Imported from reviewSessionReducer.ts, not useReviewSession.ts: the latter also pulls in
// apiClient (services/api/client.ts constructs a TokenManager at import time that touches
// `localStorage`), which doesn't exist in this project's node-environment test runner and
// isn't needed to exercise a pure reducer anyway.
import { describe, expect, it } from 'vitest'
import { initialState, reducer, type Action, type ReviewSessionState } from './reviewSessionReducer'
import { questionKey } from './reviewStats'
// Type-only import: ReviewSessionResponse is a plain interface, no apiClient in its import
// graph, so this stays consistent with the header note above (no network/localStorage touch).
import type { ReviewSessionResponse } from '../../services/api/review'

// Three real gaps, same shape getExpectedAnswers (scoring.ts) parses for any fill_blank —
// the reducer's 'gapIndex' case calls that directly to know how many gaps there are.
const threeGapQuestion = {
  id: 'q1',
  question_type: 'fill_blank',
  content_text: 'The [[cat*,dog]] sat on the [[mat*,rug]] near the [[door*,window]]',
}
const otherQuestion = { id: 'q2', question_type: 'short_answer', correct_answer: 'x' }

function stateWith(overrides: Partial<ReviewSessionState>): ReviewSessionState {
  return {
    ...initialState,
    phase: 'presenting',
    questions: [threeGapQuestion, otherQuestion],
    ...overrides,
  }
}

describe('useReviewSession reducer', () => {
  it('resets gapIndex to 0 and revealed to false on a question change', () => {
    const state = stateWith({ index: 0, gapIndex: 2, revealed: true })
    const next = reducer(state, { type: 'index', index: 1 } as Action)
    expect(next.index).toBe(1)
    expect(next.gapIndex).toBe(0)
    expect(next.revealed).toBe(false)
  })

  it('resets revealed to false on an actual gap change', () => {
    const state = stateWith({ index: 0, gapIndex: 0, revealed: true })
    const next = reducer(state, { type: 'gapIndex', gapIndex: 1 } as Action)
    expect(next.gapIndex).toBe(1)
    expect(next.revealed).toBe(false)
  })

  // #4: clampIndex leaves gapIndex unchanged when the move goes past either end (prev at gap
  // 1, or next at the last gap). The buttons disable at the ends, but the `[`/`]` keyboard
  // shortcuts in ReviewPresenter are not gated the same way, so this no-op case is reachable
  // in the running app, not just a theoretical clamp.
  it('is a true no-op at the lower bound: revealed and gapIndex are untouched', () => {
    const state = stateWith({ index: 0, gapIndex: 0, revealed: true })
    const next = reducer(state, { type: 'gapIndex', gapIndex: -1 } as Action)
    expect(next).toBe(state) // same reference: the reducer bailed out before spreading
    expect(next.gapIndex).toBe(0)
    expect(next.revealed).toBe(true)
  })

  it('is a true no-op at the upper bound: revealed and gapIndex are untouched', () => {
    // threeGapQuestion has gaps at index 0, 1, 2 -- 2 is the last.
    const state = stateWith({ index: 0, gapIndex: 2, revealed: true })
    const next = reducer(state, { type: 'gapIndex', gapIndex: 5 } as Action)
    expect(next).toBe(state)
    expect(next.gapIndex).toBe(2)
    expect(next.revealed).toBe(true)
  })

  it('a real move at the boundary still resets revealed (sanity check on the guard)', () => {
    // Moving from gap 1 to gap 2 (still in range, not a no-op) must still reset revealed --
    // the #4 guard must only skip the reset when the index truly did not change.
    const state = stateWith({ index: 0, gapIndex: 1, revealed: true })
    const next = reducer(state, { type: 'gapIndex', gapIndex: 2 } as Action)
    expect(next.gapIndex).toBe(2)
    expect(next.revealed).toBe(false)
  })
})

// Whole-unit review ('startedUnit'): merges one ReviewSessionResponse per quiz step of a
// unit into one deck. The hazard this section exists to guard against is real and verified in
// production (lesson 134: two quiz steps share 5 identical question ids) -- naively
// concatenating steps and keying anything by `String(question.id)` alone lets one step's
// stats silently overwrite another's, or lets an attempt from one step get graded against a
// same-id question from a different step, with no error either way.
describe('useReviewSession reducer — startedUnit (whole-unit review)', () => {
  const roster = [
    { student_id: 1, full_name: 'Alice' },
    { student_id: 2, full_name: 'Bob' },
    { student_id: 3, full_name: 'Carol' },
  ]

  // Both steps' one question shares the SAME id ('q1') on purpose -- this is the collision
  // fixture. Different correct_answer per step so a mis-keyed/mis-matched implementation
  // produces a different, wrong, and easy-to-spot number instead of coincidentally agreeing.
  const stepAQuestion = {
    id: 'q1', question_type: 'single_choice', question_text: 'Step A question',
    correct_answer: 0, options: [{ text: 'x' }, { text: 'y' }],
  }
  const stepBQuestion = {
    id: 'q1', question_type: 'single_choice', question_text: 'Step B question',
    correct_answer: 1, options: [{ text: 'x' }, { text: 'y' }],
  }

  function makeAttempt(studentId: number, answerIndex: number) {
    return {
      student_id: studentId,
      attempt_id: studentId * 100,
      correct_answers: 0,
      total_questions: 0,
      score_percentage: 0,
      time_spent_seconds: 30,
      completed_at: '2026-09-01T10:00:00Z',
      answers: JSON.stringify([['q1', answerIndex]]),
    }
  }

  // Alice takes both quizzes (answers correctly both times, against each step's OWN key: 0
  // for step A, 1 for step B). Carol takes only step A, and gets it wrong. Bob takes neither.
  const payloadA: ReviewSessionResponse = {
    step: { step_id: 10, title: 'Quiz A', lesson_id: 500, lesson_title: 'Unit 1', course_id: 1, content: { questions: [stepAQuestion] } },
    roster,
    attempts: [makeAttempt(1, 0), makeAttempt(3, 1)], // Alice correct, Carol wrong
    not_submitted: [roster[1]],
  }
  const payloadB: ReviewSessionResponse = {
    step: { step_id: 11, title: 'Quiz B', lesson_id: 500, lesson_title: 'Unit 1', course_id: 1, content: { questions: [stepBQuestion] } },
    roster,
    attempts: [makeAttempt(1, 1)], // Alice correct
    not_submitted: [roster[1], roster[2]],
  }

  it('keys each step\'s stats by (step, question) -- colliding ids across steps do not overwrite each other', () => {
    const next = reducer(initialState, { type: 'startedUnit', payloads: [payloadA, payloadB] } as Action)

    const keyA = questionKey(10, stepAQuestion)
    const keyB = questionKey(11, stepBQuestion)
    expect(keyA).not.toBe(keyB) // the composite keys themselves must differ...

    // ...and so must what they point at: two entries, not one silently clobbering the other.
    expect(Object.keys(next.statsByKey)).toHaveLength(2)
    // Step A: Alice right (0), Carol wrong (1) -> 1/2 = 50%.
    expect(next.statsByKey[keyA]?.percentCorrect).toBe(50)
    // Step B: only Alice, right (1) -> 1/1 = 100%.
    expect(next.statsByKey[keyB]?.percentCorrect).toBe(100)
  })

  it('a student\'s unit score sums their per-step totals; an attempt is never matched against the other step\'s same-id question', () => {
    const next = reducer(initialState, { type: 'startedUnit', payloads: [payloadA, payloadB] } as Action)

    // Alice: correct on both (1/1 in A, 1/1 in B) -> unit score 2/2 = 100%. A wrong
    // implementation that flattens attempts+questions across steps and matches each attempt
    // against BOTH same-id questions would score her 2/4 = 50% here instead (her step-A
    // answer, 0, is wrong against step B's key of 1, and vice versa) -- 100% is only reachable
    // if each attempt is graded solely against its own step's question.
    const alice = next.summary?.top.find((s) => s.studentId === 1)
    expect(alice).toMatchObject({ correct: 2, total: 2, percent: 100 })

    // Carol: wrong on her one attempt (step A only) -> 0/1 = 0%.
    const carol = [...(next.summary?.top ?? []), ...(next.summary?.bottom ?? [])]
      .find((s) => s.studentId === 3)
    expect(carol).toMatchObject({ correct: 0, total: 1, percent: 0 })
  })

  it('not_submitted for the unit = submitted none of its quizzes -- Carol (step A only) is not listed, Bob (neither) is', () => {
    const next = reducer(initialState, { type: 'startedUnit', payloads: [payloadA, payloadB] } as Action)
    expect(next.notSubmitted.map((s) => s.student_id)).toEqual([2])
    expect(next.summary?.notSubmitted.map((s) => s.student_id)).toEqual([2])
    // Distinct submitters (Alice + Carol), not attempt ROWS (which would be 3: Alice x2 + Carol x1).
    expect(next.submittedCount).toBe(2)
  })

  it('deck order follows the order payloads arrived in (the server\'s own step order), not a re-sort', () => {
    const forward = reducer(initialState, { type: 'startedUnit', payloads: [payloadA, payloadB] } as Action)
    expect(forward.questionSteps.map((q) => q.stepId)).toEqual([10, 11])
    expect(forward.steps.map((s) => s.stepId)).toEqual([10, 11])

    const reversed = reducer(initialState, { type: 'startedUnit', payloads: [payloadB, payloadA] } as Action)
    expect(reversed.questionSteps.map((q) => q.stepId)).toEqual([11, 10])
    expect(reversed.steps.map((s) => s.stepId)).toEqual([11, 10])
  })

  it('crossing a step boundary resets revealed and gapIndex exactly like crossing a question boundary already does', () => {
    const started = reducer(initialState, { type: 'startedUnit', payloads: [payloadA, payloadB] } as Action)
    const revealedOnLastQuestionOfStepA = { ...started, index: 0, revealed: true, gapIndex: 0 }
    const next = reducer(revealedOnLastQuestionOfStepA, { type: 'index', index: 1 } as Action)
    expect(next.index).toBe(1)
    expect(next.questionSteps[next.index].stepId).toBe(11) // now on step B's question
    expect(next.revealed).toBe(false)
    expect(next.gapIndex).toBe(0)
  })

  it('a single-quiz unit collapses to the plain single-step path: startedUnit([onePayload]) matches started(onePayload)', () => {
    // Regression guard for "if a unit has only one quiz, whole-unit and that quiz are the
    // same thing" -- the reducer's own contribution to that behaviour (useReviewSession's
    // start() is what actually chooses runStart over runStartUnit for a one-quiz unit, but
    // the reducer output for both paths must agree regardless).
    const viaStarted = reducer(initialState, { type: 'started', payload: payloadA } as Action)
    const viaStartedUnit = reducer(initialState, { type: 'startedUnit', payloads: [payloadA] } as Action)

    expect(viaStartedUnit.questions).toEqual(viaStarted.questions)
    expect(viaStartedUnit.stats).toEqual(viaStarted.stats)
    expect(viaStartedUnit.statsByKey).toEqual(viaStarted.statsByKey)
    expect(viaStartedUnit.summary).toEqual(viaStarted.summary)
    expect(viaStartedUnit.attempts).toEqual(viaStarted.attempts)
    expect(viaStartedUnit.notSubmitted).toEqual(viaStarted.notSubmitted)
    expect(viaStartedUnit.submittedCount).toBe(viaStarted.submittedCount)
  })
})
