// The question as the class sees it. Options are rendered here rather than through
// ChoiceQuestion because this view has no "selected" state to show — what it marks is the
// key (once revealed), and the bars beside it carry the class's answers.
import React from 'react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { renderTextWithLatex } from '../../utils/latex'
import { getExpectedAnswers, getGapSourceText } from '../lesson/quiz/scoring'
import { EN, format, questionTypeLabel } from './strings'
import {
  blankHeading,
  displayText,
  GAP_TOKEN_SOURCE,
  isCorrectOption,
  isGapType,
  LETTERS,
  splitPipeAnswers,
  wholeQuestionRevealed,
  fillBlankTokenOptions,
  type QuestionStat,
} from './reviewStats'

interface Props {
  question: any
  stat: QuestionStat | undefined
  revealed: boolean
  statsVisible: boolean
  /** Which gap is under discussion right now — ignored for non-gap question types. */
  gapIndex: number
  onPrevGap: () => void
  onNextGap: () => void
}

const PIPE_ANSWER_TYPES = new Set(['short_answer', 'media_open_question'])

/** Display-only comparison for marking which offered choice is the key once revealed.
 *  The verdict a student got still comes from gradeQuestion -- this only decides styling. */
const normalizeChoice = (v: unknown): string => (v ?? '').toString().trim().toLowerCase()

const BADGE = 'rounded-md border border-gray-200 dark:border-border px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400'

function escapeGapText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const GAP_FILLED_CLASS =
  'rounded px-1 py-0.5 mx-0.5 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 font-medium'
const GAP_CURRENT_CLASS =
  'rounded px-1.5 py-0.5 mx-0.5 border-2 border-dashed border-amber-500 dark:border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100 font-semibold'
const GAP_CURRENT_REVEALED_CLASS =
  'rounded px-1.5 py-0.5 mx-0.5 border-2 border-emerald-500 dark:border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100 font-semibold'
const GAP_UPCOMING_CLASS = 'text-gray-400 dark:text-gray-500'

// scoring.ts's getExpectedAnswers locates tokens with `/\[\[(.*?)\]\]/g` — no `[\s\S]`, so a
// token whose contents span a newline is invisible to it (see reviewStats.ts's GAP_TOKEN_SOURCE
// doc comment). Anchored so it is applied to one already-broad-matched span at a time (below),
// not used to scan raw text itself — this only ever answers "would the narrow tokenizer also
// treat this exact span as one token", never re-locates tokens on its own.
const NARROW_GAP_TOKEN = /^\[\[(.*?)\]\]$/

export interface GapStepResult {
  html: string
  /**
   * How many `[[…]]` tokens in `text` actually got assigned a gap slot — i.e. how many times
   * the narrow re-check below passed. This is the one authoritative count of what's actually
   * steppable/fillable in THIS render; see #F3 for why callers must use this instead of
   * re-deriving "is there anything fillable here" from a second, independently-computed
   * regex test (the old `gapHasLocatableToken`) or from getExpectedAnswers's own count (the
   * old `gapTotal` used for "Gap N of M") — those two numbers come from two different
   * regexes and can disagree with what this function actually marks up (see the doc comment
   * below), which made Reveal a dead no-op in exactly the shapes that disagreement produces.
   */
  slotCount: number
}

/**
 * Renders one gap-question passage/heading for the step-through-one-gap-at-a-time view:
 * gaps already stepped past (index < gapIndex) print their expected answer — the teacher
 * has moved on, there is nothing left to hide there; the current gap prints the blank
 * placeholder until `revealed`, then its expected answer, visually marked either way; every
 * later gap always prints the placeholder.
 *
 * Reuses reviewStats.ts's GAP_TOKEN_SOURCE — the exact pattern blankGapText uses to blank
 * every gap — to locate token boundaries. An unterminated `[[` (no matching `]]` anywhere
 * after it) is invisible to this pattern and renders raw, asterisked key included — that is
 * a real, pre-existing gap, but it is shared byte-for-byte with blankGapText, so a student
 * looking at their own screen already sees the exact same raw text; this file does not widen
 * the leak, and fixing it is out of scope here. Given a properly `]]`-terminated token,
 * though, every one is blanked. GAP_TOKEN_SOURCE is broader than getExpectedAnswers's own
 * tokenizer (scoring.ts's `.*?`, no `[\s\S]`), though: a token whose contents span a newline
 * matches here but not there. Only a broad match that the
 * narrow pattern (NARROW_GAP_TOKEN, checked against the matched span itself) would ALSO
 * recognise gets an index into `expected` and advances the gap counter — a broad-only match
 * renders an unconditional, un-fillable blank instead. Without this check the two patterns'
 * token counts can disagree, and every index past the mismatch drifts out of alignment with
 * `expected[]` — including the CURRENT (unrevealed) gap's own answer bleeding into an already-
 * "answered" slot (C2). The expected answer for each position still comes from
 * getExpectedAnswers (scoring.ts), the only place that decides what the correct option is —
 * this function only decides which token gets which position. `expected` values are
 * quiz-authored content already rendered elsewhere via dangerouslySetInnerHTML (same trust
 * level as the rest of the passage), but are HTML-escaped here since — unlike the old flat
 * "Correct answer: …" list — they are now spliced into the middle of an HTML string.
 */
