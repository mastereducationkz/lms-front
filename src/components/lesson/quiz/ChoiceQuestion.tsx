import React from 'react'
import { renderTextWithLatex } from '../../../utils/latex'

interface ChoiceQuestionProps {
  question: any
  value: number | number[] | undefined
  onChange: (value: number | number[]) => void
  disabled?: boolean
  showResult?: boolean
  crossedOut?: Set<number>
  onCrossOut?: (optionIndex: number) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export const ChoiceQuestion: React.FC<ChoiceQuestionProps> = ({
  question,
  value,
  onChange,
  disabled,
  showResult,
  crossedOut,
  onCrossOut,
}) => {
  const isMultiple = question.question_type === 'multiple_choice'

  const isSelected = (i: number) =>
    isMultiple ? Array.isArray(value) && value.includes(i) : value === i

  const isCorrectOption = (i: number) =>
    question.question_type === 'multiple_choice'
      ? Array.isArray(question.correct_answer) && question.correct_answer.includes(i)
      : i === question.correct_answer

  const isCrossedOut = (i: number) =>
    !showResult && (crossedOut?.has(i) ?? false)

  const handleOptionClick = (i: number) => {
    if (disabled) return
    // If crossed out — clicking selects and un-crosses
    if (isCrossedOut(i)) {
      onCrossOut?.(i) // un-cross
    }
    if (isMultiple) {
      const cur = Array.isArray(value) ? value : typeof value === 'number' ? [value] : []
      const next = cur.includes(i)
        ? cur.filter((x) => x !== i)
        : [...cur, i].sort((a, b) => a - b)
      onChange(next)
    } else {
      onChange(i)
    }
  }

  const handleEliminateClick = (e: React.MouseEvent, i: number) => {
    e.stopPropagation()
    if (!onCrossOut) return
    onCrossOut(i)
    // If the option was selected and we're crossing it out, deselect it
    if (isSelected(i) && !isCrossedOut(i)) {
      if (isMultiple) {
        const cur = Array.isArray(value) ? value : []
        onChange(cur.filter((x) => x !== i))
      } else {
        onChange(-1)
      }
    }
  }

  return (
    <div className="space-y-2.5">
      {question.options?.map((option: any, i: number) => {
        const selected = isSelected(i)
        const correct = isCorrectOption(i)
        const crossed = isCrossedOut(i)
        const letter = option.letter || LETTERS[i] || String(i + 1)

        // Main button styles
        let borderClass = 'border-2 '
        if (crossed) {
          borderClass += 'border-border bg-background'
        } else if (showResult) {
          borderClass += selected
            ? correct
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-red-400 bg-red-50 dark:bg-red-900/20'
            : correct && isMultiple
              ? 'border-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/15'
              : 'border-border bg-background'
        } else {
          borderClass += selected
            ? 'border-foreground dark:border-foreground bg-background'
            : 'border-border bg-background hover:border-foreground/50'
        }

        // Letter badge in main button
        let badgeClass =
          'w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold flex-shrink-0 '
        if (crossed) {
          badgeClass += 'border-muted-foreground/40 text-muted-foreground/40'
        } else if (showResult) {
          badgeClass += selected
            ? correct
              ? 'border-green-500 text-green-700 dark:text-green-400'
              : 'border-red-400 text-red-600 dark:text-red-400'
            : correct && isMultiple
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
              : 'border-muted-foreground text-muted-foreground'
        } else {
          badgeClass += selected
            ? 'border-foreground text-foreground'
            : 'border-muted-foreground text-muted-foreground'
        }

        return (
          <div key={option.id ?? i} className="flex items-center gap-2">
            {/* Main option button */}
            <button
              type="button"
              onClick={() => handleOptionClick(i)}
              disabled={disabled}
              className={`flex-1 text-left px-4 py-3 rounded-xl transition-all duration-150 ${borderClass}`}
            >
              <div className="flex items-center gap-3">
                {/* Letter badge */}
                <span className={badgeClass}>{letter}</span>

                <div className="flex-1">
                  {option.text && (
                    <span
                      className={`text-base block ${
                        crossed
                          ? 'line-through text-muted-foreground/50'
                          : showResult
                            ? selected
                              ? correct
                                ? 'text-green-800 dark:text-green-300'
                                : 'text-red-800 dark:text-red-300'
                              : correct && isMultiple
                                ? 'text-emerald-900 dark:text-emerald-200'
                                : 'text-foreground/70'
                            : 'text-foreground'
                      }`}
                      dangerouslySetInnerHTML={{ __html: renderTextWithLatex(option.text) }}
                    />
                  )}

                  {option.image_url && (
                    <img
                      src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + option.image_url}
                      alt={`Option ${letter}`}
                      className={`mt-2 max-h-96 rounded border border-border ${crossed ? 'opacity-30' : ''}`}
                    />
                  )}
                </div>
              </div>
            </button>

            {/* SAT-style elimination button — always visible on right */}
            {!disabled && !showResult && onCrossOut && (
              <button
                type="button"
                onClick={(e) => handleEliminateClick(e, i)}
                aria-label={crossed ? `Restore option ${letter}` : `Eliminate option ${letter}`}
                title={crossed ? 'Click to restore' : 'Click to eliminate'}
                className={[
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 relative',
                  crossed
                    ? 'border-foreground/70 text-foreground/70 hover:border-foreground'
                    : 'border-muted-foreground/35 text-muted-foreground/35 hover:border-muted-foreground/70 hover:text-muted-foreground/70',
                ].join(' ')}
              >
                <span className={`text-[11px] font-bold leading-none select-none`}>
                  {letter}
                </span>
                {/* Horizontal strikethrough line */}
                {crossed && (
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                    <span className="block w-[18px] h-[1.5px] bg-current rounded-full" />
                  </span>
                )}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
