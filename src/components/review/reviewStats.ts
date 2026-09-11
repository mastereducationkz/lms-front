// Review mode's aggregation layer: raw stored answers in, per-question statistics out.
//
// Correctness is decided ONLY by gradeQuestion — the same function that produced each
// student's own score when they took the quiz. Anything else here (bucketing, option
// counting, name lists) is presentation over that verdict.
import {
  gradeQuestion,
  getAnswerKey,
  getExpectedAnswers,
  getGapSourceText,
  normalizeMcArray,
  normalizeText,
} from '../lesson/quiz/scoring'
import { parseGap } from '../../utils/gapParser'

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export interface ReviewAttempt {
  student_id: number
  attempt_id: number
  correct_answers: number
  total_questions: number
  score_percentage: number
  time_spent_seconds: number | null
  completed_at: string | null
  answers: string | null
}

export type AnswerBucket = 'correct' | 'partial' | 'incorrect' | 'unanswered'

/** A single gap can only be right or wrong — there is no partial credit within one blank. */
export type GapAnswerBucket = 'correct' | 'incorrect' | 'unanswered'

export interface GapAnswerOption {
  /** Stable identity: the normalised (case/space-insensitive) text. */
  key: string
  /**
   * What to print. For a fill_blank offered option: the option's own authored text (from
   * the gap's `[[…]]` token), regardless of how students typed it before selecting it. For
   * everything else (text_completion, and any answer not among a fill_blank's offered
   * options): the answer exactly as a student typed it, first occurrence wins.
   */
  text: string
  count: number
  /** Share of this gap's answered count, 1 dp. */
  percent: number
  isCorrect: boolean
  names: string[]
}

export interface GapStat {
  index: number
  participants: number
  answered: number
  unanswered: number
  correct: number
  incorrect: number
  /** Share of answered that were correct; null when nobody answered this gap. */
  percentCorrect: number | null
  /**
   * fill_blank: every option offered in the gap's own `[[…]]` token, in token order —
   * including one nobody picked (count 0) — the same "show every option" treatment
   * ReviewOptionBars gives a single_choice question. Any submitted answer that isn't among
   * the offered options still gets a row, appended after the offered ones (grouped
   * case/space-insensitively, most common first), so messy data is never silently dropped.
   * text_completion (and a fill_blank whose token can't be located): what students typed
   * for this gap, grouped case/space-insensitively, most common first — there is no option
   * list to show.
   */
  options: GapAnswerOption[]
  names: Record<GapAnswerBucket, string[]>
}

export interface OptionStat {
  /** Stable identity: the option index for choice questions, the normalised text otherwise. */
  key: string
  /** 'A'..'F' for choice questions, '' for free text. */
  label: string
  /** What to print — the option's text, or the answer exactly as a student typed it. */
  text: string
  count: number
  /** Share of answered, 1 dp. */
  percent: number
  isCorrect: boolean
  names: string[]
}

export interface QuestionStat {
  questionId: string
  index: number
  questionType: string
  questionText: string
  participants: number
  answered: number
  unanswered: number
  correct: number
  partial: number
  incorrect: number
  /** Share of answered that were fully correct; null when nothing was answered or the question is ungraded. */
  percentCorrect: number | null
  /** False when the question has no resolvable answer key — show the spread, claim no verdict. */
  graded: boolean
  /**
   * 'choice' bars per option, 'text' rows of what students typed, or 'none' when the
   * question has no meaningful answer distribution to show. Matching gets this because its
   * raw stored value is a set of left→right index pairs, not a single printable answer;
   * long_text gets it because its raw value is a whole essay, which review mode must not
   * project verbatim with the writer's name attached. Both fall back to a
   * correct/partial/incorrect split instead (per the review-mode spec).
   */
  distributionKind: 'choice' | 'text' | 'none'
  options: OptionStat[]
  names: Record<AnswerBucket, string[]>
  /**
   * Per-gap breakdown for fill_blank / text_completion questions, one entry per gap in
   * source order — empty for every other question type. This is additive: `answered`,
   * `correct`, `options`, etc. above still describe the whole cloze question exactly as
   * before (a 9-of-10-gaps submission still counts as one "partial" question there); this
   * array is what lets the presenter step through and discuss one gap at a time.
   */
  gaps: GapStat[]
}

