// The numbers beside the question: how many answered, how many got it right, the answer
// spread, and — when names are on — exactly who is in each bucket, which is what turns a
// statistic into a conversation with the class.
import React from 'react'
import { Card, CardContent } from '../ui/card'
import { ReviewOptionBars } from './ReviewOptionBars'
import { ReviewGapBars } from './ReviewGapBars'
import { isGapType, wholeQuestionRevealed, type QuestionStat } from './reviewStats'
import { EN, format } from './strings'

interface Props {
  stat: QuestionStat | undefined
  revealed: boolean
  showNames: boolean
  /** Which gap of `stat` is under discussion — ignored when the question isn't a gap type. */
  gapIndex: number
}

const STAT_LABEL = 'text-sm font-medium text-muted-foreground'
const STAT_VALUE = 'text-3xl font-bold text-foreground tabular-nums'
const SECTION_HEADING = 'text-sm font-semibold text-foreground'
const CHIP = 'rounded-full border border-border bg-muted dark:bg-secondary px-2 py-0.5 text-xs text-foreground'

const NameList: React.FC<{ title: string; names: string[]; className: string }> = ({
  title, names, className,
}) => {
  if (names.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className={`text-xs font-semibold ${className}`}>{title} · {names.length}</p>
      <div className="flex flex-wrap gap-1.5">
        {names.map((name) => (
          <span key={name} className={CHIP}>{name}</span>
        ))}
      </div>
    </div>
  )
}

export const ReviewStatsPanel: React.FC<Props> = ({ stat, revealed, showNames, gapIndex }) => {
  if (!stat) {
    return (
      <Card><CardContent className="p-4 text-sm text-muted-foreground">{EN.noData}</CardContent></Card>
    )
  }

  // The boxes and name lists below still describe the WHOLE cloze question (a 9-of-10-gap
  // submission is still one "partial" student there) — additive, unchanged by the gap
  // stepper. Only the "Answer distribution" section below switches, per gap, to what that
  // one gap's own answers looked like.
  const isGap = isGapType(stat.questionType)
  const gapStat = isGap ? stat.gaps[gapIndex] : undefined
  // Gates every WHOLE-QUESTION consumer below (percentCorrect, the name lists) — never the
  // per-gap bars, which stay on the raw `revealed` they already use. See wholeQuestionRevealed's
  // own doc comment (reviewStats.ts) for why a bare per-gap `revealed` is not enough here (#F1):
  // a two-gap cloze with names on leaks the second gap's answer through simple elimination once
  // the first gap's whole-question buckets and the second gap's nameless per-gap bars are both
  // on screen, even though neither view alone shows anything.
  const wholeRevealed = wholeQuestionRevealed(isGap, gapIndex, stat.gaps.length, revealed)

  return (
    <Card>
      <CardContent className="space-y-5 p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className={STAT_LABEL}>{EN.answered}</p>
            <p className={STAT_VALUE}>{stat.answered}</p>
          </div>
          <div>
            <p className={STAT_LABEL}>{EN.noAnswer}</p>
            <p className={STAT_VALUE}>{stat.unanswered}</p>
          </div>
          <div>
            <p className={STAT_LABEL}>{EN.percentCorrect}</p>
            <p className={STAT_VALUE}>
              {/* Gated on wholeQuestionRevealed, not the raw per-gap `revealed`: with
                  per-option counts already on screen, a deterministic "% correct" figure for
                  a single/multi-choice question identifies the right option before Reveal
                  just as surely as printing it outright would — and for a cloze this is a
                  WHOLE-QUESTION figure, so gating it on gap 1's own `revealed` would disclose
                  it before the class has even reached the later gaps (#F1). */}
              {!wholeRevealed || stat.percentCorrect === null ? '—' : `${stat.percentCorrect}%`}
            </p>
          </div>
        </div>

        {!stat.graded && (
          <p className="rounded-md border border-border bg-muted dark:bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
            {EN.notGraded}
          </p>
        )}

        {/* Gap questions get a per-gap breakdown instead of the whole-question answer
            distribution below — "the class's answers to this cloze" isn't one distribution,
            it's one per gap, and only the gap currently under discussion is relevant here.
            But `gapStat` is only there when getExpectedAnswers actually located gaps
            (reviewStats.ts's gapCount) — and that count is still > 0 for the correct_answer
            fallback ReviewQuestionView's gapStepHtml falls back to (getExpectedAnswers still
            returns those entries; it's gapStepHtml's own per-token slot marking, not the gap
            count, that comes up empty there — see gapStepHtml's #F3 doc comment). `stat.gaps`
            is empty only when getExpectedAnswers itself returns `[]` — no `[[…]]` token in
            either text field AND no correct_answer — so fall through to the same
            whole-question bars the non-gap branch below uses rather than showing nothing —
            `stat.options` is still computed for every question type regardless of isGap
            (#6). */}
        {isGap && gapStat ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className={SECTION_HEADING}>{EN.gapBreakdown}</p>
              <span className="text-xs text-muted-foreground">
                {format(EN.gapAnsweredOf, { answered: gapStat.answered, participants: gapStat.participants })}
              </span>
            </div>
            <ReviewGapBars gap={gapStat} revealed={revealed} showNames={showNames} />
          </div>
        ) : (
          /* 'none' means this question type (matching, or long_text) deliberately has no
             printable answer distribution — long_text's raw value is a whole essay, which
             must not be projected verbatim with the writer's name attached, and matching's
             is a set of left→right index pairs, not a single printable answer. The
             correct/partial/incorrect split below is the real answer for both, so the
             heading and bars are omitted rather than shown above a "No data" line. */
          stat.distributionKind !== 'none' && (
            <div className="space-y-2">
              <p className={SECTION_HEADING}>{EN.answerDistribution}</p>
              <ReviewOptionBars stat={stat} revealed={revealed} showNames={showNames} />
            </div>
          )
        )}

        {/* Gated on wholeQuestionRevealed as well as `showNames`, not the raw per-gap
            `revealed`: cross-referencing "Correct · 7 — <names>" against the per-option name
            chips identifies the correct option instantly, before the teacher has pressed
            Reveal — and for a cloze these lists are WHOLE-QUESTION buckets (a 9-of-10-gap
            submission is still one "partial" student here), so gap 1's own `revealed` is the
            wrong gate: a two-gap example with three students —
              gap 1 revealed: bars show `cat ✓ 2 — Alice, Bob`, `dog ✗ 1 — Carol`; these lists
              show `Correct: Alice`, `Partial: Bob, Carol`;
              step to gap 2, `revealed` resets: nameless per-gap bars show `sat • 2`, `ran • 1`
            — lets the class work out from the PREVIOUS screen's buckets who was right on gap
            1 (Alice yes, Bob and Carol no), and therefore, by elimination against the gap-2
            counts, which un-named answer is correct on gap 2 — before Reveal. A previous pass
            caught this for percentCorrect above but cleared this block on the mistaken belief
            it shared the same (per-gap) `revealed` as the bars above it (#F1). */}
        {wholeRevealed && showNames && stat.graded && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className={SECTION_HEADING}>{EN.whoAnswered}</p>
            <NameList title={EN.correct} names={stat.names.correct} className="text-emerald-600 dark:text-emerald-400" />
            <NameList title={EN.partial} names={stat.names.partial} className="text-amber-600 dark:text-amber-400" />
            <NameList title={EN.incorrect} names={stat.names.incorrect} className="text-rose-600 dark:text-rose-400" />
            <NameList title={EN.noAnswer} names={stat.names.unanswered} className="text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ReviewStatsPanel
