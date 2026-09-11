// Setup screen: the teacher picks course -> group -> unit -> quiz before anything reaches
// the class. Each select only appears once its parent has a value, so the path is obvious.
import React, { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { EN, format } from './strings'
import type { ReviewSessionActions, ReviewSessionState } from './useReviewSession'
import type { ReviewUnit } from '../../services/api/review'

interface Props {
  state: ReviewSessionState
  actions: ReviewSessionActions
}

const FIELD_LABEL = 'text-sm font-medium text-gray-500 dark:text-gray-400'
const STAT_LABEL = 'text-sm font-medium text-gray-500 dark:text-gray-400'
const STAT_VALUE = 'text-3xl font-bold text-gray-900 dark:text-foreground tabular-nums'

// How many rows the "Worth reviewing" list shows before collapsing the rest into a "+N
// more" line -- a 40-unit course flattens into a lot of quizzes, and this screen is a
// picker, not a report.
const WORTH_REVIEWING_LIMIT = 10

interface WorthReviewingRow {
  lessonId: number
  stepId: number
  unitTitle: string
  quizTitle: string
  submittedCount: number
  averagePercent: number | null
}

// Flattens every taken quiz across every unit into one list. A quiz nobody submitted has
// no average and nothing to review, so it's excluded here rather than filtered later.
function flattenTakenQuizzes(units: ReviewUnit[]): WorthReviewingRow[] {
  const rows: WorthReviewingRow[] = []
  units.forEach((unit) => {
    unit.quizzes.forEach((quiz) => {
      if (quiz.submitted_count > 0) {
        rows.push({
          lessonId: unit.lesson_id,
          stepId: quiz.step_id,
          unitTitle: unit.title,
          quizTitle: quiz.title,
          submittedCount: quiz.submitted_count,
          averagePercent: typeof quiz.average_percent === 'number' ? quiz.average_percent : null,
        })
      }
    })
  })
  return rows
}

export const ReviewLauncher: React.FC<Props> = ({ state, actions }) => {
  const unit = state.units.find((u) => u.lesson_id === state.selectedLessonId) || null
  const quiz = unit?.quizzes.find((q) => q.step_id === state.selectedStepId) || null
  const busy = state.status === 'loading'

  // A unit with only one quiz has no real choice to offer — whole-unit review and that one
  // quiz are the same thing. Hiding the Quiz picker for that case (rather than showing a
  // dropdown with a single, pointless option) is what "don't show a pointless choice" means
  // here; Start still works, it just always means that one quiz (useReviewSession's start()
  // collapses this case to the same plain single-step fetch picking it explicitly would do).
  const singleQuizUnit = !!unit && unit.quizzes.length === 1
  // Enabled once a unit is picked, even with no quiz chosen — that's what makes "leave Quiz
  // empty and press Start" reach the whole unit at all. A unit with zero takeable quizzes
  // (defensive; the noQuizzes message below already tells the teacher when that's the case)
  // still leaves this disabled, since there is nothing start() could do with it.
  const canStart = !!unit && unit.quizzes.length > 0 && !busy
  // Which of the two start() will actually do, so the button never surprises the teacher —
  // an explicit quiz pick, or a single-quiz unit's only quiz, both read as the ordinary
  // single-quiz label; only a genuine "no quiz chosen, more than one on offer" leaves the
  // whole-unit label showing.
  const startLabel = busy
    ? EN.loading
    : (state.selectedStepId || singleQuizUnit) ? EN.start : EN.startUnit

  // Every quiz the group has taken, flattened across units, cheapest to recompute only
  // when the units list itself changes (not on every keystroke/toggle elsewhere on the
  // page).
  const takenQuizzes = useMemo(() => flattenTakenQuizzes(state.units), [state.units])

  // If not one of them carries an average, there's nothing to sort by -- ranking would be
  // arbitrary (effectively "whatever order the API happened to return"), so the caller
  // renders a hint instead of a list in that case.
  const hasAverages = takenQuizzes.some((row) => row.averagePercent !== null)

  // Ascending by average (missing averages sort last, since we can't say how worth
  // reviewing they are); Array#sort is stable, so equal averages keep the API's own unit
  // order rather than being reshuffled.
  const sortedQuizzes = useMemo(() => {
    if (!hasAverages) return []
    return [...takenQuizzes].sort((a, b) => {
      const left = a.averagePercent ?? Infinity
      const right = b.averagePercent ?? Infinity
      return left - right
    })
  }, [takenQuizzes, hasAverages])

  const visibleQuizzes = sortedQuizzes.slice(0, WORTH_REVIEWING_LIMIT)
  const hiddenCount = sortedQuizzes.length - visibleQuizzes.length

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="shadow-sm border border-gray-200 dark:border-border">
        <CardHeader className="px-6 py-4 border-b border-gray-100 dark:border-border bg-white dark:bg-card rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground">{EN.pageTitle}</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">{EN.subtitle}</p>
            </div>

            {quiz && (
              <div className="flex items-center gap-6">
                <div>
                  <p className={STAT_LABEL}>{EN.questions}</p>
                  <p className={STAT_VALUE}>{quiz.question_count}</p>
                </div>
                <div>
                  <p className={STAT_LABEL}>{EN.submitted}</p>
                  <div className="flex items-baseline gap-1">
                    <span className={STAT_VALUE}>{quiz.submitted_count}</span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">/{state.rosterCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="review-course" className={FIELD_LABEL}>{EN.courseLabel}</Label>
              <Select
                value={state.selectedCourseId ? String(state.selectedCourseId) : undefined}
                onValueChange={(value) => actions.selectCourse(Number(value))}
              >
                <SelectTrigger id="review-course"><SelectValue placeholder={EN.selectCourse} /></SelectTrigger>
                <SelectContent>
                  {state.courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>{course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.selectedCourseId && (
              <div className="space-y-1.5">
                <Label htmlFor="review-group" className={FIELD_LABEL}>{EN.groupLabel}</Label>
                <Select
                  value={state.selectedGroupId ? String(state.selectedGroupId) : undefined}
                  onValueChange={(value) => actions.selectGroup(Number(value))}
                >
                  <SelectTrigger id="review-group"><SelectValue placeholder={EN.selectGroup} /></SelectTrigger>
                  <SelectContent>
                    {state.groups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.name} · {EN.students}: {group.studentCount}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {state.units.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="review-unit" className={FIELD_LABEL}>{EN.unitLabel}</Label>
                <Select
                  value={state.selectedLessonId ? String(state.selectedLessonId) : undefined}
                  onValueChange={(value) => actions.selectUnit(Number(value))}
                >
                  <SelectTrigger id="review-unit"><SelectValue placeholder={EN.selectUnit} /></SelectTrigger>
                  <SelectContent>
                    {state.units.map((u) => (
                      <SelectItem key={u.lesson_id} value={String(u.lesson_id)}>
                        {/* completed_count is optional so a launcher pointed at an older
                            backend (no completed_count in the response) still renders the
                            title alone, with no dangling " · " separator. */}
                        {typeof u.completed_count === 'number'
                          ? `${u.title} · ${EN.completed}: ${u.completed_count}/${state.rosterCount}`
                          : u.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {unit && !singleQuizUnit && (
              <div className="space-y-1.5">
                <Label htmlFor="review-quiz" className={FIELD_LABEL}>{EN.quizLabel}</Label>
                <Select
                  value={state.selectedStepId ? String(state.selectedStepId) : undefined}
                  onValueChange={(value) => actions.selectQuiz(Number(value))}
                >
                  <SelectTrigger id="review-quiz"><SelectValue placeholder={EN.selectQuiz} /></SelectTrigger>
                  <SelectContent>
                    {unit.quizzes.map((q) => (
                      <SelectItem key={q.step_id} value={String(q.step_id)}>
                        {q.title} · {EN.submitted}: {q.submitted_count}/{state.rosterCount}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Only claim the course has no quizzes when the load actually SUCCEEDED. Keyed on
              status === 'ready' rather than !busy: on a failed load `units` is empty too, and
              the old condition printed "no unit quizzes yet" beside the error banner — telling
              the teacher something false about their course at the moment we in fact know nothing. */}
          {state.selectedGroupId && state.units.length === 0 && state.status === 'ready' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{EN.noQuizzes}</p>
          )}

          {quiz && quiz.submitted_count === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{EN.noSubmissions}</p>
          )}

          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={actions.start}
            disabled={!canStart}
          >
            {startLabel}
          </Button>
        </CardContent>
      </Card>

      {/* "Which quiz is worth the class's time" is the question a teacher actually has
          before pressing Start -- answer it directly once course+group are picked, instead
          of making them open every unit/quiz dropdown to find out. Gated on status ===
          'ready' for the same reason as the noQuizzes message above: on a failed load
          `units` is stale/empty too, and this list must not claim "nothing taken yet"
          while we in fact don't know. */}
      {state.selectedCourseId && state.selectedGroupId && state.status === 'ready' && (
        <Card className="mt-6 shadow-sm border border-gray-200 dark:border-border">
          <CardHeader className="px-6 py-4 border-b border-gray-100 dark:border-border">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-foreground">
              {EN.worthReviewingTitle}
            </CardTitle>
            {sortedQuizzes.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{EN.worthReviewingSubtitle}</p>
            )}
          </CardHeader>
          <CardContent className="divide-y divide-gray-100 dark:divide-border px-6 py-2">
            {takenQuizzes.length === 0 ? (
              <p className="py-2 text-sm text-gray-500 dark:text-gray-400">{EN.worthReviewingEmpty}</p>
            ) : !hasAverages ? (
              <p className="py-2 text-sm text-gray-500 dark:text-gray-400">{EN.worthReviewingNoAverages}</p>
            ) : (
              <>
                {visibleQuizzes.map((row) => (
                  <button
                    key={`${row.lessonId}-${row.stepId}`}
                    type="button"
                    onClick={() => actions.startQuiz(row.lessonId, row.stepId)}
                    className="flex w-full items-center justify-between gap-4 rounded-sm py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 first:pt-0 last:pb-0 hover:text-gray-900 dark:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background"
                  >
                    <span className="truncate font-medium text-gray-900 dark:text-foreground">
                      {row.unitTitle} · {row.quizTitle}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 tabular-nums text-gray-500 dark:text-gray-400">
                      <span>{format(EN.worthReviewingSubmittedOf, { submitted: row.submittedCount, total: state.rosterCount })}</span>
                      <span>
                        {row.averagePercent !== null
                          ? format(EN.worthReviewingAvgOf, { percent: Math.round(row.averagePercent) })
                          : '—'}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                    </span>
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <p className="pt-2.5 text-sm text-gray-500 dark:text-gray-400">
                    {format(EN.worthReviewingMore, { count: hiddenCount })}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ReviewLauncher