const CHOICE_TYPES = new Set(['single_choice', 'multiple_choice', 'media_question'])

const round1 = (value: number): number => Math.round(value * 10) / 10

/** Turn `{__type:'Map', data:[...]}` back into a real Map (see deserializeQuizAnswers). */
const rehydrate = (raw: unknown): unknown => {
  if (raw && typeof raw === 'object' && (raw as any).__type === 'Map') {
    return new Map((raw as any).data)
  }
  return raw
}

const toMatchingMap = (raw: unknown): Map<unknown, unknown> => {
  const value = rehydrate(raw)
  if (value instanceof Map) return value
  if (value && typeof value === 'object') return new Map(Object.entries(value as object))
  return new Map()
}

/** The stored blob is `[[questionId, value], …]` — both answer maps merged. */
export function parseAnswerBlob(json: string | null | undefined): Map<string, unknown> {
  if (!json) return new Map()
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) return new Map(parsed as [string, unknown][])
    if (parsed && typeof parsed === 'object') return new Map(Object.entries(parsed))
    return new Map()
  } catch {
    return new Map()
  }
}

export const isGapType = (type: string): boolean =>
  type === 'fill_blank' || type === 'text_completion'

/**
 * The options actually offered for one fill_blank gap, in token order — what a student
 * picked from, not what they typed (fill_blank has no free typing; see
 * FillInBlankRenderer.tsx, which renders a <select> of exactly this list). Parsed from the
 * SAME source text and the SAME narrow `[[…]]` token pattern getExpectedAnswers (scoring.ts)
 * uses to build its answer key, so gap index `gapIndex` here always names the same blank
 * `getExpectedAnswers(question)[gapIndex]` does — mixing this with reviewStats' broader
 * GAP_TOKEN_SOURCE pattern (used for blanking display text, not for indexing) is exactly the
 * kind of index drift that caused a real disclosure bug before (see GAP_TOKEN_SOURCE's doc
 * comment).
 *
 * Returns null — not an empty array — when the token can't be located (no source text, gap
 * count mismatch, or the token parses to zero options), so the caller falls back to today's
 * grouped-typed-answers behaviour instead of rendering an empty panel. Only correctOption is
 * NOT used from parseGap's result here: which option is the key comes from
 * getExpectedAnswers, the same place gradeQuestion gets it, never from this parse.
 */
function fillBlankTokenOptions(question: any, gapIndex: number): string[] | null {
  if (question?.question_type !== 'fill_blank') return null
  const sourceText = getGapSourceText(question)
  // Narrow pattern, matching getExpectedAnswers exactly — see the doc comment above.
  const tokens = sourceText.match(/\[\[(.*?)\]\]/g)
  const token = tokens?.[gapIndex]
  if (!token) return null
  const inner = token.replace('[[', '').replace(']]', '')
  const { options } = parseGap(inner, question.gap_separator || ',')
  return options.length > 0 ? options : null
}

/**
 * Source pattern for a `[[…]]` gap token — shared by every place that needs to locate (not
 * parse) gap boundaries. blankGapText below uses it to blank every token; the presenter's
 * gap-stepper (ReviewQuestionView) uses the same pattern to split a passage into segments it
 * can step through one at a time. A plain string, not a compiled RegExp, so each caller
 * builds its own `g`-flagged instance — sharing one RegExp object across independent
 * `.replace()` call sites is safe on its own (the spec resets `lastIndex` per call), but a
 * shared source string is one less thing that can ever drift between the two.
 */
export const GAP_TOKEN_SOURCE = '\\[\\[([\\s\\S]*?)\\]\\]'

