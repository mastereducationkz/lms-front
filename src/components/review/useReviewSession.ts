// The ONLY module in review mode that touches the network. Every component reads this
// state object and calls these actions; none of them imports the API client.
//
// The state shape, actions, and the reducer itself live in reviewSessionReducer.ts — split
// out so that pure module has no network/router imports and can be unit-tested directly (see
// its header comment). This file wires that reducer into a real useReducer() and adds every
// async action creator (the actual network calls) around it.
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../services/api'
import {
  initialState,
  reducer,
  type ReviewSessionState,
} from './reviewSessionReducer'
import { createRequestGuard, type RequestGuard } from './requestGuard'
import { EN } from './strings'
import type { ReviewUnit } from '../../services/api/review'

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
      dispatch({
        type: 'courses',
        courses: (data || []).map((c: any) => ({ id: Number(c.id), title: c.title })),
      })
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
      // No `!g.is_archived` filter here: getCourseGroupsAnalytics already excludes archived
      // groups unless asked otherwise, so this would be a redundant (and silently
      // divergent, if that default ever changes) second copy of that rule.
      const groups = (data?.groups || [])
        .map((g: any) => ({
          id: Number(g.group_id),
          name: g.group_name,
          studentCount: Number(g.students_count || 0),
        }))
      dispatch({ type: 'groups', groups })
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

  useEffect(() => { loadCourses() }, [loadCourses])

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
