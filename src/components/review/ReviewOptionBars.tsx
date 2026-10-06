// One row per answer: a filled bar sized by how much of the class chose it. Choice
// questions get a fixed row per option (so an option nobody picked still shows as empty,
// which is itself information); free-text questions get the answers students actually
// typed, most common first.
import React from 'react'
import { renderTextWithLatex } from '../../utils/latex'
import type { OptionStat, QuestionStat } from './reviewStats'
import { EN } from './strings'

interface Props {
  stat: QuestionStat | undefined
  revealed: boolean
  showNames: boolean
}

const MAX_TEXT_ROWS = 8
const CHIP = 'rounded-full border border-border bg-muted dark:bg-secondary px-2 py-0.5 text-xs text-muted-foreground'

function barClass(option: OptionStat, revealed: boolean): string {
  if (revealed && option.isCorrect) return 'bg-emerald-500/70'
  if (revealed && option.count > 0) return 'bg-rose-500/50'
  return 'bg-muted-foreground/30'
}

export const ReviewOptionBars: React.FC<Props> = ({ stat, revealed, showNames }) => {
  if (!stat || stat.options.length === 0) {
    return <p className="text-sm text-muted-foreground">{EN.noData}</p>
  }

  const rows = stat.distributionKind === 'text'
    ? stat.options.slice(0, MAX_TEXT_ROWS)
    : stat.options
  const hidden = stat.options.length - rows.length

  return (
    <div className="space-y-2">
      {rows.map((option) => (
        <div key={option.key} className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-foreground">
            {option.label && (
              <span className="w-6 shrink-0 font-semibold text-foreground">{option.label}</span>
            )}
            {/* 'choice' rows are the question's own authored option text — safe to render as
                HTML via renderTextWithLatex/dangerouslySetInnerHTML, same as ChoiceQuestion.
                'text' rows are NOT: they are strings students typed into an answer box. This
                repo's renderMarkdown deliberately preserves raw HTML tags and there is no
                sanitizer, so piping student input through dangerouslySetInnerHTML here would
                let a student's <img onerror=…> execute in the teacher's session on the class
                projector. Free text always renders as a plain JSX child instead. */}
            {option.text
              ? (stat.distributionKind === 'choice'
                  ? <span className="flex-1 break-words" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(option.text) }} />
                  : <span className="flex-1 break-words">{option.text}</span>)
              : <span className="flex-1 text-muted-foreground">—</span>}
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
              {option.count} · {option.percent}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${barClass(option, revealed)}`}
              style={{ width: `${Math.min(option.percent, 100)}%` }}
            />
          </div>
          {revealed && showNames && option.names.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {option.names.map((name) => (
                <span key={name} className={CHIP}>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {hidden > 0 && (
        <p className="text-xs text-muted-foreground">{EN.otherAnswers}: {hidden}</p>
      )}
    </div>
  )
}

export default ReviewOptionBars