/**
 * Blank out `[[…]]` gap tokens for pre-reveal display. This does NOT parse the gap syntax
 * to find the answer key (that stays getExpectedAnswers's job in scoring.ts) — it only
 * removes the tokens so the projected text never shows the asterisked correct option.
 * `[\s\S]*?` (not `.`) so a gap token whose contents span a newline still gets blanked —
 * `.` never matches `\n` without the `s` flag, and this file's target runtime doesn't carry
 * `s` support as a given.
 *
 * This is intentionally broader than scoring.ts's getExpectedAnswers, whose token regex is
 * `.*?` (no `[\s\S]`) — the set of tokens blanked here is a strict superset of the set
 * scoring treats as real tokens, which is the safe direction: this can never fail to blank
 * something scoring would grade. Do not "align" the two regexes; that direction reintroduces
 * a leak. Two consequences of the mismatch, both intentional:
 *  - a gap token whose contents span a newline is blanked here but is NOT a token to
 *    scoring.ts, so Reveal falls back to correct_answer and the number of ____ printed here
 *    won't match the answer list Reveal shows;
 *  - `[\s\S]*?` is lazy and eats to the first `]]` it finds, so a nested-bracket expression
 *    (e.g. a matrix literal `[[a,b],[c,d]]`) collapses to a single ____ instead of rendering
 *    as written — this is exactly why blankHeading (below) uses `[^\]]+` instead.
 *
 * The same newline caveat applies to the gap-stepper (ReviewQuestionView's gapStepHtml),
 * which locates tokens with this exact pattern too — and used to inherit the mismatch itself
 * (C2): a multi-line gap token still counted as a numbered gap there, so its presence shifted
 * every later gap's index out of alignment with getExpectedAnswers's `.*?`-based `expected[]`,
 * and the gap the class was looking at could render a neighbour's answer, unrevealed. Fixed
 * by having gapStepHtml re-check each broad match against the narrow pattern itself: only a
 * token both patterns agree on gets a slot in `expected` and advances the gap counter; a
 * broad-only token (contents spanning a newline, same as here) renders an unconditional,
 * un-fillable blank instead. That keeps this function's "broader is the safe direction" true
 * at that call site too — do not "simplify" gapStepHtml back to indexing every broad match.
 */
export function blankGapText(text: string): string {
  return text.replace(new RegExp(GAP_TOKEN_SOURCE, 'g'), '____')
}

/**
 * Blank `[[…]]` gap tokens in a heading/text field unconditionally — by the presence of the
 * tokens, not by question_type. Mirrors QuizRenderer.tsx's student-facing renderer, which
 * strips question_text at all three of its render paths regardless of question_type; uses
 * the exact same regex (`[^\]]+`, not blankGapText's `[\s\S]*?`) so the two can never
 * disagree, and so a nested-bracket expression like a matrix literal `[[a,b],[c,d]]` is left
 * alone instead of collapsing to one ____.
 *
 * Use this for question_text headings (ReviewQuestionView, buildQuestionStats's questionText
 * fallback). Do NOT use it for content_text — that field is shown raw for non-gap types on
 * the student side too (QuizRenderer.tsx:760), so it stays gated by isGapType via
 * displayText.
 */
export const blankHeading = (text: string | null | undefined): string =>
  String(text ?? '').replace(/\[\[([^\]]+)\]\]/g, '____')

/**
 * A field's displayable text for gap types, tokens blanked. Quiz content is inconsistent
 * about which field carries the `[[…]]` syntax — usually content_text, but sometimes
 * question_text (see scoring.ts's getExpectedAnswers and QuizRenderer.tsx's student-facing
 * renderer, which both check either field for gaps) — so this must be applied to whichever
 * field text is handed to it, not just content_text. Used for both the projected question's
 * passage/heading (ReviewQuestionView) and the "Hardest questions" fallback text below. Pure
 * display: it never decides correctness — that stays getExpectedAnswers's job.
 */
export function displayText(questionType: string, text: string | null | undefined): string {
  return isGapType(questionType) ? blankGapText(String(text ?? '')) : String(text ?? '')
}

/**
 * short_answer / media_open_question store their accepted answers pipe-separated, and
 * gradeQuestion (scoring.ts) splits on the same character to grade. This mirrors only that
 * split for display — not the correctness decision — so Reveal shows a readable list
 * instead of the raw "paris|Paris|the capital" string.
 */
export function splitPipeAnswers(question: any): string[] {
  return (question?.correct_answer ?? '')
    .toString()
    .split('|')
    .map((a: string) => a.trim())
    .filter(Boolean)
}

/**
 * "No answer" is its own bucket, never a wrong option. -1 is a single choice the
 * student deselected; it means they left the question blank.
 */
