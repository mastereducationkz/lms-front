// One row per typed answer for a single gap — the gap-stepper's equivalent of
// ReviewOptionBars, scoped to whichever gap the presenter is currently on. Correctness
// (isCorrect on each row) comes from reviewStats.ts's buildQuestionStats, which in turn
// reads it straight off gradeQuestion's partResults — nothing here re-derives it.
import React from 'react'
import { Check, X } from 'lucide-react'
import type { GapStat } from './reviewStats'
import { EN } from './strings'

interface Props {
  gap: GapStat | undefined
  revealed: boolean
  showNames: boolean
}

const MAX_ROWS = 8
const CHIP = 'rounded-full border border-border bg-muted dark:bg-secondary px-2 py-0.5 text-xs text-muted-foreground'

// Neutral before reveal — visible spread, no verdict — exactly like ReviewOptionBars'
// barClass. Only once revealed does a row turn green/red.
function markClass(isCorrect: boolean, revealed: boolean): string {
  if (!revealed) return 'border-border text-muted-foreground'
  return isCorrect
    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
    : 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
}

function markGlyph(isCorrect: boolean, revealed: boolean): React.ReactNode {
  if (!revealed) return '•'
  const Mark = isCorrect ? Check : X
  return <Mark className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
}

export const ReviewGapBars: React.FC<Props> = ({ gap, revealed, showNames }) => {
  if (!gap) {
    return <p className="text-sm text-muted-foreground">{EN.noData}</p>
  }

  const rows = gap.options.slice(0, MAX_ROWS)
  const hidden = gap.options.length - rows.length

  return (
    <div className="space-y-1.5">
      {rows.map((option) => (
        <div key={option.key} className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${markClass(option.isCorrect, revealed)}`}
              aria-hidden="true"
            >
              {markGlyph(option.isCorrect, revealed)}
            </span>
            <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{option.count}</span>
            <span className="flex-1 break-words text-foreground">{option.text}</span>
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{option.percent}%</span>
          </div>
          {revealed && showNames && option.names.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-7">
              {option.names.map((name) => (
                <span key={name} className={CHIP}>{name}</span>
              ))}
            </div>
          )}
        </div>
      ))}

      {hidden > 0 && (
        <p className="pl-7 text-xs text-muted-foreground">{EN.otherAnswers}: {hidden}</p>
      )}

      {gap.unanswered > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold text-muted-foreground" aria-hidden="true">
              —
            </span>
            <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{gap.unanswered}</span>
            <span className="flex-1 text-muted-foreground">{EN.gapNoAnswer}</span>
          </div>
          {revealed && showNames && gap.names.unanswered.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-7">
              {gap.names.unanswered.map((name) => (
                <span key={name} className={CHIP}>{name}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ReviewGapBars