export function gapStepHtml(text: string, gapIndex: number, expected: string[], revealed: boolean): GapStepResult {
  let gapPosition = 0
  const html = text.replace(new RegExp(GAP_TOKEN_SOURCE, 'g'), (match) => {
    if (!NARROW_GAP_TOKEN.test(match)) {
      // Not a token getExpectedAnswers would recognise either (same newline mismatch) — blank
      // it so nothing raw reaches the projector, but never assign it a gap slot.
      return `<span class="${GAP_UPCOMING_CLASS}">____</span>`
    }
    const index = gapPosition
    gapPosition += 1
    if (index < gapIndex) {
      return `<span class="${GAP_FILLED_CLASS}">${escapeGapText(expected[index] || '____')}</span>`
    }
    if (index === gapIndex) {
      return revealed
        ? `<span class="${GAP_CURRENT_REVEALED_CLASS}">${escapeGapText(expected[index] || '____')}</span>`
        : `<span class="${GAP_CURRENT_CLASS}">____</span>`
    }
    return `<span class="${GAP_UPCOMING_CLASS}">____</span>`
  })
  return { html, slotCount: gapPosition }
}

export const ReviewQuestionView: React.FC<Props> = ({
  question, stat, revealed, statsVisible, gapIndex, onPrevGap, onNextGap,
}) => {
  if (!question) {
    return <Card><CardContent className="p-6 text-sm text-gray-500 dark:text-gray-400">{EN.noData}</CardContent></Card>
  }

  const isGap = isGapType(question.question_type)
  // Gap questions store their key IN the content, with the correct option inside each
  // [[…]] token marked by `*` (see gapParser.ts). That syntax isn't confined to content_text
  // — some quizzes carry it in question_text instead (scoring.ts's getExpectedAnswers and
  // QuizRenderer.tsx's student-facing renderer both check either field for exactly this
  // reason) — so BOTH the passage below and the heading further down must have their
  // tokens blanked. Neither must ever be shown raw: the answer key would be visible the
  // instant the question appears, before Reveal. The passage goes through displayText
  // (gated by isGapType, matching content_text's own gate on the student side); the heading
  // goes through blankHeading instead (unconditional, matching QuizRenderer.tsx's
  // question_text handling) — see blankHeading's doc comment for why they differ. Neither
  // helper parses the tokens for correctness — getExpectedAnswers (scoring.ts) stays the
  // only place that decides what the accepted answers are.
  const passage = question.content_text
  const options: any[] = Array.isArray(question.options) ? question.options : []

  // The gap stepper renders one field at a time, one gap at a time — see gapStepHtml above.
  // getGapSourceText mirrors getExpectedAnswers's own content_text-then-question_text
  // resolution exactly, so the stepper and the answer key can never disagree about where
  // the gaps actually are.
  const gapExpected = isGap ? getExpectedAnswers(question) : []
  const gapSource = isGap ? getGapSourceText(question) : ''
  // The answer key's own count — how many gaps this question has according to
  // getExpectedAnswers, independent of whether gapStepHtml below can actually mark all of
  // them up in the passage. This is what wholeQuestionRevealed needs (the same semantic
  // ReviewStatsPanel's `stat.gaps.length` uses): "has the class reached the LAST gap",
  // defined by the answer key, not by rendering quirks.
  const gapTotal = gapExpected.length
  // The rare fallback case: no content_text at all, so the gaps live in question_text
  // itself. The heading below would then just be a second, fully-blanked copy of the exact
  // same text the stepped passage panel already renders — suppress it rather than show the
  // same cloze twice, once inert and once steppable.
  const gapInHeadingOnly = isGap && !question.content_text && !!question.question_text

  // Computed once and reused below for both the passage markup and everything that needs to
  // know how many gaps are actually fillable in THIS render (#F3). Previously this was two
  // independently-computed regex checks — a broad `.test()` for "is anything locatable" and
  // getExpectedAnswers's own narrow-regex count for "Gap N of M" — which could disagree with
  // what gapStepHtml actually marks up: a source whose only tokens span newlines reads as
  // "locatable" under the broad test with zero slots actually assigned, and a narrow token
  // that a broad-only match swallows (an unterminated `[[` eating past a real token's own
  // `]]`) makes `getExpectedAnswers`'s count exceed what gapStepHtml can mark. Both left
  // Reveal a dead no-op with no leak, just a broken affordance. `gapStep.slotCount` is the
  // one number gapStepHtml itself produces while doing the real per-token narrow re-check
  // (see its doc comment) — use that instead of re-deriving the same fact twice.
  const gapStep = isGap ? gapStepHtml(gapSource, gapIndex, gapExpected, revealed) : null
  const gapSlotTotal = gapStep ? gapStep.slotCount : 0

  // fill_blank only: the options this gap offered. text_completion is a free-text input,
  // so it has no choice list and fillBlankTokenOptions returns null for it.
  const gapChoices = isGap ? fillBlankTokenOptions(question, gapIndex) : null

  // What Reveal shows for questions with no option list of their own.
  let revealAnswers: string[] = []
  if (isGap) {
    // Gap questions no longer dump every expected answer here — Reveal now fills only the
    // current gap, inline in the passage above (gapStepHtml). Populating this too would
    // reintroduce the "Reveal shows everything at once" problem the gap stepper exists to
    // fix (C1's failure mode). The one exception is the correct_answer-fallback case above:
    // gapStepHtml has no token to fill there (gapSlotTotal === 0), so nothing in the passage
    // will ever change on Reveal unless this flat line does the job instead — scoped to just
    // the CURRENT gap, never the whole list, so it doesn't reopen the same problem for this
    // path.
    if (gapSlotTotal === 0 && gapExpected[gapIndex] !== undefined) {
      revealAnswers = [gapExpected[gapIndex]]
    }
  } else if (PIPE_ANSWER_TYPES.has(question.question_type)) {
    // short_answer / media_open_question store several accepted answers pipe-separated;
    // gradeQuestion splits on the same character to grade. Showing that split instead of
    // the raw "paris|Paris|the capital" string is presentation only — the accepted-answer
    // set itself still comes from the same field gradeQuestion reads.
    revealAnswers = splitPipeAnswers(question)
  } else if (question.correct_answer != null) {
    revealAnswers = Array.isArray(question.correct_answer)
      ? question.correct_answer.map((a: any) => String(a))
      : [String(question.correct_answer)]
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          <span className={BADGE}>{questionTypeLabel(question.question_type)}</span>
          {question.difficulty && (
            <span className={BADGE}>{question.difficulty}</span>
          )}
        </div>

        {/* renderTextWithLatex returns an HTML string (KaTeX + markdown), so every use of it
            goes through dangerouslySetInnerHTML — the same way ChoiceQuestion uses it. This
            content is always author-authored (the question source, or its blanked/stepped
            form for gap questions), never something a student typed — see ReviewOptionBars
            for the one place that distinction matters. */}
        {isGap
          ? gapSource && (
              <div
                className="rounded-lg border-l-4 border-gray-300 dark:border-border bg-gray-50 dark:bg-secondary p-4 text-base leading-relaxed text-gray-700 dark:text-gray-300"
                dangerouslySetInnerHTML={{
                  __html: renderTextWithLatex(gapStep!.html),
                }}
              />
            )
          : passage && (
              <div
                className="rounded-lg border-l-4 border-gray-300 dark:border-border bg-gray-50 dark:bg-secondary p-4 text-base leading-relaxed text-gray-700 dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: renderTextWithLatex(displayText(question.question_type, passage)) }}
              />
            )}

        {/* Gated on gapSlotTotal (gapStepHtml's own actual slot count), not gapTotal
            (getExpectedAnswers's count) — see gapStep's doc comment above (#F3): the two can
            disagree, and showing "Gap 1 of 2" with working-looking Prev/Next while the
            passage only ever marks up 1 of those 2 is a broken affordance the class would
            notice even though nothing leaks. */}
        {isGap && gapSlotTotal > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 dark:border-border bg-gray-50 dark:bg-secondary px-3 py-2 text-sm">
            <span className="font-semibold text-gray-900 dark:text-foreground">
              {format(EN.gapOf, { n: gapIndex + 1, total: gapSlotTotal })}
            </span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevGap}
              disabled={gapIndex <= 0}
            >
              {EN.gapPrev}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextGap}
              disabled={gapIndex >= gapSlotTotal - 1}
            >
              {EN.gapNext}
            </Button>
          </div>
        )}

        {/* The choices a fill_blank gap offered. These belong to the QUESTION, not to the
            statistics: a choice question lists its options in this card, and a fill_blank
            gap renders as a select of exactly these (FillInBlankRenderer). They used to
            live only inside ReviewGapBars -- i.e. inside the stats panel -- so pressing
            "Hide stats" made them vanish and a teacher could not simply see what the class
            was choosing between. Shown regardless of statsVisible, with no counts; which
            one is the key stays gated on reveal, like everywhere else. */}
        {isGap && gapChoices && gapChoices.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-gray-500 dark:text-gray-400">{EN.gapChoices}:</span>
            {gapChoices.map((choice, i) => {
              const isKey = revealed && normalizeChoice(choice) === normalizeChoice(gapExpected[gapIndex])
              return (
                <span
                  key={`${i}-${choice}`}
                  className={`rounded-full border px-2.5 py-0.5 ${
                    isKey
                      ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'border-gray-200 bg-white text-gray-700 dark:border-border dark:bg-card dark:text-gray-300'
                  }`}
                >
                  {choice}
                </span>
              )
            })}
          </div>
        )}

        {question.media_url && (
          <img src={question.media_url} alt="" className="max-h-72 rounded-lg object-contain" />
        )}

        {/* Same leak this component's passage above already guards against (see the comment
            on `isGap`): a gap question can carry its [[…*…]] tokens in question_text instead
            of content_text, so this heading needs blanking too — a raw question_text here is
            exactly what let the answer key reach the projector while students' own screens
            (QuizRenderer.tsx) already hid it. Unlike the passage above, this goes through
            blankHeading rather than displayText: question_text can carry gap syntax even
            when question_type ISN'T a gap type (an importer conversion, a mistyped slug, a
            short_answer authored from a cloze), and QuizRenderer.tsx's student-facing
            renderer strips question_text unconditionally, not gated by type — so this must
            match that, not displayText's isGapType gate. */}
        {!gapInHeadingOnly && (
          <h2
            className="text-2xl font-semibold leading-snug text-gray-900 dark:text-foreground"
            dangerouslySetInnerHTML={{ __html: renderTextWithLatex(blankHeading(question.question_text)) }}
          />
        )}

        {options.length > 0 && (
          <div className="space-y-2">
            {options.map((option: any, index: number) => {
              const correct = revealed && isCorrectOption(question, index)
              const count = stat?.options.find((o) => o.key === String(index))?.count ?? 0
              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 rounded-lg border-2 p-3 ${
                    correct
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-border'
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 dark:border-border text-sm font-bold text-gray-700 dark:text-gray-200">
                    {option?.letter || LETTERS[index] || index + 1}
                  </span>
                  <span
                    className="flex-1 text-sm text-gray-700 dark:text-gray-300"
                    dangerouslySetInnerHTML={{ __html: renderTextWithLatex(String(option?.text ?? '')) }}
                  />
                  {statsVisible && (
                    <span className="shrink-0 text-sm tabular-nums text-gray-500 dark:text-gray-400">{count}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {revealed && options.length === 0 && revealAnswers.length > 0 && (
          <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-foreground">{EN.correctAnswer}: </span>
            {revealAnswers.join(', ')}
          </p>
        )}

        {/* `revealed` is per-GAP now (see the semantic shift documented on gapStepHtml
            above), but `explanation` is whole-question, authored content (QuizLessonEditor.tsx
            has a dedicated tab for it, and the AI importer auto-populates it) — an
            AI-authored explanation for a cloze routinely enumerates every blank by number
            ("1. cat 2. mat 3. door …"). Gating this on the FIRST gap's reveal would dump every
            answer on the projector at gap 1 of N (C1). wholeQuestionRevealed (reviewStats.ts)
            is this exact check, extracted so ReviewStatsPanel's whole-question consumers
            (percentCorrect, the name lists) can share it instead of re-deriving it and getting
            it wrong (#F1) — and its `gapTotal === 0` clause is what keeps a zero-gap gap
            question's explanation reachable at all, instead of gating on `gapIndex === -1`
            (#F2). The next `revealed &&` added to this file should stop and ask which meaning
            it needs — this file has both. */}
        {wholeQuestionRevealed(isGap, gapIndex, gapTotal, revealed) && question.explanation && (
          <div className="rounded-lg border border-gray-200 dark:border-border bg-gray-50 dark:bg-secondary p-3 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-foreground">{EN.explanation}: </span>
            <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex(String(question.explanation)) }} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ReviewQuestionView