export function isBlankAnswer(question: any, raw: unknown): boolean {
  const type = question?.question_type
  if (raw === undefined || raw === null) return true
  if (isGapType(type)) {
    const arr = Array.isArray(raw) ? raw : []
    return arr.length === 0 || arr.every((v) => (v ?? '').toString().trim() === '')
  }
  if (type === 'matching') return toMatchingMap(raw).size === 0
  if (Array.isArray(raw)) return raw.length === 0
  if (typeof raw === 'number') return raw < 0
  return raw.toString().trim() === ''
}

/** Split a stored value into gradeQuestion's (answer, gapAnswer) pair. */
export function replayAnswer(
  question: any,
  raw: unknown,
): { answer: unknown; gapAnswer: string[] | undefined } {
  const type = question?.question_type
  if (isGapType(type)) {
    const arr = Array.isArray(raw) ? raw.map((v) => (v ?? '').toString()) : []
    return { answer: undefined, gapAnswer: arr }
  }
  return { answer: rehydrate(raw), gapAnswer: undefined }
}

/** The questions worth reviewing — image_content blocks are layout, not questions. */
export function reviewQuestions(content: any): any[] {
  const questions = content?.questions
  if (!Array.isArray(questions)) return []
  return questions.filter(
    (q: any) => q && typeof q === 'object' && q.question_type !== 'image_content',
  )
}

/** Does this question have a usable answer key? If not we show the spread, not a verdict. */
function isGradable(question: any): boolean {
  const type = question?.question_type
  if (type === 'long_text') return false
  if (type === 'matching') {
    return Array.isArray(question.matching_pairs) && question.matching_pairs.length > 0
  }
  return getExpectedAnswers(question).length > 0
}

/**
 * Whether an option index is part of the answer key. Delegates to gradeQuestion so this can
 * never disagree with the score a student saw:
 *  - multiple_choice reuses gradeQuestion's own membership test (normalizeMcArray) against
 *    the same correct_answer field it grades against;
 *  - every other choice type (single_choice, media_question) asks gradeQuestion directly
 *    whether that index, submitted alone, would have graded correct — including its strict
 *    (non-coercing) equality, so a correct_answer authored as the string "1" is treated the
 *    same way here as it is when a student's own attempt is graded.
 */
export function isCorrectOption(question: any, index: number): boolean {
  if (question?.question_type === 'multiple_choice') {
    return normalizeMcArray(question?.correct_answer).includes(index)
  }
  return gradeQuestion(question, index, undefined).isCorrect
}

/** The printable form of a stored answer: gap arrays read best joined. */
function answerText(question: any, raw: unknown): string {
  if (isGapType(question?.question_type) && Array.isArray(raw)) {
    return raw.map((v) => (v ?? '').toString().trim()).join(' / ')
  }
  if (Array.isArray(raw)) return raw.join(', ')
  return (raw ?? '').toString().trim()
}

