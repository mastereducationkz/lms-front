// Question overview: one cell per question, filled red -> amber -> green by how much of
// the class got it right, so the teacher can see at a glance which questions are worth the
// class time and jump straight to them. Grey means nobody answered it.
//
// A whole-unit review's deck spans several quiz steps, and cells are grouped into one
// section per step (with the step's own title and submission count as a divider) so
// "question 14" is locatable even once the flat 1..N numbering crosses a step boundary — a
// single-quiz review still carries exactly one step, so that section collapses to today's
// plain grid with no divider shown.
import React from 'react'
import { accuracyBand, questionKey, type QuestionStat } from './reviewStats'
import type { QuestionStepMeta, ReviewStepSummary } from './reviewSessionReducer'
import { EN, format } from './strings'

const BAND_CLASS: Record<string, string> = {
  low: 'bg-rose-500 text-white',
  medium: 'bg-amber-500 text-white',
  high: 'bg-emerald-500 text-white',
  none: 'bg-muted text-muted-foreground',
}

const LEGEND: { band: keyof typeof BAND_CLASS; label: string }[] = [
  { band: 'low', label: '0–49%' },
  { band: 'medium', label: '50–79%' },
  { band: 'high', label: '80–100%' },
  { band: 'none', label: EN.noData },
]

interface Props {
  questions: any[]
  /** Aligned 1:1 with `questions` — questionSteps[i] names the step question[i] came from. */
  questionSteps: QuestionStepMeta[]
  /** One section per quiz step, in deck order. */
  steps: ReviewStepSummary[]
  /** Keyed by the composite questionKey(stepId, question) — see reviewSessionReducer.ts's
   *  statsByKey doc comment for why a raw question id is not safe to key this by. */
  statsByKey: Record<string, QuestionStat>
  rosterCount: number
  currentIndex: number
  onJump: (index: number) => void
}

export const ReviewQuestionGrid: React.FC<Props> = ({
  questions, questionSteps, steps, statsByKey, rosterCount, currentIndex, onJump,
}) => {
  if (questions.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{EN.noData}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{EN.questionList}</p>
      {steps.map((step) => (
        <div key={step.stepId} className="space-y-2">
          {/* A single-quiz review carries exactly one step, and repeating its own title as a
              section header above an already-titled grid would be noise, not a locator —
              only a multi-step (whole-unit) deck needs the divider at all. */}
          {steps.length > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-gray-200 dark:border-border pt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span className="truncate">{step.stepTitle}</span>
              <span className="shrink-0 tabular-nums">
                {format(EN.worthReviewingSubmittedOf, { submitted: step.submittedCount, total: rosterCount })}
              </span>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
            {questions.slice(step.startIndex, step.startIndex + step.questionCount).map((question, offset) => {
              const index = step.startIndex + offset
              const meta = questionSteps[index]
              const stat = meta ? statsByKey[questionKey(meta.stepId, question)] : undefined
              const band = accuracyBand(stat)
              return (
                <button
                  key={`${step.stepId}-${String(question.id)}-${index}`}
                  type="button"
                  onClick={() => onJump(index)}
                  aria-current={index === currentIndex ? 'true' : undefined}
                  aria-label={`${step.stepTitle} — ${format(EN.questionOf, { n: offset + 1, total: step.questionCount })}`}
                  className={`aspect-square rounded-md text-sm font-bold transition-colors ${BAND_CLASS[band]} ${
                    index === currentIndex ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 dark:border-border pt-3">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`h-3 w-3 rounded ${BAND_CLASS[item.band]}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default ReviewQuestionGrid
