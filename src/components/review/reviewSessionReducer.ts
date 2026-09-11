// The pure state machine behind useReviewSession, split out on purpose: this file has no
// network, router, or storage imports (not even transitively — see useReviewSession.ts's own
// header comment: it is the ONLY module in review mode that touches the network), so it can
// be unit-tested directly, in plain node, with no jsdom/localStorage shims. useReviewSession.ts
// wires this reducer into a real useReducer() and adds every async action creator around it.
//
// Two invariants worth stating, both learned in a classroom:
//   * `revealed` resets on every question change — the answer must never already be on
//     screen when a new question appears;
//   * the stats / names / grid toggles persist across questions, so the teacher does not
//     press them once per question.
import type {
  ReviewSessionResponse,
  ReviewUnit,
} from '../../services/api/review'
import { getExpectedAnswers } from '../lesson/quiz/scoring'
import {
  buildClassSummary,
  buildQuestionStats,
  reviewQuestions,
  type ClassSummary,
  type ClassSummaryGroup,
  type QuestionStat,
  type ReviewAttempt,
  type StudentRef,
} from './reviewStats'

export interface CourseOption { id: number; title: string }
export interface GroupOption { id: number; name: string; studentCount: number }

/** Which step a deck question at a given array position came from — a parallel array,
 *  aligned 1:1 with `questions`/`stats`, never a lookup keyed by question id alone (see
 *  questionKey's doc comment for why raw ids repeat across a unit's steps). */
export interface QuestionStepMeta { stepId: number; stepTitle: string }

/** One quiz step's slice of the deck, for the question-grid dividers and the unit-level
 *  "submitted" math — `startIndex`/`questionCount` let a renderer slice `questions` into
 *  per-step sections without re-deriving step boundaries from `questionSteps` itself. */
export interface ReviewStepSummary {
  stepId: number
  stepTitle: string
  startIndex: number
  questionCount: number
  submittedCount: number
}

/** Attempts stay tagged with the step they belong to once more than one step is merged into
 *  one deck (see the module header note on `attempts` below) — this is the tag. */
export type DeckAttempt = ReviewAttempt & { stepId: number }

export interface ReviewSessionState {
  phase: 'launcher' | 'presenting' | 'summary'
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null

  courses: CourseOption[]
  groups: GroupOption[]
  units: ReviewUnit[]
  rosterCount: number

  selectedCourseId: number | null
  selectedGroupId: number | null
  selectedLessonId: number | null
  selectedStepId: number | null

  // Populated only for a single-quiz review — the one step being presented. null for a
  // whole-unit review, which spans several steps; use `unitTitle` + `questionSteps`/`steps`
  // instead, which are populated for BOTH modes (a single-quiz review still fills them in
  // with one step's worth of data) so the presenter/grid never need to branch on which mode
  // produced the deck.
  step: ReviewSessionResponse['step'] | null
  /** The unit's own title, spanning the whole deck regardless of how many steps it holds. */
  unitTitle: string | null
  questions: any[]
  /** Aligned 1:1 with `questions` — questionSteps[i] names the step question[i] came from. */
  questionSteps: QuestionStepMeta[]
  /** One entry per quiz step in the deck, in deck order (see ReviewStepSummary). */
  steps: ReviewStepSummary[]
  stats: QuestionStat[]
  // Keyed by the composite `questionKey(stepId, question)` — NEVER by a raw question id
  // alone. Question ids are not unique across a unit's quiz steps (verified in production:
  // two steps on one lesson sharing five identical ids), so an id-only key silently makes one
  // step's stats overwrite another's, with no error, the moment two steps are merged into one
  // deck. Every reader of this map (ReviewPresenter, ReviewQuestionGrid) must look up with
  // questionKey(questionSteps[i].stepId, questions[i]), not String(question.id).
  statsByKey: Record<string, QuestionStat>
  summary: ClassSummary | null
  roster: StudentRef[]
  // Tagged with the step each attempt belongs to (DeckAttempt = ReviewAttempt & { stepId }) —
  // never flattened into a plain ReviewAttempt[] that loses which step an attempt answered.
  // Scoring (buildClassSummary) groups these back up by stepId before matching any attempt
  // against a question, so an attempt from step A is never graded against step B's
  // identically-id'd question.
  attempts: DeckAttempt[]
  notSubmitted: StudentRef[]
  /** Distinct students who submitted anything in the deck — roster.length - notSubmitted.length
   *  for a whole unit, attempts.length for a single quiz (where those two already agree, one
   *  attempt per student). NOT attempts.length in general: that double-counts a student who
   *  submitted more than one quiz in a multi-step unit. */
  submittedCount: number

  index: number
  /**
   * Which gap of the current question is under discussion — meaningful only when that
   * question is a gap type (fill_blank / text_completion); 0 and ignored otherwise. Resets
   * to 0 on every question change, exactly like `revealed` does.
   */
  gapIndex: number
  revealed: boolean
  statsVisible: boolean
  namesVisible: boolean
  gridOpen: boolean
}

