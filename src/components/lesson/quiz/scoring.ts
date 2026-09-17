import { parseGap } from '../../../utils/gapParser'

/** ``unscored``: nothing to score (an image block, a gap question with no gaps) — never «Incorrect». */
export type QuestionStatusKey = 'correct' | 'incorrect' | 'partial' | 'review' | 'unscored'

export interface QuestionStatus {
  key: QuestionStatusKey
  label: string
  className: string
  correctParts: number
  totalParts: number
}

export interface GradeQuestionOptions {
  isSpecialGroupStudent?: boolean
}

export interface GradeQuestionResult {
  isCorrect: boolean
  correctParts: number
  totalParts: number
  isReview: boolean
  /**
   * Per-gap verdicts, in gap order, for fill_blank / text_completion questions only — the
   * same expected[i] === provided[i] comparison the loop below already makes to produce
   * correctParts/totalParts, just not thrown away. Absent (not just empty) for every other
   * question type — a caller can tell "no per-part detail here" from "this gap was answered
   * wrong" without inspecting question_type itself. One entry per gap the question draws on
   * screen (visibleGapCount) — no more, however long the stored answer array is: a slot with no
   * gap on screen can neither be answered nor be marked, so it is never scored (2026-09-17: a
   * stale answer array cost students points no review showed). A gap question with no gaps
   * returns `[]` — present and truthy, scoring nothing. Review mode's per-gap stats
   * (reviewStats.ts) and the quiz review's gap marks (gapMarks) read this instead of re-deriving
   * gap correctness themselves — one grader, one answer key.
   */
  partResults?: boolean[]
}

const SUCCESS_CLASS = 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
const ERROR_CLASS = 'border border-rose-500/30 bg-rose-500/10 text-rose-400'
const PARTIAL_CLASS = 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
const REVIEW_CLASS = 'border border-border bg-muted text-muted-foreground'

export const getAnswerKey = (q: { id: string | number } | { id: string | number } | null | undefined): string => {
  if (!q || q.id === undefined || q.id === null) return ''
  return String(q.id)
}

export const compareMcAnswers = (a: unknown, b: unknown): number => {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return String(a).localeCompare(String(b))
}

export const normalizeMcArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  return [...value]
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b)
}

const stripHtmlSimple = (str: string): string => {
  let cleaned = str
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  cleaned = cleaned
    .replace(/<[^>]*>/g, '')
    .replace(/<[^>]*$/g, '')
    .replace(/^[^<]*>/g, '')
    .replace(/>[^<]*</g, '><')
  cleaned = cleaned.replace(/[<>]/g, '')
  return cleaned.trim()
}

/**
 * Which field actually carries a gap question's `[[…]]` tokens: content_text if it has any
 * text at all, else question_text. Quiz content is inconsistent about which field the gap
 * syntax lands in (see review mode's displayText doc comment for the same story from the
 * review side), so this one resolution order is shared by getExpectedAnswers below and by
 * review mode's gap-stepper (ReviewQuestionView), which needs the same source text to render
 * — never a second, potentially-diverging guess at where the gaps live.
 */
export const getGapSourceText = (question: any): string =>
  (question?.content_text || question?.question_text || '').toString()