export function buildQuestionStats(
  questions: any[],
  attempts: ReviewAttempt[],
  nameById: Map<number, string>,
): QuestionStat[] {
  const parsed = attempts.map((a) => ({
    studentId: a.student_id,
    name: nameById.get(a.student_id) ?? `#${a.student_id}`,
    values: parseAnswerBlob(a.answers),
  }))

  return questions.map((question, index) => {
    const key = getAnswerKey(question)
    const type = question?.question_type ?? 'unknown'
    const graded = isGradable(question)
    const isChoice = CHOICE_TYPES.has(type) && Array.isArray(question?.options)
    // matching's raw stored value is a set of left->right index pairs, not a single
    // printable answer; long_text's is a whole essay, which must not be projected verbatim
    // with the writer's name attached (see review-mode spec). Both get a correct/partial/
    // incorrect split instead of an answer distribution.
    const noDistribution = type === 'matching' || type === 'long_text'
    const isGap = isGapType(type)
    // getExpectedAnswers's own length IS the gap count — same source scoring.ts grades
    // against, so a gap the answer key doesn't recognise never gets a stepper slot.
    const gapCount = isGap ? getExpectedAnswers(question).length : 0

    const names: Record<AnswerBucket, string[]> = {
      correct: [], partial: [], incorrect: [], unanswered: [],
    }

    // Choice questions keep a fixed bar per option; free text accumulates as it appears.
    const choiceCounts: { count: number; names: string[] }[] = isChoice
      ? question.options.map(() => ({ count: 0, names: [] as string[] }))
      : []
    const textRows = new Map<string, { text: string; count: number; names: string[]; isCorrect: boolean }>()

    // One slot per gap, accumulated alongside the whole-question totals above — additive,
    // never read by the whole-question branch and never feeding back into it.
    const gapTotals: Omit<GapStat, 'options' | 'percentCorrect'>[] = Array.from(
      { length: gapCount },
      (_, gapIndex) => ({
        index: gapIndex,
        participants: parsed.length,
        answered: 0,
        unanswered: 0,
        correct: 0,
        incorrect: 0,
        names: { correct: [], incorrect: [], unanswered: [] },
      }),
    )
    const gapGroups: Map<string, { text: string; count: number; names: string[]; isCorrect: boolean }>[] =
      Array.from({ length: gapCount }, () => new Map())

    let answered = 0
    let correct = 0
    let partial = 0
    let incorrect = 0

    for (const entry of parsed) {
      const raw = entry.values.get(key)

      if (isBlankAnswer(question, raw)) {
        names.unanswered.push(entry.name)
        // The whole cloze is blank, so every gap in it is unanswered too — no need to
        // replay/grade anything to know that.
        for (let g = 0; g < gapCount; g += 1) {
          gapTotals[g].unanswered += 1
          gapTotals[g].names.unanswered.push(entry.name)
        }
        continue
      }
      answered += 1

      // A gap array can be shorter than the expected list — replayAnswer already turns a
      // missing/non-array raw value into `[]`, so a short array simply leaves the later
      // indices `undefined` below, which the blank check treats as unanswered, not wrong.
      let gapProvided: string[] = []
      let gapPartResults: boolean[] = []

      if (graded) {
        const { answer, gapAnswer } = replayAnswer(question, raw)
        const result = gradeQuestion(question, answer, gapAnswer)
        if (isGap) {
          gapProvided = gapAnswer || []
          // gradeQuestion is the ONLY place gap correctness is decided — partResults is
          // exactly the per-gap verdicts it already computed while producing
          // correctParts/totalParts above. Nothing here re-derives correctness.
          gapPartResults = result.partResults || []
        }
        if (result.isCorrect) {
          correct += 1
          names.correct.push(entry.name)
        } else if (result.correctParts > 0) {
          partial += 1
          names.partial.push(entry.name)
        } else {
          incorrect += 1
          names.incorrect.push(entry.name)
        }
      }

      if (isGap) {
        for (let g = 0; g < gapCount; g += 1) {
          const value = gapProvided[g]
          const gap = gapTotals[g]
          if (value === undefined || value === null || value.toString().trim() === '') {
            gap.unanswered += 1
            gap.names.unanswered.push(entry.name)
            continue
          }
          gap.answered += 1
          const isCorrect = !!gapPartResults[g]
          if (isCorrect) {
            gap.correct += 1
            gap.names.correct.push(entry.name)
          } else {
            gap.incorrect += 1
            gap.names.incorrect.push(entry.name)
          }

          const text = value.toString().trim()
          const rowKey = normalizeText(text)
          const existingGapRow = gapGroups[g].get(rowKey)
          if (existingGapRow) {
            existingGapRow.count += 1
            existingGapRow.names.push(entry.name)
          } else {
            gapGroups[g].set(rowKey, { text, count: 1, names: [entry.name], isCorrect })
          }
        }
      }

      if (isChoice) {
        const picked = Array.isArray(raw) ? raw.map(Number) : [Number(raw)]
        for (const optionIndex of picked) {
          const slot = choiceCounts[optionIndex]
          if (slot) {
            slot.count += 1
            slot.names.push(entry.name)
          }
        }
      } else if (!noDistribution) {
        const text = answerText(question, raw)
        const rowKey = normalizeText(text)
        const existing = textRows.get(rowKey)
        if (existing) {
          existing.count += 1
          existing.names.push(entry.name)
        } else {
          const { answer, gapAnswer } = replayAnswer(question, raw)
          textRows.set(rowKey, {
            text,
            count: 1,
            names: [entry.name],
            isCorrect: graded && gradeQuestion(question, answer, gapAnswer).isCorrect,
          })
        }
      }
    }

    const options: OptionStat[] = isChoice
      ? question.options.map((option: any, optionIndex: number) => ({
          key: String(optionIndex),
          label: option?.letter || LETTERS[optionIndex] || String(optionIndex + 1),
          text: (option?.text ?? '').toString(),
          count: choiceCounts[optionIndex].count,
          percent: answered > 0 ? round1((choiceCounts[optionIndex].count / answered) * 100) : 0,
          isCorrect: graded && isCorrectOption(question, optionIndex),
          names: choiceCounts[optionIndex].names,
        }))
      : noDistribution
        ? []
        : [...textRows.entries()]
            .map(([rowKey, row]) => ({
              key: rowKey,
              label: '',
              text: row.text,
              count: row.count,
              percent: answered > 0 ? round1((row.count / answered) * 100) : 0,
              isCorrect: row.isCorrect,
              names: row.names,
            }))
            .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))

    // getExpectedAnswers's own gap order is the one gradeQuestion grades against — reused
    // here (not parseGap's correctOption) to mark which offered option is the key, so this
    // can never disagree with a student's own verdict.
    const expectedAnswers = isGap ? getExpectedAnswers(question).map(normalizeText) : []

    const typedRows = (g: number) =>
      [...gapGroups[g].entries()]
        .map(([rowKey, row]) => ({
          key: rowKey,
          text: row.text,
          count: row.count,
          percent: gapTotals[g].answered > 0
            ? round1((row.count / gapTotals[g].answered) * 100)
            : 0,
          isCorrect: row.isCorrect,
          names: row.names,
        }))
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))

    const gaps: GapStat[] = gapTotals.map((gap, g) => {
      const tokenOptions = fillBlankTokenOptions(question, g)

      let options: GapAnswerOption[]
      if (tokenOptions) {
        // fill_blank: every offered option, in token order — including one nobody picked
        // (count 0) — then anything a student submitted that isn't among the offered
        // options, appended after (same shape/order as the typed-answers fallback).
        const expected = expectedAnswers[g]
        const offeredKeys = new Set<string>()
        const offered: GapAnswerOption[] = tokenOptions.map((text) => {
          const rowKey = normalizeText(text)
          offeredKeys.add(rowKey)
          const row = gapGroups[g].get(rowKey)
          return {
            key: rowKey,
            text,
            count: row?.count ?? 0,
            percent: gap.answered > 0 ? round1(((row?.count ?? 0) / gap.answered) * 100) : 0,
            isCorrect: rowKey === expected,
            names: row?.names ?? [],
          }
        })
        const unexpected = [...gapGroups[g].entries()]
          .filter(([rowKey]) => !offeredKeys.has(rowKey))
          .map(([rowKey, row]) => ({
            key: rowKey,
            text: row.text,
            count: row.count,
            percent: gap.answered > 0 ? round1((row.count / gap.answered) * 100) : 0,
            isCorrect: rowKey === expected,
            names: row.names,
          }))
          .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
        options = [...offered, ...unexpected]
      } else {
        // text_completion, or a fill_blank whose token couldn't be located: fall back to
        // what students typed, grouped, most common first — unchanged from before.
        options = typedRows(g)
      }

      return {
        ...gap,
        percentCorrect: gap.answered > 0 ? round1((gap.correct / gap.answered) * 100) : null,
        options,
      }
    })

    return {
      questionId: key,
      index,
      questionType: type,
      // Gap questions (fill_blank, text_completion) mark their answer key with `*` inside
      // `[[…]]` tokens, and that syntax can land in EITHER content_text or question_text
      // depending on how the quiz was authored (see displayText's doc comment) — showing
      // either raw would leak the key into the "Hardest questions" list on the finish
      // screen the same way it leaked onto the presenter (see C1). displayText blanks
      // whichever field wins the fallback below.
      //
      // The non-gap branch still goes through blankHeading: a question whose question_type
      // isn't a gap type can still carry `[[…*…]]` syntax in question_text (an importer
      // conversion, a mistyped slug, a short_answer authored from a cloze), and that key
      // must not reach "Hardest questions" either — see blankHeading's doc comment.
      questionText: isGapType(type)
        ? displayText(type, question?.question_text || question?.content_text)
        : blankHeading(question?.question_text ?? question?.content_text),
      participants: parsed.length,
      answered,
      unanswered: names.unanswered.length,
      correct,
      partial,
      incorrect,
      percentCorrect: graded && answered > 0 ? round1((correct / answered) * 100) : null,
      graded,
      distributionKind: isChoice ? 'choice' : noDistribution ? 'none' : 'text',
      options,
      names,
      gaps,
    }
  })
}