export const initialState: ReviewSessionState = {
  phase: 'launcher',
  status: 'idle',
  error: null,
  courses: [],
  groups: [],
  units: [],
  rosterCount: 0,
  selectedCourseId: null,
  selectedGroupId: null,
  selectedLessonId: null,
  selectedStepId: null,
  step: null,
  unitTitle: null,
  questions: [],
  questionSteps: [],
  steps: [],
  stats: [],
  statsByKey: {},
  summary: null,
  roster: [],
  attempts: [],
  notSubmitted: [],
  submittedCount: 0,
  index: 0,
  gapIndex: 0,
  revealed: false,
  statsVisible: true,
  // Opt in, not opt out: the very first frame a class sees must not show who got the
  // question wrong. The teacher can turn names on once they choose to.
  namesVisible: false,
  gridOpen: false,
}

export type Action =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'courses'; courses: CourseOption[] }
  | { type: 'selectCourse'; courseId: number | null }
  | { type: 'groups'; groups: GroupOption[] }
  | { type: 'selectGroup'; groupId: number | null }
  | { type: 'quizzes'; units: ReviewUnit[]; rosterCount: number }
  | { type: 'selectUnit'; lessonId: number | null }
  | { type: 'selectQuiz'; stepId: number | null }
  | { type: 'started'; payload: ReviewSessionResponse }
  // One payload per quiz step of the unit, in the order /review/quizzes returned those steps
  // (the server's deliberate curriculum order) — the caller (useReviewSession's runStartUnit)
  // fetches them in parallel via Promise.all, which resolves in input order regardless of
  // which request actually finished first, so this array is already in the right order by
  // construction; the reducer below does not re-sort it.
  | { type: 'startedUnit'; payloads: ReviewSessionResponse[] }
  | { type: 'index'; index: number }
  | { type: 'gapIndex'; gapIndex: number }
  | { type: 'toggleReveal' }
  | { type: 'toggleStats' }
  | { type: 'toggleNames' }
  | { type: 'toggleGrid' }
  | { type: 'closeGrid' }
  | { type: 'finish' }
  | { type: 'restart' }

function clampIndex(i: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(Math.max(i, 0), total - 1)
}