export const getExpectedAnswers = (question: any): string[] => {
  if (!question) return []
  const type = question.question_type
  if (type === 'fill_blank' || type === 'text_completion') {
    const sourceText = getGapSourceText(question)
    const gapTokens = sourceText.match(/\[\[(.*?)\]\]/g) || []
    if (type === 'fill_blank') {
      const parsed = gapTokens.map((token: string) => {
        const inner = token.replace('[[', '').replace(']]', '')
        const result = parseGap(inner, question.gap_separator || ',')
        return (result.correctOption || '').toString()
      })
      if (parsed.length > 0) return parsed
    } else {
      const parsed = gapTokens.map((token: string) => {
        const inner = token.replace('[[', '').replace(']]', '')
        const rawOptions = inner.split(question.gap_separator || ',').map((s: string) => s.trim()).filter(Boolean)
        let correctIndex = 0
        rawOptions.forEach((opt: string, idx: number) => {
          if (opt.includes('*')) correctIndex = idx
        })
        const cleaned = rawOptions.map((o: string) => stripHtmlSimple(o.replace(/\*/g, '')))
        const filtered = cleaned.filter((o: string) => o && o.trim())
        let correct = cleaned[correctIndex]
        if (!correct || !correct.trim() || !filtered.includes(correct)) {
          correct = filtered[0] || ''
        }
        return correct
      })
      if (parsed.length > 0) return parsed
    }
    return Array.isArray(question.correct_answer)
      ? question.correct_answer.map((a: any) => (a ?? '').toString())
      : (question.correct_answer ? [question.correct_answer.toString()] : [])
  }
  if (Array.isArray(question.correct_answer)) {
    return question.correct_answer.map((a: any) => (a ?? '').toString())
  }
  if (question.correct_answer !== undefined && question.correct_answer !== null) {
    return [question.correct_answer.toString()]
  }
  return []
}

// Exported so reviewStats.ts's gap-row grouping keys off the exact same normalisation
// gradeQuestion uses to decide a gap's verdict (see #9: two independently-written copies of
// this, even if identical today, are one drift away from a row merging two students who
// actually disagreed with gradeQuestion — one of them would carry a verdict they didn't earn).
export const normalizeText = (value: unknown): string =>
  (value ?? '').toString().trim().toLowerCase()

const toMatchingMap = (raw: unknown): Map<number, number> => {
  if (!raw) return new Map()
  if (raw instanceof Map) {
    const m = new Map<number, number>()
    for (const [k, v] of raw.entries()) m.set(Number(k), Number(v))
    return m
  }
  if (typeof raw === 'object') {
    const m = new Map<number, number>()
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      m.set(Number(k), Number(v))
    }
    return m
  }
  return new Map()
}

export const gradeQuestion = (
  question: any,
  answer: unknown,
  gapAnswer: string[] | undefined,
  options: GradeQuestionOptions = {}
): GradeQuestionResult => {
  if (!question) {
    return { isCorrect: false, correctParts: 0, totalParts: 0, isReview: false }
  }
  const type = question.question_type

  if (type === 'image_content') {
    return { isCorrect: true, correctParts: 0, totalParts: 0, isReview: false }
  }

  if (type === 'fill_blank' || type === 'text_completion') {
    const expected = getExpectedAnswers(question).map(normalizeText)
    const provided = (gapAnswer || []).map(normalizeText)
    // The gaps on screen, and only those: the review marks exactly these.
    const total = visibleGapCount(question)
    let correct = 0
    const partResults: boolean[] = []
    for (let i = 0; i < total; i += 1) {
      const partCorrect = !!(expected[i] && provided[i] && expected[i] === provided[i])
      if (partCorrect) correct += 1
      partResults.push(partCorrect)
    }
    return {
      isCorrect: total > 0 && correct === total,
      correctParts: correct,
      totalParts: total,
      isReview: false,
      partResults,
    }
  }

  if (type === 'long_text') {
    if (options.isSpecialGroupStudent) {
      return { isCorrect: false, correctParts: 0, totalParts: 0, isReview: true }
    }
    const filled = (answer ?? '').toString().trim().length > 0
    return { isCorrect: filled, correctParts: filled ? 1 : 0, totalParts: 1, isReview: false }
  }

  if (type === 'short_answer' || type === 'media_open_question') {
    const allowed = (question.correct_answer || '')
      .toString()
      .split('|')
      .map((a: string) => a.trim().toLowerCase())
      .filter((a: string) => a.length > 0)
    const userVal = normalizeText(answer)
    const isCorrect = allowed.includes(userVal)
    return { isCorrect, correctParts: isCorrect ? 1 : 0, totalParts: 1, isReview: false }
  }

  if (type === 'multiple_choice') {
    const expected = normalizeMcArray(question.correct_answer)
    const provided = normalizeMcArray(answer)
    const isCorrect =
      expected.length > 0 &&
      expected.length === provided.length &&
      expected.every((v, i) => v === provided[i])
    return { isCorrect, correctParts: isCorrect ? 1 : 0, totalParts: 1, isReview: false }
  }

  if (type === 'matching') {
    const map = toMatchingMap(answer)
    const pairs = question.matching_pairs?.length || 0
    const total = (pairs || map.size || 0)
    let correct = 0
    for (const [left, right] of map.entries()) {
      // An entry for a pair the question no longer has is not a right answer (nothing shows it).
      if (left === right && (!pairs || (left >= 0 && left < pairs))) correct += 1
    }
    return { isCorrect: total > 0 && correct === total, correctParts: correct, totalParts: total, isReview: false }
  }

  if (answer !== undefined && answer === question.correct_answer) {
    return { isCorrect: true, correctParts: 1, totalParts: 1, isReview: false }
  }
  return { isCorrect: false, correctParts: 0, totalParts: 1, isReview: false }
}

