// Finish screen: how the group did overall, who is at each end, which questions cost them
// the most, and who never submitted.
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { EN, format } from './strings'
import type { ClassSummary, StudentScore } from './reviewStats'

interface Props {
  summary: ClassSummary | null
  namesVisible: boolean
  onRestart: () => void
  onExit: () => void
}

const STAT_LABEL = 'text-sm font-medium text-gray-500 dark:text-gray-400'
const STAT_VALUE = 'text-3xl font-bold text-gray-900 dark:text-foreground tabular-nums'
const SECTION_HEADING = 'text-sm font-semibold text-gray-700 dark:text-gray-200'
const CHIP = 'rounded-full border border-gray-200 dark:border-border bg-gray-50 dark:bg-secondary px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300'

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className={STAT_LABEL}>{label}</p>
    <p className={STAT_VALUE}>{value}</p>
  </div>
)

const ScoreList: React.FC<{ title: string; students: StudentScore[]; showNames: boolean }> = ({
  title, students, showNames,
}) => (
  <Card>
    <CardHeader className="pb-3"><CardTitle className={SECTION_HEADING}>{title}</CardTitle></CardHeader>
    <CardContent className="divide-y divide-gray-100 dark:divide-border">
      {students.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{EN.noData}</p>}
      {students.map((student) => (
        <div key={student.studentId} className="flex justify-between py-1.5 text-sm text-gray-700 dark:text-gray-300 first:pt-0 last:pb-0">
          <span>{showNames ? student.fullName : EN.anonymousStudent}</span>
          <span className="tabular-nums text-gray-500 dark:text-gray-400">
            {student.correct}/{student.total} · {student.percent}%
          </span>
        </div>
      ))}
    </CardContent>
  </Card>
)

export const ReviewSummary: React.FC<Props> = ({ summary, namesVisible, onRestart, onExit }) => {
  if (!summary) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{EN.noData}</p>
  }

  const pct = (value: number | null) => (value === null ? '—' : `${value}%`)
  const maxBucket = Math.max(1, ...summary.distribution.map((b) => b.count))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-2xl font-bold text-gray-900 dark:text-foreground">{EN.summaryTitle}</h1>
        <Button variant="outline" onClick={onRestart}>{EN.restart}</Button>
        <Button variant="ghost" onClick={onExit}>{EN.exit}</Button>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
          <Stat label={EN.averageScore} value={pct(summary.averagePercent)} />
          <Stat label={EN.medianScore} value={pct(summary.medianPercent)} />
          <Stat label={EN.minScore} value={pct(summary.minPercent)} />
          <Stat label={EN.maxScore} value={pct(summary.maxPercent)} />
          <Stat
            label={EN.averageTime}
            value={summary.averageTimeSeconds === null
              ? '—'
              : `${Math.round(summary.averageTimeSeconds / 60)} ${EN.minutesShort}`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className={SECTION_HEADING}>{EN.summaryDistribution}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {summary.distribution.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-gray-500 dark:text-gray-400">{bucket.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary/60" style={{ width: `${(bucket.count / maxBucket) * 100}%` }} />
              </div>
              <span className="w-6 shrink-0 text-right tabular-nums text-gray-700 dark:text-gray-300">{bucket.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top results is always named — praising who did well publicly is not the privacy
            concern this fix addresses. "Needs attention" singles out who struggled, which
            is exactly the kind of thing namesVisible exists to gate. */}
        <ScoreList title={EN.summaryTop} students={summary.top} showNames />
        <ScoreList title={EN.summaryBottom} students={summary.bottom} showNames={namesVisible} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className={SECTION_HEADING}>{EN.summaryHardest}</CardTitle></CardHeader>
        <CardContent className="divide-y divide-gray-100 dark:divide-border">
          {summary.hardest.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{EN.noData}</p>}
          {/* key is the composite (step, question) identity, not questionId alone: the same
              raw id can legitimately appear twice here when it names questions from two
              different steps of the same unit (see questionKey's doc comment). */}
          {summary.hardest.map((question) => (
            <div key={question.key} className="flex gap-3 py-2 text-sm text-gray-700 dark:text-gray-300 first:pt-0 last:pb-0">
              <span className="w-8 shrink-0 font-semibold text-gray-900 dark:text-foreground">{question.index + 1}</span>
              <span className="flex-1 line-clamp-2">{question.questionText || '—'}</span>
              <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                {question.correct}/{question.answered} · {question.percentCorrect}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className={SECTION_HEADING}>{EN.summaryNotSubmitted}</CardTitle></CardHeader>
        <CardContent>
          {summary.notSubmitted.length === 0
            ? <p className="text-sm text-gray-500 dark:text-gray-400">—</p>
            : namesVisible
              ? (
                <div className="flex flex-wrap gap-1.5">
                  {summary.notSubmitted.map((student) => (
                    <span key={student.student_id} className={CHIP}>
                      {student.full_name}
                    </span>
                  ))}
                </div>
              )
              : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {format(EN.notSubmittedCount, { count: summary.notSubmitted.length })}
                </p>
              )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ReviewSummary