export function reducer(state: ReviewSessionState, action: Action): ReviewSessionState {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading', error: null }
    case 'error':
      return { ...state, status: 'error', error: action.message }

    case 'courses':
      return { ...state, status: 'ready', error: null, courses: action.courses }
    case 'selectCourse':
      return {
        ...state,
        selectedCourseId: action.courseId,
        selectedGroupId: null,
        selectedLessonId: null,
        selectedStepId: null,
        groups: [],
        units: [],
      }
    case 'groups':
      return { ...state, status: 'ready', error: null, groups: action.groups }
    case 'selectGroup':
      return {
        ...state,
        selectedGroupId: action.groupId,
        selectedLessonId: null,
        selectedStepId: null,
        units: [],
      }
    case 'quizzes':
      return {
        ...state,
        status: 'ready',
        error: null,
        units: action.units,
        rosterCount: action.rosterCount,
      }
    case 'selectUnit':
      return { ...state, selectedLessonId: action.lessonId, selectedStepId: null }
    case 'selectQuiz':
      return { ...state, selectedStepId: action.stepId }

    case 'started': {
      const { step, attempts, roster, not_submitted: notSubmitted } = action.payload
      const questions = reviewQuestions(step.content)
      const nameById = new Map(roster.map((s) => [s.student_id, s.full_name]))
      // Single-quiz review still runs through the composite-key machinery (stepId = the
      // step's own id) rather than a special-cased id-only path — that is what makes a
      // single-step review provably identical to one group of a whole-unit review, not just
      // similar to it.
      const stats = buildQuestionStats(questions, attempts, nameById, step.step_id)
      const statsByKey: Record<string, QuestionStat> = {}
      // Keyed by the composite (step, question) identity, never by raw question id alone —
      // see questionKey's doc comment (reviewStats.ts) and this file's own header comment.
      stats.forEach((stat) => { statsByKey[stat.key] = stat })
      const questionSteps: QuestionStepMeta[] = questions.map(() => (
        { stepId: step.step_id, stepTitle: step.title }
      ))
      const steps: ReviewStepSummary[] = [{
        stepId: step.step_id,
        stepTitle: step.title,
        startIndex: 0,
        questionCount: questions.length,
        submittedCount: attempts.length,
      }]
      const taggedAttempts: DeckAttempt[] = attempts.map((a) => ({ ...a, stepId: step.step_id }))
      const groups: ClassSummaryGroup[] = [{ stepId: step.step_id, questions, attempts }]
      return {
        ...state,
        status: 'ready',
        error: null,
        phase: 'presenting',
        step,
        unitTitle: step.lesson_title,
        questions,
        questionSteps,
        steps,
        stats,
        statsByKey,
        summary: buildClassSummary(stats, groups, nameById, notSubmitted),
        roster,
        attempts: taggedAttempts,
        notSubmitted,
        submittedCount: attempts.length,
        index: 0,
        gapIndex: 0,
        revealed: false,
      }
    }

    case 'startedUnit': {
      const { payloads } = action
      if (payloads.length === 0) return state
      // Roster is identical in every response (same group) — take the first.
      const roster = payloads[0].roster
      const nameById = new Map(roster.map((s) => [s.student_id, s.full_name]))

      let questions: any[] = []
      let questionSteps: QuestionStepMeta[] = []
      let stats: QuestionStat[] = []
      const statsByKey: Record<string, QuestionStat> = {}
      const groups: ClassSummaryGroup[] = []
      const attempts: DeckAttempt[] = []
      const steps: ReviewStepSummary[] = []
      const submittedStudentIds = new Set<number>()

      // Deck order follows the order `payloads` arrived in, which is the order
      // useReviewSession's runStartUnit fetched them in — i.e. /review/quizzes' own step
      // order, the server's deliberate curriculum order. No re-sorting here.
      for (const payload of payloads) {
        const { step, attempts: stepAttempts } = payload
        const stepQuestions = reviewQuestions(step.content)
        // stepId = step.step_id here, not a shared/default one — this is the one thing that
        // keeps two steps' identically-id'd questions from colliding once merged below.
        const stepStats = buildQuestionStats(stepQuestions, stepAttempts, nameById, step.step_id)
        stepStats.forEach((stat) => { statsByKey[stat.key] = stat })

        const startIndex = questions.length
        questions = questions.concat(stepQuestions)
        questionSteps = questionSteps.concat(
          stepQuestions.map(() => ({ stepId: step.step_id, stepTitle: step.title })),
        )
        stats = stats.concat(stepStats)
        groups.push({ stepId: step.step_id, questions: stepQuestions, attempts: stepAttempts })
        stepAttempts.forEach((a) => {
          attempts.push({ ...a, stepId: step.step_id })
          submittedStudentIds.add(a.student_id)
        })
        steps.push({
          stepId: step.step_id,
          stepTitle: step.title,
          startIndex,
          questionCount: stepQuestions.length,
          submittedCount: stepAttempts.length,
        })
      }

      // A student counts as not having submitted the UNIT only when they submitted NONE of
      // its quizzes — not "submitted this particular step". Per-step submission counts stay
      // visible on `steps[i].submittedCount` for the grid's dividers.
      const notSubmitted = roster.filter((s) => !submittedStudentIds.has(s.student_id))

      return {
        ...state,
        status: 'ready',
        error: null,
        phase: 'presenting',
        step: null,
        unitTitle: payloads[0].step.lesson_title,
        questions,
        questionSteps,
        steps,
        stats,
        statsByKey,
        summary: buildClassSummary(stats, groups, nameById, notSubmitted),
        roster,
        attempts,
        notSubmitted,
        submittedCount: roster.length - notSubmitted.length,
        index: 0,
        gapIndex: 0,
        revealed: false,
      }
    }

    case 'index':
      return {
        ...state,
        index: clampIndex(action.index, state.questions.length),
        // A new question means a new gap 1, not wherever the previous question's stepper
        // happened to be left — same reset `revealed` already gets on question change.
        gapIndex: 0,
        revealed: false,
      }

    case 'gapIndex': {
      const question = state.questions[state.index]
      const gapCount = question ? getExpectedAnswers(question).length : 0
      const nextGapIndex = clampIndex(action.gapIndex, gapCount)
      // The prev/next buttons disable at the ends, but the `[`/`]` keyboard shortcuts
      // (ReviewPresenter) are not gated the same way — pressing `[` already on gap 1, or `]`
      // already on the last gap, still dispatches this action. clampIndex then returns the
      // same index the teacher was already on, and without this check the fallthrough below
      // would still reset `revealed`, silently erasing the answer the class is looking at for
      // a keypress that didn't actually move anywhere (#4).
      if (nextGapIndex === state.gapIndex) return state
      return {
        ...state,
        gapIndex: nextGapIndex,
        // Moving to another gap must not leave the previous gap's answer on screen —
        // mirrors how moving to another question already resets this.
        revealed: false,
      }
    }

    case 'toggleReveal':
      return { ...state, revealed: !state.revealed }
    case 'toggleStats':
      return { ...state, statsVisible: !state.statsVisible }
    case 'toggleNames':
      return { ...state, namesVisible: !state.namesVisible }
    case 'toggleGrid':
      return { ...state, gridOpen: !state.gridOpen }
    case 'closeGrid':
      return { ...state, gridOpen: false }

    case 'finish':
      return { ...state, phase: 'summary', gridOpen: false }
    case 'restart':
      return { ...state, phase: 'presenting', index: 0, gapIndex: 0, revealed: false }

    default:
      return state
  }
}