export const getQuestionStatus = (
  question: any,
  answer: unknown,
  gapAnswer: string[] | undefined,
  options: GradeQuestionOptions = {}
): QuestionStatus => {
  const result = gradeQuestion(question, answer, gapAnswer, options)
  if (result.isReview) {
    return {
      key: 'review',
      label: 'Needs review',
      className: REVIEW_CLASS,
      correctParts: 0,
      totalParts: 1
    }
  }
  if (result.totalParts === 0) {
    // Nothing scored (an image block, a gap question with no gaps): it cost no point, so it is
    // never «Incorrect» — before 2026-09-17 image blocks turned the navigator square red.
    return {
      key: 'unscored',
      label: 'Not scored',
      className: REVIEW_CLASS,
      correctParts: 0,
      totalParts: 0
    }
  }
  if (result.isCorrect) {
    return {
      key: 'correct',
      label: 'Correct',
      className: SUCCESS_CLASS,
      correctParts: result.correctParts,
      totalParts: result.totalParts
    }
  }
  const scoredPerPart = question?.question_type === 'fill_blank' || question?.question_type === 'text_completion'
  if (result.correctParts > 0 && !scoredPerPart) {
    // Scored whole (one item, lost unless every pair is right) — the badge says «Incorrect», as
    // the score does, and keeps how close it was.
    return {
      key: 'incorrect',
      label: question?.question_type === 'matching'
        ? `Incorrect · ${result.correctParts}/${result.totalParts} pairs`
        : 'Incorrect',
      className: ERROR_CLASS,
      correctParts: result.correctParts,
      totalParts: result.totalParts
    }
  }
  if (result.correctParts > 0) {
    const labelTotal = result.totalParts > 1 ? `${result.correctParts}/${result.totalParts} correct` : 'Partially correct'
    return {
      key: 'partial',
      label: labelTotal,
      className: PARTIAL_CLASS,
      correctParts: result.correctParts,
      totalParts: result.totalParts
    }
  }
  return {
    key: 'incorrect',
    label: 'Incorrect',
    className: ERROR_CLASS,
    correctParts: 0,
    totalParts: result.totalParts
  }
}

export type GapMark = 'correct' | 'incorrect' | null

const GAP_TOKEN = /\[\[(.*?)\]\]/g

/** How many gaps a fill_blank / text_completion question draws — the renderers' own tokenizer. */
export const visibleGapCount = (question: any): number => (getGapSourceText(question).match(GAP_TOKEN) || []).length

/**
 * What the review draws on each gap it renders, in gap order: the answer key it reveals and a
 * green/red mark. FillInBlankQuestion / TextCompletionQuestion render exactly this.
 *
 * Both come from gradeQuestion — the key from getExpectedAnswers, each mark from its partResults —
 * so a gap is red exactly when it cost a point: an empty gap too, and a text_completion gap judged
 * by its `[[…*…]]` token, not by a `correct_answer` field that may be missing or stale (2026-09-17:
 * 40/45 showed only 4 answers marked incorrect).
 */
