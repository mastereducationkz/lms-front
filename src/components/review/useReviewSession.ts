// The ONLY module in review mode that touches the network. Every component reads this
// state object and calls these actions; none of them imports the API client.
//
// The state shape, actions, and the reducer itself live in reviewSessionReducer.ts — split
// out so that pure module has no network/router imports and can be unit-tested directly (see
// its header comment). This file wires that reducer into a real useReducer() and adds every
// async action creator (the actual network calls) around it.
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiClient from '../../services/api'
import {
  initialState,
  reducer,
  type CourseOption,
  type GroupOption,
  type ReviewSessionState,
} from './reviewSessionReducer'
import { createRequestGuard, type RequestGuard } from './requestGuard'
import { EN } from './strings'
import {
  buildReviewSearchParams,
  parseReviewRestoreIntent,
  type ReviewRestoreIntent,
} from './reviewUrlState'
import type { ReviewUnit } from '../../services/api/review'

// Shared by loadCourses/selectCourse and restoreFromUrl -- the one place each response
// shape gets turned into the option lists the reducer stores, so a restored session is
// built from the exact same mapping a teacher-driven selection would produce, not a
// second, driftable copy of it.
function mapCourses(data: any): CourseOption[] {
  return (data || []).map((c: any) => ({ id: Number(c.id), title: c.title }))
}

// No `!g.is_archived` filter here: getCourseGroupsAnalytics already excludes archived
// groups unless asked otherwise (see selectCourse's own comment) -- this mapper mirrors
// that as-is rather than re-deciding it.
function mapGroups(data: any): GroupOption[] {
  return (data?.groups || []).map((g: any) => ({
    id: Number(g.group_id),
    name: g.group_name,
    studentCount: Number(g.students_count || 0),
  }))
}

// Type-only re-export — deliberately NOT a value re-export of `initialState`/`reducer`. Those
// were module-private before this file split off from reviewSessionReducer.ts, and nothing
// imports them from here: useReviewSession.test.ts imports the pure reducer straight from
// './reviewSessionReducer', with no apiClient in the import graph — see that module's own
// header comment for why. Re-exporting the values here would invite a future test to pull the
// reducer back in through this apiClient-laden module — the exact import path the split
// exists to avoid (#F7).
export type {
  Action,
  CourseOption,
  GroupOption,
  ReviewSessionState,
} from './reviewSessionReducer'

// A 403 means this group is not the user's; anything else is a generic load failure.
function messageFor(err: any): string {
  return err?.response?.status === 403 ? EN.accessDenied : EN.loadError
}

export interface ReviewSessionActions {
  loadCourses: () => Promise<void>
  selectCourse: (courseId: number) => Promise<void>
  selectGroup: (groupId: number) => Promise<void>
  selectUnit: (lessonId: number) => void
  selectQuiz: (stepId: number) => void
  start: () => Promise<void>
  startQuiz: (lessonId: number, stepId: number) => Promise<void>
  next: () => void
  prev: () => void
  jumpTo: (index: number) => void
  nextGap: () => void
  prevGap: () => void
  toggleReveal: () => void
  toggleStats: () => void
  toggleNames: () => void
  toggleGrid: () => void
  closeGrid: () => void
  finish: () => void
  restart: () => void
  exit: () => void
}

