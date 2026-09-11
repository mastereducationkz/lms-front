// Presenter shell: toolbar, keyboard handling, and the question <-> stats layout. Holds no
// data of its own — everything comes from the session state.
import React, { useEffect } from 'react'
import { Button } from '../ui/button'
import { ReviewQuestionView } from './ReviewQuestionView'
import { ReviewQuestionGrid } from './ReviewQuestionGrid'
import { ReviewStatsPanel } from './ReviewStatsPanel'
import { isGapType, questionKey } from './reviewStats'
import { EN, format } from './strings'
import type { ReviewSessionActions, ReviewSessionState } from './useReviewSession'

interface Props {
  state: ReviewSessionState
  actions: ReviewSessionActions
}

const BADGE = 'rounded-md border border-gray-200 dark:border-border px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400'

export const ReviewPresenter: React.FC<Props> = ({ state, actions }) => {
  const total = state.questions.length
  const question = total > 0 ? state.questions[state.index] : null
  // Current step's meta, aligned 1:1 with `questions` by position (see QuestionStepMeta) —
  // used only to know WHICH step's stat to look up; the lookup itself still goes through the
  // composite key, never `String(question.id)` alone (that collides across a unit's steps —
  // see questionKey's doc comment in reviewStats.ts).
  const currentStepMeta = total > 0 ? state.questionSteps[state.index] : undefined
  const stat = question && currentStepMeta
    ? state.statsByKey[questionKey(currentStepMeta.stepId, question)]
    : undefined
  const isGapQuestion = question ? isGapType(question.question_type) : false

  // Matched on `event.code`, not `event.key`: teachers here run a Russian keyboard layout,
  // where R reports key === 'к'. `code === 'KeyR'` is layout-proof.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      switch (e.code) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault(); actions.next(); break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault(); actions.prev(); break
        // R always reveals — it's the headline shortcut (see EN.keyboardHint) and, unlike
        // Enter/NumpadEnter below, is never a button's native activation key, so a focused
        // toolbar button (left focused after a mouse click, e.g. in Chrome) must not
        // swallow it.
        case 'KeyR':
          e.preventDefault(); actions.toggleReveal(); break
        // Enter/NumpadEnter also toggle reveal, but ONLY when focus is not on a button: a
        // focused toolbar button's native response to Enter is to click it, which already
        // calls the right handler. Swallowing Enter here unconditionally (as before) would
        // fire the click AND toggleReveal for the reveal button, and — worse — silently kill
        // Enter-activation for every OTHER toolbar button too, since the event never reached
        // the browser's default handling.
        case 'Enter':
        case 'NumpadEnter':
          if (target && target.tagName === 'BUTTON') break
          e.preventDefault(); actions.toggleReveal(); break
        case 'KeyS':
          actions.toggleStats(); break
        // Mirrors the toolbar button's disabled state: names only render once revealed,
        // so toggling here before Reveal would be the same silent no-op.
        case 'KeyN':
          if (state.revealed) actions.toggleNames()
          break
        case 'KeyG':
          actions.toggleGrid(); break
        // Gap navigation gets its own keys, never ArrowLeft/ArrowRight above — those must
        // keep meaning "next/previous question" everywhere in the presenter. [ and ] are
        // unused by every other shortcut here (see EN.keyboardHint) and only do anything
        // when the current question actually has gaps to step through.
        case 'BracketRight':
          if (isGapQuestion) { e.preventDefault(); actions.nextGap() }
          break
        case 'BracketLeft':
          if (isGapQuestion) { e.preventDefault(); actions.prevGap() }
          break
        case 'Escape':
          if (state.gridOpen) actions.closeGrid()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, state.gridOpen, state.revealed, isGapQuestion])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-gray-900 dark:text-foreground">
          {total > 0 ? format(EN.questionOf, { n: state.index + 1, total }) : EN.noData}
        </span>
        {/* Reads the CURRENT question's step, not a fixed step from the start of the
            session: a whole-unit deck crosses step boundaries as the teacher advances, and
            this badge must track that, exactly as it already tracked the single step it used
            to be pinned to. */}
        {state.unitTitle && currentStepMeta && (
          <span className={BADGE}>
            {state.unitTitle} · {currentStepMeta.stepTitle}
          </span>
        )}
        <span className={BADGE}>
          {/* Distinct students who submitted anything in the deck — NOT state.attempts.length,
              which counts attempt ROWS and would double-count a student across a multi-step
              unit review the moment they submitted more than one of its quizzes. */}
          {EN.submitted}: {state.submittedCount}/{state.roster.length}
        </span>

        <div className="flex-1" />

        <Button variant={state.revealed ? 'default' : 'outline'} size="sm" onClick={actions.toggleReveal}>
          {state.revealed ? EN.hideAnswer : EN.revealAnswer}
        </Button>
        <Button variant="outline" size="sm" onClick={actions.toggleStats}>
          {state.statsVisible ? EN.hideStats : EN.showStats}
        </Button>
        {/* Names are gated on `revealed` (see ReviewStatsPanel): "Correct · 7 — <names>"
            beside the distribution bars hands the class the answer before Reveal. Toggling
            this pre-reveal therefore changed the label and nothing else, which reads as a
            broken button. Disable it until Reveal and say why, rather than silently no-op. */}
        <Button
          variant="outline"
          size="sm"
          onClick={actions.toggleNames}
          disabled={!state.revealed}
          title={state.revealed ? undefined : EN.namesAfterReveal}
        >
          {state.namesVisible ? EN.hideNames : EN.showNames}
        </Button>
        <Button variant="outline" size="sm" onClick={actions.toggleGrid}>{EN.questionList}</Button>
        <Button variant="outline" size="sm" onClick={actions.finish}>{EN.finish}</Button>
        <Button variant="ghost" size="sm" onClick={actions.exit}>{EN.exit}</Button>
      </div>

      <div className={`grid gap-4 ${state.statsVisible ? 'lg:grid-cols-[1.35fr_1fr]' : 'grid-cols-1'}`}>
        <ReviewQuestionView
          question={question}
          stat={stat}
          revealed={state.revealed}
          statsVisible={state.statsVisible}
          gapIndex={state.gapIndex}
          onPrevGap={actions.prevGap}
          onNextGap={actions.nextGap}
        />
        {state.statsVisible && (
          <ReviewStatsPanel
            stat={stat}
            revealed={state.revealed}
            showNames={state.namesVisible}
            gapIndex={state.gapIndex}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={actions.prev} disabled={state.index <= 0}>{EN.prev}</Button>
        <Button variant="outline" onClick={actions.next} disabled={state.index >= total - 1}>{EN.next}</Button>
        <div className="flex-1" />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isGapQuestion ? EN.keyboardHintGap : EN.keyboardHint}
        </span>
      </div>

      {state.gridOpen && (
        <div className="rounded-lg border border-gray-200 dark:border-border p-4">
          <ReviewQuestionGrid
            questions={state.questions}
            questionSteps={state.questionSteps}
            steps={state.steps}
            statsByKey={state.statsByKey}
            rosterCount={state.roster.length}
            currentIndex={state.index}
            onJump={(index) => { actions.jumpTo(index); actions.closeGrid() }}
          />
        </div>
      )}
    </div>
  )
}

export default ReviewPresenter
