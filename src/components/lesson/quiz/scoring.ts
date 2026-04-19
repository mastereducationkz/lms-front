import { parseGap } from '../../../utils/gapParser'

export type QuestionStatusKey = 'correct' | 'incorrect' | 'partial' | 'review'

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

export const getExpectedAnswers = (question: any): string[] => {
  if (!question) return []
  const type = question.question_type
  if (type === 'fill_blank' || type === 'text_completion') {
    const sourceText = (question.content_text || question.question_text || '').toString()
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

const normalizeText = (value: unknown): string =>
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
    const total = Math.max(expected.length, provided.length)
    let correct = 0
    for (let i = 0; i < total; i += 1) {
      if (expected[i] && provided[i] && expected[i] === provided[i]) correct += 1
    }
    return { isCorrect: total > 0 && correct === total, correctParts: correct, totalParts: total, isReview: false }
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
    const total = (question.matching_pairs?.length || map.size || 0)
    let correct = 0
    for (const [left, right] of map.entries()) {
      if (left === right) correct += 1
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
    return {
      key: 'incorrect',
      label: 'Incorrect',
      className: ERROR_CLASS,
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

export const isAnswerComplete = (question: any, answer: unknown, gapAnswer: string[] | undefined): boolean => {
  if (!question) return false
  const type = question.question_type
  if (type === 'image_content') return true
  if (type === 'fill_blank' || type === 'text_completion') {
    const gaps = gapAnswer || []
    if (gaps.length === 0) return false
    return gaps.every((v) => (v || '').toString().trim() !== '')
  }
  if (type === 'short_answer' || type === 'long_text' || type === 'media_open_question') {
    return !!answer && (answer as string).toString().trim() !== ''
  }
  if (type === 'multiple_choice') {
    const need = Array.isArray(question.correct_answer) ? question.correct_answer.length : 1
    return Array.isArray(answer) && answer.length === need
  }
  if (type === 'matching') {
    const map = toMatchingMap(answer)
    const total = question.matching_pairs?.length || 0
    if (total === 0) return map.size > 0
    return map.size === total
  }
  return answer !== undefined
}
