// Route root for review mode. Owns nothing but the phase switch — all state and every
// network call live in useReviewSession.
import React from 'react'
import { ReviewLauncher } from '../../components/review/ReviewLauncher'
import { ReviewPresenter } from '../../components/review/ReviewPresenter'
import { ReviewSummary } from '../../components/review/ReviewSummary'
import { useReviewSession } from '../../components/review/useReviewSession'
import { EN } from '../../components/review/strings'
import { Button } from '../../components/ui/button'

const QuizReviewPage: React.FC = () => {
  const [state, actions] = useReviewSession()

  const retry = () => {
    // A unit selection alone is enough for actions.start() to do the right thing (single
    // quiz or whole unit) — see useReviewSession's start(), so retrying a failed start no
    // longer requires a quiz to have been explicitly chosen too.
    if ((state.selectedStepId || state.selectedLessonId) && state.selectedGroupId) actions.start()
    // A failed quizzes-load happens with a group already selected but no quiz chosen yet.
    // Falling through to selectCourse here would reset selectedGroupId and refetch the
    // group list instead of retrying the quiz list for the group the teacher already
    // picked.
    else if (state.selectedGroupId) actions.selectGroup(state.selectedGroupId)
    else if (state.selectedCourseId) actions.selectCourse(state.selectedCourseId)
    else actions.loadCourses()
  }

  return (
    <div className="p-6 space-y-4">
      {state.status === 'error' && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          <span className="flex-1">{state.error || EN.loadError}</span>
          <Button variant="outline" size="sm" onClick={retry}>{EN.retry}</Button>
        </div>
      )}

      {state.phase === 'summary' && (
        <ReviewSummary
          summary={state.summary}
          namesVisible={state.namesVisible}
          onRestart={actions.restart}
          onExit={actions.exit}
        />
      )}
      {state.phase === 'presenting' && <ReviewPresenter state={state} actions={actions} />}
      {state.phase === 'launcher' && <ReviewLauncher state={state} actions={actions} />}
    </div>
  )
}

export default QuizReviewPage
