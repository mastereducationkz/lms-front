export const DEFAULT_QUIZ_PASSING_SCORE_REQUIRED = 50
export const DEFAULT_QUIZ_PASSING_SCORE_OPTIONAL = 30

export const resolveQuizPassingScorePercent = (
  quizData: { passing_score_percent?: number | null } | null | undefined,
  isOptionalStep?: boolean,
): number => {
  const raw = quizData?.passing_score_percent
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return Math.min(100, Math.max(0, raw))
  }
  return isOptionalStep ? DEFAULT_QUIZ_PASSING_SCORE_OPTIONAL : DEFAULT_QUIZ_PASSING_SCORE_REQUIRED
}

export const isQuizScorePassing = (
  scorePercentage: number,
  quizData: { passing_score_percent?: number | null } | null | undefined,
  isOptionalStep?: boolean,
): boolean => scorePercentage >= resolveQuizPassingScorePercent(quizData, isOptionalStep)