export interface StudentRef {
  student_id: number
  full_name: string
}

export interface ScoreBucket {
  label: string
  min: number
  max: number
  count: number
}

export interface StudentScore {
  studentId: number
  fullName: string
  correct: number
  total: number
  percent: number
}

export interface HardQuestion {
  questionId: string
  index: number
  questionText: string
  answered: number
  correct: number
  percentCorrect: number
}

export interface ClassSummary {
  participants: number
  notSubmitted: StudentRef[]
  averagePercent: number | null
  medianPercent: number | null
  minPercent: number | null
  maxPercent: number | null
  averageTimeSeconds: number | null
  /** Always five buckets, 0–19 … 80–100. */
  distribution: ScoreBucket[]
  top: StudentScore[]
  bottom: StudentScore[]
  hardest: HardQuestion[]
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0–19%', min: 0, max: 19 },
  { label: '20–39%', min: 20, max: 39 },
  { label: '40–59%', min: 40, max: 59 },
  { label: '60–79%', min: 60, max: 79 },
  { label: '80–100%', min: 80, max: 100 },
]

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? round1((sorted[mid - 1] + sorted[mid]) / 2)
    : round1(sorted[mid])
}

/**
 * Scores are recomputed here rather than read from the stored score_percentage — and this
 * summary does NOT count what the grid and the presenter count. Those iterate
 * reviewQuestions() and so show every non-image_content question, long_text and
 * unresolvable-key questions included; this summary restricts itself to gradable questions
 * only (isGradable, above). Gap questions (fill_blank, text_completion) are scored
 * gap-by-gap here, the same way the student's own result screen scores them (LessonPage's
 * getGapStatistics accumulates gradeQuestion's correctParts/totalParts per gap) — a 9-of-10
 * gap answer contributes 9/10, not 0/1. That part matches getGapStatistics exactly.
 *
 * The rest does NOT match LessonPage's own regularQuestions/correctRegular counting, and
 * that is a real, visible divergence — not just an implementation detail. isGradable (above)
 * excludes long_text entirely, and excludes any other question whose correct_answer doesn't
 * resolve to a usable key, from BOTH the numerator and the denominator. LessonPage counts
 * long_text as one regular question, correct iff the student wrote anything (gradeQuestion's
 * long_text branch) — for students where isSpecialGroupStudent is false. LessonPage.tsx
 * excludes long_text entirely for isSpecialGroupStudent instead (graded by the teacher
 * there; counting it locally would distort the denominator before grading completes), in
 * which case LessonPage agrees with isGradable, which also excludes it. LessonPage also
 * counts an unresolvable-key question as answered-and-wrong rather than dropping it. So for
 * a quiz with 5 MCQs + 1 essay where a non-special-group student gets 4 MCQs right and
 * writes the essay, the student's own result screen reads 5/6 = 83.3% while this summary
 * reads 4/5 = 80% for that same student's contribution. Whether an essay (or an unresolvable
 * question) should count toward a projected class average is a product decision, not
 * something this function tries to paper over — so treat any resemblance between this
 * summary's percentage and a given student's own score as coincidental whenever the quiz
 * contains long_text or unresolvable-key questions.
 */