export function useReviewSession(): [ReviewSessionState, ReviewSessionActions] {
  const [state, dispatch] = useReducer(reducer, initialState)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Async callbacks need the latest selection without being re-created on every change.
  const stateRef = useRef(state)
  stateRef.current = state

  // Guards against stale-response races: selectCourse -> selectGroup -> start form a
  // strictly ordered cascade, so a single shared guard is enough. Each of those three
  // actions takes a token before firing its request; when the request resolves (success
  // or failure) it only dispatches if the token is still current, i.e. no newer selection
  // has superseded it. Without this, a slow response for a selection the teacher has
  // since changed away from can land after a newer one and silently overwrite the screen
  // with data for the wrong course/group/quiz -- including flipping into 'presenting'
  // with a different group's questions and answers. Do not "simplify" this away; the fix
  // is deliberately not disabling the selects while loading.
  //
  // useRef's argument is not lazy -- useRef(createRequestGuard()) would call the factory on
  // every render and throw the result away every time but the first, which is wasteful but,
  // more importantly, easy to later "fix" by hoisting the guard out of the hook into module
  // scope, which would turn this per-hook-instance guard into a singleton shared by every
  // mounted useReviewSession. Initialise lazily on first use instead, so there is exactly
  // one guard instance per hook instance, shared by all three async actions below.
  const guardRef = useRef<RequestGuard | null>(null)
  if (guardRef.current === null) {
    guardRef.current = createRequestGuard()
  }
  const guard = guardRef.current

  const loadCourses = useCallback(async () => {
    dispatch({ type: 'loading' })
    try {
      const data = await apiClient.getCourses()
      dispatch({ type: 'courses', courses: mapCourses(data) })
    } catch (err) {
      dispatch({ type: 'error', message: messageFor(err) })
    }
  }, [])

  const selectCourse = useCallback(async (courseId: number) => {
    dispatch({ type: 'selectCourse', courseId })
    if (!courseId) return
    const token = guard.start()
    dispatch({ type: 'loading' })
    try {
      const data = await apiClient.getCourseGroupsAnalytics(String(courseId))
      if (!guard.isCurrent(token)) return // superseded by a newer selection
      dispatch({ type: 'groups', groups: mapGroups(data) })
    } catch (err) {
      if (!guard.isCurrent(token)) return // superseded by a newer selection
      dispatch({ type: 'error', message: messageFor(err) })
    }
  }, [])

  const selectGroup = useCallback(async (groupId: number) => {
    dispatch({ type: 'selectGroup', groupId })
    const courseId = stateRef.current.selectedCourseId
    if (!groupId || !courseId) return
    const token = guard.start()
    dispatch({ type: 'loading' })
    try {
      const data = await apiClient.getReviewQuizzes(courseId, groupId)
      if (!guard.isCurrent(token)) return // superseded by a newer selection
      dispatch({ type: 'quizzes', units: data.units || [], rosterCount: data.roster_count || 0 })
    } catch (err) {
      if (!guard.isCurrent(token)) return // superseded by a newer selection
      dispatch({ type: 'error', message: messageFor(err) })
    }
  }, [])

  const selectUnit = useCallback((lessonId: number) => {
    dispatch({ type: 'selectUnit', lessonId })
  }, [])

  const selectQuiz = useCallback((stepId: number) => {
    dispatch({ type: 'selectQuiz', stepId })
  }, [])

  // Shared by start() and startQuiz(): both end up fetching the same session, they just
  // get stepId/groupId from different places (state vs. explicit args).
  const runStart = useCallback(async (stepId: number, groupId: number) => {
    const token = guard.start()
    dispatch({ type: 'loading' })
    try {
      const payload = await apiClient.getReviewSession(stepId, groupId)
      if (!guard.isCurrent(token)) return // superseded by a newer selection
      dispatch({ type: 'started', payload })
    } catch (err) {
      if (!guard.isCurrent(token)) return // superseded by a newer selection
      dispatch({ type: 'error', message: messageFor(err) })
    }
  }, [])

  // Whole-unit review: fetch every quiz step's session in parallel and merge them into one
  // deck (reviewSessionReducer's 'startedUnit'). Goes through the SAME request-token guard as
  // runStart, on both branches, so a unit fetch superseded by a newer selection never lands —
  // no special-casing for "this one has several requests in flight" beyond Promise.all itself.
  // Promise.all also gives the exact "all or nothing" failure mode the spec calls for: if any
  // one step's request rejects, the whole call rejects and no partial deck is ever dispatched.
  const runStartUnit = useCallback(async (unit: ReviewUnit, groupId: number) => {
    const token = guard.start()
    dispatch({ type: 'loading' })
    try {
      // Promise.all resolves in input order regardless of which request actually finishes
      // first, and `unit.quizzes` is already in /review/quizzes' own step order — so
      // `payloads` lands in the server's deliberate curriculum order with no re-sorting here.
      const payloads = await Promise.all(
        unit.quizzes.map((quiz) => apiClient.getReviewSession(quiz.step_id, groupId)),
      )
      if (!guard.isCurrent(token)) return // superseded by a newer selection
      dispatch({ type: 'startedUnit', payloads })
    } catch (err) {
      if (!guard.isCurrent(token)) return // superseded by a newer selection
      dispatch({ type: 'error', message: messageFor(err) })
    }
  }, [])

  // With a Quiz explicitly picked, behaves exactly as before (single step). With Quiz left
  // empty, reviews the whole selected unit — unless that unit has only one quiz, in which
  // case a "whole unit" fetch would be pointless machinery around what is already that one
  // quiz; runStart's plain single-step path handles it instead, so a one-quiz unit's review
  // is byte-identical to picking that quiz explicitly.
  const start = useCallback(async () => {
    const { selectedStepId, selectedGroupId, selectedLessonId, units } = stateRef.current
    if (!selectedGroupId) return
    if (selectedStepId) {
      await runStart(selectedStepId, selectedGroupId)
      return
    }
    if (!selectedLessonId) return
    const unit = units.find((u) => u.lesson_id === selectedLessonId)
    if (!unit || unit.quizzes.length === 0) return
    if (unit.quizzes.length === 1) {
      await runStart(unit.quizzes[0].step_id, selectedGroupId)
      return
    }
    await runStartUnit(unit, selectedGroupId)
  }, [runStart, runStartUnit])

  // A "Worth reviewing" row already knows exactly which lesson/quiz it wants started --
  // it doesn't need the two-step select-then-press-Start dance. It still dispatches
  // selectUnit/selectQuiz so the pickers above reflect the choice, but it must NOT then
  // call start() and rely on stateRef to have caught up: dispatch is async, so stateRef
  // (updated on render) can still hold the previous selection when start() would run in
  // the same tick. Taking stepId directly from the click sidesteps that race entirely --
  // only groupId is read from state, and that's already settled by the time this list is
  // visible at all (it only renders once a group is selected).
  const startQuiz = useCallback(async (lessonId: number, stepId: number) => {
    dispatch({ type: 'selectUnit', lessonId })
    dispatch({ type: 'selectQuiz', stepId })
    const groupId = stateRef.current.selectedGroupId
    if (!groupId) return
    await runStart(stepId, groupId)
  }, [runStart])

  // Re-establishes a session from a parsed URL intent on mount (refresh, browser restore,
  // or a pasted link) -- the fix for "refreshing mid-review throws the teacher back to the
  // launcher". Goes through the SAME shared guard as every other async action here, one
  // token for the whole chain: this is inherently a multi-step cascade (courses -> this
  // course's groups -> this group's quizzes -> the session itself), so a single token
  // checked after every await is the natural extension of the guard, not a special case of
  // it -- a click anywhere in the launcher while this is in flight bumps the SAME guard and
  // supersedes it, exactly as it would supersede selectCourse/selectGroup/start.
  //
  // Deliberately does NOT chain the exposed selectCourse/selectGroup actions and then read
  // stateRef afterwards: startQuiz's own comment above already documents why that races
  // (dispatch is async; stateRef only catches up on the next render). Every value this
  // needs -- the fetched courses/groups/units -- is kept in a local variable from the
  // fetch's own response instead, never re-read back out of state.
  //
  // A deleted group, a removed unit, a step id that no longer belongs to it (or never did),
  // a course the teacher lost access to -- every mismatch between the URL and what the
  // server actually has falls through to the ordinary 'error' dispatch, landing on the
  // launcher with the existing error banner (and, for a 403, the existing "no access to
  // this group" copy via messageFor) -- never a crash, never a partial deck.
  const restoreFromUrl = useCallback(async (intent: ReviewRestoreIntent) => {
    const token = guard.start()
    dispatch({ type: 'loading' })
    try {
      const coursesData = await apiClient.getCourses()
      if (!guard.isCurrent(token)) return
      dispatch({ type: 'courses', courses: mapCourses(coursesData) })
      dispatch({ type: 'selectCourse', courseId: intent.courseId })

      const groupsData = await apiClient.getCourseGroupsAnalytics(String(intent.courseId))
      if (!guard.isCurrent(token)) return
      dispatch({ type: 'groups', groups: mapGroups(groupsData) })
      dispatch({ type: 'selectGroup', groupId: intent.groupId })

      const quizzesData = await apiClient.getReviewQuizzes(intent.courseId, intent.groupId)
      if (!guard.isCurrent(token)) return
      const units: ReviewUnit[] = quizzesData.units || []
      dispatch({ type: 'quizzes', units, rosterCount: quizzesData.roster_count || 0 })

      const unit = units.find((u) => u.lesson_id === intent.lessonId)
      if (!unit || unit.quizzes.length === 0) {
        dispatch({ type: 'error', message: EN.loadError })
        return
      }
      dispatch({ type: 'selectUnit', lessonId: intent.lessonId })

      if (intent.mode === 'quiz') {
        const step = unit.quizzes.find((q) => q.step_id === intent.stepId)
        if (!step) {
          dispatch({ type: 'error', message: EN.loadError })
          return
        }
        dispatch({ type: 'selectQuiz', stepId: step.step_id })
        const payload = await apiClient.getReviewSession(step.step_id, intent.groupId)
        if (!guard.isCurrent(token)) return
        dispatch({ type: 'started', payload })
      } else if (unit.quizzes.length === 1) {
        // Mirrors start()'s own single-quiz-unit collapse: a one-quiz unit's whole-unit
        // review is byte-identical to picking that quiz explicitly, so restoring it goes
        // through the same plain single-step path (and the URL self-corrects to mode=quiz
        // on the next write-back below, same as a fresh start() of that unit would).
        const payload = await apiClient.getReviewSession(unit.quizzes[0].step_id, intent.groupId)
        if (!guard.isCurrent(token)) return
        dispatch({ type: 'started', payload })
      } else {
        const payloads = await Promise.all(
          unit.quizzes.map((quiz) => apiClient.getReviewSession(quiz.step_id, intent.groupId)),
        )
        if (!guard.isCurrent(token)) return
        dispatch({ type: 'startedUnit', payloads })
      }

      if (!guard.isCurrent(token)) return
      // clampIndex (reviewSessionReducer) clamps a stale/out-of-range index to the deck's
      // real bounds -- never a crash from an index that no longer fits.
      dispatch({ type: 'index', index: intent.index })
    } catch (err) {
      if (!guard.isCurrent(token)) return
      dispatch({ type: 'error', message: messageFor(err) })
    }
  }, [])

  const next = useCallback(() => dispatch({ type: 'index', index: stateRef.current.index + 1 }), [])
  const prev = useCallback(() => dispatch({ type: 'index', index: stateRef.current.index - 1 }), [])
  const jumpTo = useCallback((index: number) => dispatch({ type: 'index', index }), [])

  // Gap navigation is deliberately its own action pair, not a repurposing of next/prev —
  // ← / → must keep meaning "next/previous question" everywhere in the presenter.
  const nextGap = useCallback(() => dispatch({ type: 'gapIndex', gapIndex: stateRef.current.gapIndex + 1 }), [])
  const prevGap = useCallback(() => dispatch({ type: 'gapIndex', gapIndex: stateRef.current.gapIndex - 1 }), [])

  const toggleReveal = useCallback(() => dispatch({ type: 'toggleReveal' }), [])
  const toggleStats = useCallback(() => dispatch({ type: 'toggleStats' }), [])
  const toggleNames = useCallback(() => dispatch({ type: 'toggleNames' }), [])
  const toggleGrid = useCallback(() => dispatch({ type: 'toggleGrid' }), [])
  const closeGrid = useCallback(() => dispatch({ type: 'closeGrid' }), [])

  const finish = useCallback(() => dispatch({ type: 'finish' }), [])
  const restart = useCallback(() => dispatch({ type: 'restart' }), [])
  const exit = useCallback(() => navigate('/dashboard'), [navigate])

  // On mount only: a well-formed review URL restores that session (see restoreFromUrl
  // above); otherwise this is the ordinary cold start. `restoredRef` (not just an empty
  // dependency array) is the guard against React 18 StrictMode's dev-only double-invoke of
  // mount effects -- without it, a restore's whole 3-4-request chain would fire twice on
  // every dev mount. Deliberately NOT reactive to `searchParams`: the write-back effect
  // below updates the URL as the teacher navigates, and re-running this on every one of
  // those writes would re-attempt a restore (or a redundant loadCourses()) mid-review.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const intent = parseReviewRestoreIntent(searchParams)
    if (intent) {
      restoreFromUrl(intent)
    } else {
      loadCourses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keeps the URL in step with the teacher's navigation once a review is under way, so a
  // refresh, a browser Back/restore, or a copied link lands back on the same question --
  // this is the write half of restoreFromUrl's read half above. `replace: true` throughout:
  // within-review updates must not turn the browser's Back button into a question-by-
  // question undo.
  //
  // Deliberately excludes `revealed` and `gapIndex` from what it writes -- see
  // reviewUrlState.ts's header comment: this screen is projected live, and a refresh must
  // always come back with the answer hidden, never mid-reveal on whatever gap the teacher
  // last stopped on.
  useEffect(() => {
    if (state.phase !== 'presenting' && state.phase !== 'summary') return
    const { selectedCourseId, selectedGroupId, selectedLessonId, step, index } = state
    if (!selectedCourseId || !selectedGroupId || !selectedLessonId) return
    const intent: ReviewRestoreIntent = step
      ? {
          courseId: selectedCourseId, groupId: selectedGroupId, lessonId: selectedLessonId,
          mode: 'quiz', stepId: step.step_id, index,
        }
      : {
          courseId: selectedCourseId, groupId: selectedGroupId, lessonId: selectedLessonId,
          mode: 'unit', stepId: null, index,
        }
    setSearchParams(buildReviewSearchParams(intent), { replace: true })
  }, [
    state.phase, state.selectedCourseId, state.selectedGroupId, state.selectedLessonId,
    state.step, state.index, setSearchParams,
  ])

  const actions = useMemo<ReviewSessionActions>(() => ({
    loadCourses, selectCourse, selectGroup, selectUnit, selectQuiz, start, startQuiz,
    next, prev, jumpTo, nextGap, prevGap,
    toggleReveal, toggleStats, toggleNames, toggleGrid, closeGrid,
    finish, restart, exit,
  }), [loadCourses, selectCourse, selectGroup, selectUnit, selectQuiz, start, startQuiz,
    next, prev, jumpTo, nextGap, prevGap, toggleReveal, toggleStats, toggleNames, toggleGrid,
    closeGrid, finish, restart, exit])

  return [state, actions]
}

export default useReviewSession