export const gapMarks = (question: any, gapAnswer: string[] | undefined): { expected: string[]; marks: GapMark[] } => {
  const expected = getExpectedAnswers(question).slice(0, visibleGapCount(question))
  const { partResults = [] } = gradeQuestion(question, undefined, gapAnswer || [])
  return { expected, marks: partResults.map((right): GapMark => (right ? 'correct' : 'incorrect')) }
}

export interface QuizScoreStats {
  totalGaps: number
  correctGaps: number
  regularQuestions: number
  correctRegular: number
}

/**
 * The quiz's score as LessonPage saves it and the completed screen shows it: every gap of a
 * fill_blank / text_completion question is an item, every other scored question is one item.
 * Long text for special-group students is teacher-graded and left out.
 */
export const scoreQuiz = (
  questions: any[],
  answerFor: (question: any) => unknown,
  gapAnswerFor: (question: any) => string[] | undefined,
  options: GradeQuestionOptions = {},
): QuizScoreStats => {
  const stats: QuizScoreStats = { totalGaps: 0, correctGaps: 0, regularQuestions: 0, correctRegular: 0 }
  for (const question of questions) {
    const type = question?.question_type
    if (type === 'image_content') continue
    if (type === 'fill_blank' || type === 'text_completion') {
      const result = gradeQuestion(question, undefined, gapAnswerFor(question) || [])
      stats.totalGaps += result.totalParts
      stats.correctGaps += result.correctParts
      continue
    }
    if (type === 'long_text' && options.isSpecialGroupStudent) continue
    stats.regularQuestions += 1
    if (gradeQuestion(question, answerFor(question), undefined, options).isCorrect) stats.correctRegular += 1
  }
  return stats
}

/**
 * How many items the review visibly marks incorrect: each red gap of a gap question, and each
 * other question whose badge / navigator square reads «Incorrect». The completed screen's
 * «Incorrect» (items − correct items of scoreQuiz) must equal this.
 */
export const visibleIncorrectItems = (
  questions: any[],
  answerFor: (question: any) => unknown,
  gapAnswerFor: (question: any) => string[] | undefined,
  options: GradeQuestionOptions = {},
): number => {
  let count = 0
  for (const question of questions) {
    const type = question?.question_type
    if (type === 'fill_blank' || type === 'text_completion') {
      count += gapMarks(question, gapAnswerFor(question)).marks.filter((mark) => mark === 'incorrect').length
      continue
    }
    if (getQuestionStatus(question, answerFor(question), gapAnswerFor(question), options).key === 'incorrect') count += 1
  }
  return count
}

export const isAnswerComplete = (question: any, answer: unknown, gapAnswer: string[] | undefined): boolean => {
  if (!question) return false
  const type = question.question_type
  if (type === 'image_content') return true
  if (type === 'fill_blank' || type === 'text_completion') {
    // Every gap on screen filled — a longer stored array's extra slots don't block, a shorter
    // one's missing gaps don't pass (both are what the score counts).
    const gaps = gapAnswer || []
    const count = visibleGapCount(question)
    return Array.from({ length: count }, (_, i) => (gaps[i] || '').toString().trim() !== '').every(Boolean)
  }
  if (type === 'short_answer' || type === 'long_text' || type === 'media_open_question') {
    return !!answer && (answer as string).toString().trim() !== ''
  }
  if (type === 'multiple_choice') {
    const need = Array.isArray(question.correct_answer) ? question.correct_answer.length : 1
    return Array.isArray(answer) && answer.length === need && answer.every((v) => Number(v) >= 0)
  }
  if (type === 'single_choice' || type === 'media_question') {
    // ChoiceQuestion stores -1 when the chosen option is clicked again: no answer.
    return answer !== undefined && answer !== null && !(typeof answer === 'number' && answer < 0)
  }
  if (type === 'matching') {
    const map = toMatchingMap(answer)
    const total = question.matching_pairs?.length || 0
    if (total === 0) return map.size > 0
    return map.size === total
  }
  return answer !== undefined
}