export function buildClassSummary(
  questionStats: QuestionStat[],
  questions: any[],
  attempts: ReviewAttempt[],
  nameById: Map<number, string>,
  notSubmitted: StudentRef[],
): ClassSummary {
  const gradable = questions.filter((q) => isGradable(q))

  const scores: StudentScore[] = attempts.map((attempt) => {
    const values = parseAnswerBlob(attempt.answers)
    let correctParts = 0
    let totalParts = 0
    for (const question of gradable) {
      const raw = values.get(getAnswerKey(question))
      if (isGapType(question?.question_type)) {
        const { gapAnswer } = replayAnswer(question, raw)
        const result = gradeQuestion(question, undefined, gapAnswer)
        correctParts += result.correctParts
        totalParts += result.totalParts
        continue
      }
      totalParts += 1
      if (isBlankAnswer(question, raw)) continue
      const { answer, gapAnswer } = replayAnswer(question, raw)
      if (gradeQuestion(question, answer, gapAnswer).isCorrect) correctParts += 1
    }
    return {
      studentId: attempt.student_id,
      fullName: nameById.get(attempt.student_id) ?? `#${attempt.student_id}`,
      correct: correctParts,
      total: totalParts,
      percent: totalParts > 0 ? round1((correctParts / totalParts) * 100) : 0,
    }
  })

  const percents = scores.map((s) => s.percent)
  const times = attempts
    .map((a) => a.time_spent_seconds)
    .filter((t): t is number => typeof t === 'number' && t >= 0)

  const ranked = [...scores].sort((a, b) => b.percent - a.percent || a.fullName.localeCompare(b.fullName))

  const hardest = questionStats
    .filter((stat) => stat.graded && stat.percentCorrect !== null)
    .sort((a, b) => (a.percentCorrect as number) - (b.percentCorrect as number))
    .slice(0, 5)
    .map((stat) => ({
      questionId: stat.questionId,
      index: stat.index,
      questionText: stat.questionText,
      answered: stat.answered,
      correct: stat.correct,
      percentCorrect: stat.percentCorrect as number,
    }))

  return {
    participants: attempts.length,
    notSubmitted,
    averagePercent: percents.length
      ? round1(percents.reduce((sum, p) => sum + p, 0) / percents.length)
      : null,
    medianPercent: median(percents),
    minPercent: percents.length ? Math.min(...percents) : null,
    maxPercent: percents.length ? Math.max(...percents) : null,
    averageTimeSeconds: times.length
      ? Math.round(times.reduce((sum, t) => sum + t, 0) / times.length)
      : null,
    // `percent` is round1'd — one decimal place, not an integer — so inclusive integer
    // ranges (0–19, 20–39, …) leave gaps at every boundary: 79.3 belongs to neither
    // 60–79 nor 80–100 under `>= min && <= max`. Bucket by index instead so every
    // percent in [0,100] lands in exactly one bucket by construction (100 clamps into
    // the last one).
    distribution: BUCKETS.map((bucket, i) => ({
      ...bucket,
      count: percents.filter((p) => Math.min(BUCKETS.length - 1, Math.floor(p / 20)) === i).length,
    })),
    top: ranked.slice(0, 3),
    // In a group of three or four the same student can appear in both lists. That is honest
    // — hiding them would leave "Needs attention" mysteriously empty for a small class.
    bottom: [...ranked].reverse().slice(0, 3),
    hardest,
  }
}

/**
 * Whether a WHOLE-QUESTION consumer — one that describes the entire cloze, not one gap of
 * it — may show correctness-revealing content right now. `revealed` itself means "this one
 * gap is revealed" for gap questions (the semantic shift the gap stepper introduced); a
 * consumer that prints something spanning every gap (an explanation that lists every blank,
 * a whole-question percentCorrect, the correct/partial/incorrect name lists) must not key off
 * that per-gap flag directly, or it leaks answers to gaps the class hasn't reached yet — see
 * ReviewQuestionView's explanation gate (the original of this predicate) and
 * ReviewStatsPanel's percentCorrect / name-list gates (#F1: the name lists were cleared in an
 * earlier pass on the mistaken belief that they shared the same per-gap `revealed` as the
 * bars above them, when in fact they describe the whole question).
 *
 * True for a non-gap question once `revealed`; true for a gap question only once the LAST gap
 * is revealed (stepping past gap 1 of 3 must not already show whole-question correctness);
 * and true whenever `gapTotal` is 0 — a gap-type question with no locatable gaps collapses to
 * the plain `revealed` check, matching the non-gap case, rather than gating on `gapIndex ===
 * -1` (unreachable) and hiding the content forever.
 */
export function wholeQuestionRevealed(
  isGap: boolean,
  gapIndex: number,
  gapTotal: number,
  revealed: boolean,
): boolean {
  if (!revealed) return false
  if (!isGap || gapTotal === 0) return true
  return gapIndex === gapTotal - 1
}

/** The question grid's colour bands. */
export function accuracyBand(
  stat: QuestionStat | undefined,
): 'none' | 'low' | 'medium' | 'high' {
  if (!stat || stat.answered === 0 || stat.percentCorrect === null) return 'none'
  if (stat.percentCorrect < 50) return 'low'
  if (stat.percentCorrect < 80) return 'medium'
  return 'high'
}
