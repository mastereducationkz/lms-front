import { describe, expect, it } from 'vitest'
import {
  accuracyBand,
  blankGapText,
  blankHeading,
  buildClassSummary,
  buildQuestionStats,
  displayText,
  isBlankAnswer,
  isCorrectOption,
  parseAnswerBlob,
  questionKey,
  replayAnswer,
  reviewQuestions,
  splitPipeAnswers,
  wholeQuestionRevealed,
  type ReviewAttempt,
} from './reviewStats'
import { gradeQuestion } from '../lesson/quiz/scoring'

const single = {
  id: 'q1',
  question_type: 'single_choice',
  question_text: 'Pick B',
  correct_answer: 1,
  options: [{ text: 'alpha' }, { text: 'beta' }, { text: 'gamma' }],
}

const multi = {
  id: 'q2',
  question_type: 'multiple_choice',
  question_text: 'Pick A and C',
  correct_answer: [0, 2],
  options: [{ text: 'alpha' }, { text: 'beta' }, { text: 'gamma' }],
}

const short = { id: 'q3', question_type: 'short_answer', correct_answer: 'cat' }

const gaps = {
  id: 'q4',
  question_type: 'fill_blank',
  content_text: 'A [[cat*,dog]] and a [[hat*,bat]]',
}

// Some gap questions carry their [[…*…]] syntax in question_text rather than content_text —
// scoring.ts's getExpectedAnswers and QuizRenderer.tsx's student view both check either
// field for exactly this reason. This fixture has no content_text at all, so a fallback
// that only ever blanks content_text (the C1 bug) would fall through to the raw,
// answer-key-bearing question_text untouched.
const gapsInQuestionText = {
  id: 'q7',
  question_type: 'fill_blank',
  question_text: 'A [[cat*,dog]] and a [[hat*,bat]]',
}

// The actual class of bug (this is the third occurrence): a question whose question_type is
// NOT a gap type — converted by an importer, a mistyped slug, a short_answer authored from a
// cloze — but whose question_text still carries [[…*…]] gap syntax anyway. A fix that keys
// off question_type (isGapType) rather than the presence of the tokens themselves prints the
// asterisked key on the projector while QuizRenderer.tsx's student view (which strips
// question_text unconditionally, not gated by type) already showed [[blank]].
const gapsInQuestionTextWrongType = {
  id: 'q8',
  question_type: 'short_answer',
  question_text: 'A [[cat*,dog]] and a [[hat*,bat]]',
  correct_answer: 'cat',
}

// A richer cloze fixture for per-gap stats — three gaps, expected ['cat', 'mat', 'door'].
// fill_blank: students PICK from the gap's own option list (FillInBlankRenderer renders a
// <select>), so review mode must show every offered option, not just what was picked.
const threeGaps = {
  id: 'q9',
  question_type: 'fill_blank',
  content_text: 'The [[cat*,dog]] sat on the [[mat*,rug]] near the [[door*,window]]',
}

// Same three-gap passage, but text_completion: students TYPE into a free-text box
// (TextCompletionRenderer), so there is no option list to show — only what was typed.
const threeGapsTyped = {
  id: 'q10',
  question_type: 'text_completion',
  content_text: 'The [[cat*,dog]] sat on the [[mat*,rug]] near the [[door*,window]]',
}

const essay = { id: 'q5', question_type: 'long_text' }

const matching = {
  id: 'q6',
  question_type: 'matching',
  question_text: 'Match the pairs',
  matching_pairs: [
    { left: 'cat', right: 'meow' },
    { left: 'dog', right: 'woof' },
  ],
}

const names = new Map([[1, 'Abenov'], [2, 'Borisov'], [3, 'Vlasov']])

function attempt(studentId: number, answers: unknown): ReviewAttempt {
  return {
    student_id: studentId,
    attempt_id: studentId * 10,
    correct_answers: 0,
    total_questions: 0,
    score_percentage: 0,
    time_spent_seconds: 60,
    completed_at: '2026-09-01T10:00:00Z',
    answers: JSON.stringify(answers),
  }
}

describe('parseAnswerBlob', () => {
  it('reads the stored entry-array form', () => {
    const map = parseAnswerBlob('[["q1", 2], ["q3", "cat"]]')
    expect(map.get('q1')).toBe(2)
    expect(map.get('q3')).toBe('cat')
  })

  it('returns an empty map for null, empty and malformed blobs', () => {
    expect(parseAnswerBlob(null).size).toBe(0)
    expect(parseAnswerBlob('').size).toBe(0)
    expect(parseAnswerBlob('{oops').size).toBe(0)
  })
})

describe('isBlankAnswer', () => {
  it('treats a deselected single choice (-1) as unanswered, not as a wrong option', () => {
    expect(isBlankAnswer(single, -1)).toBe(true)
  })

  it('treats missing, empty string and empty array as unanswered', () => {
    expect(isBlankAnswer(single, undefined)).toBe(true)
    expect(isBlankAnswer(short, '')).toBe(true)
    expect(isBlankAnswer(multi, [])).toBe(true)
  })

  it('treats all-empty gap arrays as unanswered', () => {
    expect(isBlankAnswer(gaps, ['', '  '])).toBe(true)
    expect(isBlankAnswer(gaps, ['cat', ''])).toBe(false)
  })

  it('treats index 0 as a real answer', () => {
    expect(isBlankAnswer(single, 0)).toBe(false)
  })
})

describe('replayAnswer', () => {
  it('routes gap arrays to gapAnswer', () => {
    expect(replayAnswer(gaps, ['cat', 'hat'])).toEqual({
      answer: undefined,
      gapAnswer: ['cat', 'hat'],
    })
  })

  it('rehydrates a serialised Map for matching questions', () => {
    const raw = { __type: 'Map', data: [[0, 0], [1, 2]] }
    const { answer } = replayAnswer({ id: 'q6', question_type: 'matching' }, raw)
    expect(answer).toBeInstanceOf(Map)
    expect((answer as Map<number, number>).get(1)).toBe(2)
  })

  it('passes choice values straight through', () => {
    expect(replayAnswer(single, 2)).toEqual({ answer: 2, gapAnswer: undefined })
  })
})

describe('reviewQuestions', () => {
  it('drops image_content blocks', () => {
    const content = {
      questions: [single, { id: 'x', question_type: 'image_content' }, short],
    }
    expect(reviewQuestions(content).map((q) => q.id)).toEqual(['q1', 'q3'])
  })

  it('survives missing content', () => {
    expect(reviewQuestions(null)).toEqual([])
    expect(reviewQuestions({})).toEqual([])
  })
})

describe('buildQuestionStats — single choice', () => {
  const attempts = [
    attempt(1, [['q1', 1]]),   // correct
    attempt(2, [['q1', 2]]),   // wrong
    attempt(3, [['q1', -1]]),  // deselected -> unanswered
  ]
  const [stat] = buildQuestionStats([single], attempts, names)

  it('counts answered, unanswered, correct and incorrect', () => {
    expect(stat.participants).toBe(3)
    expect(stat.answered).toBe(2)
    expect(stat.unanswered).toBe(1)
    expect(stat.correct).toBe(1)
    expect(stat.incorrect).toBe(1)
  })

  it('takes percentCorrect over answered, not over participants', () => {
    expect(stat.percentCorrect).toBe(50)
  })

  it('builds a bar per option, lettered, with the key flagged', () => {
    expect(stat.distributionKind).toBe('choice')
    expect(stat.options.map((o) => o.label)).toEqual(['A', 'B', 'C'])
    expect(stat.options.map((o) => o.count)).toEqual([0, 1, 1])
    expect(stat.options[1].isCorrect).toBe(true)
    expect(stat.options[2].isCorrect).toBe(false)
    expect(stat.options[1].percent).toBe(50)
  })

  it('names who is in each bucket', () => {
    expect(stat.names.correct).toEqual(['Abenov'])
    expect(stat.names.incorrect).toEqual(['Borisov'])
    expect(stat.names.unanswered).toEqual(['Vlasov'])
    expect(stat.options[1].names).toEqual(['Abenov'])
  })
})

describe('buildQuestionStats — multiple choice', () => {
  it('counts every option a student picked', () => {
    const attempts = [
      attempt(1, [['q2', [0, 2]]]),  // exactly right
      attempt(2, [['q2', [0]]]),     // partial pick, graded incorrect
    ]
    const [stat] = buildQuestionStats([multi], attempts, names)
    expect(stat.options.map((o) => o.count)).toEqual([2, 0, 1])
    expect(stat.correct).toBe(1)
    expect(stat.incorrect).toBe(1)
  })
})

describe('buildQuestionStats — text answers', () => {
  it('groups case- and space-insensitively but shows the text as typed', () => {
    const attempts = [
      attempt(1, [['q3', 'Cat']]),
      attempt(2, [['q3', ' cat ']]),
      attempt(3, [['q3', 'dog']]),
    ]
    const [stat] = buildQuestionStats([short], attempts, names)
    expect(stat.distributionKind).toBe('text')
    expect(stat.options[0].text).toBe('Cat')
    expect(stat.options[0].count).toBe(2)
    expect(stat.options[0].isCorrect).toBe(true)
    expect(stat.options[0].names).toEqual(['Abenov', 'Borisov'])
    expect(stat.options[1].text).toBe('dog')
    expect(stat.options[1].count).toBe(1)
  })

  it('joins gap answers into one readable row', () => {
    const attempts = [attempt(1, [['q4', ['cat', 'hat']]])]
    const [stat] = buildQuestionStats([gaps], attempts, names)
    expect(stat.options[0].text).toBe('cat / hat')
    expect(stat.correct).toBe(1)
  })

  it('counts a half-right gap answer as partial', () => {
    const attempts = [attempt(1, [['q4', ['cat', 'bat']]])]
    const [stat] = buildQuestionStats([gaps], attempts, names)
    expect(stat.partial).toBe(1)
    expect(stat.correct).toBe(0)
    expect(stat.names.partial).toEqual(['Abenov'])
  })
})

describe('buildQuestionStats — matching', () => {
  const fullyCorrect = { __type: 'Map', data: [[0, 0], [1, 1]] }
  const halfCorrect = { __type: 'Map', data: [[0, 0], [1, 2]] }
  const empty = { __type: 'Map', data: [] }

  const attempts = [
    attempt(1, [['q6', fullyCorrect]]),
    attempt(2, [['q6', halfCorrect]]),
    attempt(3, [['q6', empty]]),
  ]
  const [stat] = buildQuestionStats([matching], attempts, names)

  it('buckets a fully-correct submission as correct and a partly-right one as partial', () => {
    expect(stat.correct).toBe(1)
    expect(stat.partial).toBe(1)
    expect(stat.names.correct).toEqual(['Abenov'])
    expect(stat.names.partial).toEqual(['Borisov'])
  })

  it('treats an empty matching map as unanswered', () => {
    expect(stat.unanswered).toBe(1)
    expect(stat.names.unanswered).toEqual(['Vlasov'])
  })

  it('has no answer distribution — a correct/partial/incorrect split only', () => {
    expect(stat.distributionKind).toBe('none')
    expect(stat.options).toEqual([])
  })

  it('treats a missing matching answer as unanswered too', () => {
    const [missingStat] = buildQuestionStats([matching], [attempt(4, [])], names)
    expect(missingStat.unanswered).toBe(1)
    expect(missingStat.options).toEqual([])
  })
})

describe('buildQuestionStats — ungradable questions', () => {
  it('marks long_text ungraded and gives it no answer distribution — essays must not be projected verbatim with names attached', () => {
    const attempts = [attempt(1, [['q5', 'Because the sky is blue.']])]
    const [stat] = buildQuestionStats([essay], attempts, names)
    expect(stat.graded).toBe(false)
    expect(stat.percentCorrect).toBeNull()
    expect(stat.distributionKind).toBe('none')
    expect(stat.options).toEqual([])
  })

  it('marks a choice question with no resolvable key ungraded rather than all-wrong', () => {
    const broken = { ...single, correct_answer: null }
    const attempts = [attempt(1, [['q1', 1]])]
    const [stat] = buildQuestionStats([broken], attempts, names)
    expect(stat.graded).toBe(false)
    expect(stat.correct).toBe(0)
    expect(stat.incorrect).toBe(0)
    expect(stat.answered).toBe(1)
  })
})

describe('buildQuestionStats — empty case', () => {
  it('reports no data instead of dividing by zero', () => {
    const [stat] = buildQuestionStats([single], [], names)
    expect(stat.participants).toBe(0)
    expect(stat.answered).toBe(0)
    expect(stat.percentCorrect).toBeNull()
    expect(stat.options.every((o) => o.count === 0 && o.percent === 0)).toBe(true)
  })
})

describe('buildClassSummary', () => {
  const questions = [single, multi]
  const attempts = [
    attempt(1, [['q1', 1], ['q2', [0, 2]]]),   // 2/2
    attempt(2, [['q1', 1], ['q2', [1]]]),      // 1/2
    attempt(3, [['q1', 0], ['q2', [1]]]),      // 0/2
  ]
  const stats = buildQuestionStats(questions, attempts, names)
  const summary = buildClassSummary(stats, [{ stepId: 0, questions, attempts }], names, [
    { student_id: 4, full_name: 'Gagarin' },
  ])

  it('scores each student over the graded questions', () => {
    expect(summary.participants).toBe(3)
    expect(summary.top[0]).toMatchObject({ fullName: 'Abenov', correct: 2, percent: 100 })
    expect(summary.bottom[0]).toMatchObject({ fullName: 'Vlasov', correct: 0, percent: 0 })
  })

  it('reports average, median, min and max', () => {
    expect(summary.averagePercent).toBe(50)
    expect(summary.medianPercent).toBe(50)
    expect(summary.minPercent).toBe(0)
    expect(summary.maxPercent).toBe(100)
  })

  it('averages the attempt time', () => {
    expect(summary.averageTimeSeconds).toBe(60)
  })

  it('always returns five score buckets that sum to the participants', () => {
    expect(summary.distribution).toHaveLength(5)
    expect(summary.distribution.map((b) => b.label)).toEqual([
      '0–19%', '20–39%', '40–59%', '60–79%', '80–100%',
    ])
    expect(summary.distribution.reduce((n, b) => n + b.count, 0)).toBe(3)
  })

  it('ranks the hardest questions first', () => {
    expect(summary.hardest[0].questionId).toBe('q2')
    expect(summary.hardest[0].percentCorrect).toBeLessThan(
      summary.hardest[1].percentCorrect,
    )
  })

  it('passes the not-submitted list through', () => {
    expect(summary.notSubmitted.map((s) => s.full_name)).toEqual(['Gagarin'])
  })

  it('averages differing times rather than echoing a shared constant', () => {
    const asymmetric = [
      { ...attempts[0], time_spent_seconds: 10 },
      { ...attempts[1], time_spent_seconds: 20 },
      { ...attempts[2], time_spent_seconds: 90 },
    ]
    const asymmetricSummary = buildClassSummary(stats, [{ stepId: 0, questions, attempts: asymmetric }], names, [])
    // Mean = 40; times[0] = 10, min = 10, max = 90 — a broken "average" landing on any
    // of those (or on the shared attempt() default of 60) would fail this.
    expect(asymmetricSummary.averageTimeSeconds).toBe(40)
  })

  it('excludes a null time_spent_seconds from the average instead of coercing it to 0', () => {
    const withNull = [
      { ...attempts[0], time_spent_seconds: 100 },
      { ...attempts[1], time_spent_seconds: null },
      { ...attempts[2], time_spent_seconds: 20 },
    ]
    const summaryWithNull = buildClassSummary(stats, [{ stepId: 0, questions, attempts: withNull }], names, [])
    // Correct: mean of [100, 20] = 60. A null-coerced-to-0 average would give (100+0+20)/3 = 40.
    expect(summaryWithNull.averageTimeSeconds).toBe(60)
  })
})

describe('buildClassSummary — score distribution buckets a gap percentage', () => {
  it('counts a 79.3% score in the 60–79% bucket, not nowhere', () => {
    // 29 gradable short-answer questions, 23 answered correctly: 23/29 = 79.3103...%,
    // which round1's to 79.3 — a value the old `>= min && <= max` comparison put in
    // neither the 60–79 nor the 80–100 bucket.
    const total = 29
    const correctCount = 23
    const gapQuestions = Array.from({ length: total }, (_, i) => ({
      id: `gq${i}`,
      question_type: 'short_answer',
      correct_answer: 'yes',
    }))
    const answers = gapQuestions.map((q, i) => [q.id, i < correctCount ? 'yes' : 'no'])
    const gapAttempts = [attempt(1, answers)]
    const gapStats = buildQuestionStats(gapQuestions, gapAttempts, names)
    const gapSummary = buildClassSummary(gapStats, [{ stepId: 0, questions: gapQuestions, attempts: gapAttempts }], names, [])

    expect(gapSummary.top[0].percent).toBeCloseTo(79.3, 5)
    expect(gapSummary.distribution.reduce((n, b) => n + b.count, 0)).toBe(
      gapSummary.participants,
    )
    const bucket = gapSummary.distribution.find((b) => b.label === '60–79%')
    expect(bucket?.count).toBe(1)
  })
})

describe('buildClassSummary — empty case', () => {
  it('nulls the averages rather than dividing by zero', () => {
    const stats = buildQuestionStats([single], [], names)
    const summary = buildClassSummary(stats, [{ stepId: 0, questions: [single], attempts: [] }], names, [])
    expect(summary.participants).toBe(0)
    expect(summary.averagePercent).toBeNull()
    expect(summary.medianPercent).toBeNull()
    expect(summary.averageTimeSeconds).toBeNull()
    expect(summary.top).toEqual([])
    expect(summary.distribution).toHaveLength(5)
  })
})

describe('accuracyBand', () => {
  it('maps percentCorrect onto the grid colours', () => {
    const at = (percentCorrect: number | null, answered = 3) =>
      ({ percentCorrect, answered } as any)
    expect(accuracyBand(at(null, 0))).toBe('none')
    expect(accuracyBand(undefined)).toBe('none')
    expect(accuracyBand(at(0))).toBe('low')
    expect(accuracyBand(at(49.9))).toBe('low')
    expect(accuracyBand(at(50))).toBe('medium')
    expect(accuracyBand(at(79.9))).toBe('medium')
    expect(accuracyBand(at(80))).toBe('high')
    expect(accuracyBand(at(100))).toBe('high')
  })
})

describe('blankGapText', () => {
  it('replaces every [[…]] gap token with a blank placeholder, never the marked answer', () => {
    expect(blankGapText('A [[cat*,dog]] and a [[hat*,bat]]')).toBe('A ____ and a ____')
  })

  it('leaves ordinary text untouched', () => {
    expect(blankGapText('No gaps here')).toBe('No gaps here')
  })

  // Regression: `.` in the token regex never matches `\n` without the `s` flag, so a gap
  // token whose contents happened to wrap onto a second line printed raw, key included.
  it('blanks a gap token even when its contents span a newline', () => {
    const withNewline = 'A [[cat*,\ndog]] day'
    expect(blankGapText(withNewline)).toBe('A ____ day')
    expect(blankGapText(withNewline)).not.toContain('*')
  })
})

describe('displayText — the pure helper ReviewQuestionView renders through', () => {
  it('blanks gap tokens in question_text, not just content_text (C1 regression)', () => {
    // Reproduces the projector leak: a fill_blank question with no content_text at all,
    // its [[cat*,dog]] key living only in question_text. ReviewQuestionView's heading reads
    // question.question_text through this exact helper.
    expect(displayText('fill_blank', gapsInQuestionText.question_text)).toBe('A ____ and a ____')
    expect(displayText('fill_blank', gapsInQuestionText.question_text)).not.toContain('*')
    expect(displayText('fill_blank', gapsInQuestionText.question_text)).not.toContain('[[')
  })

  it('blanks gap tokens in content_text too', () => {
    expect(displayText('fill_blank', gaps.content_text)).toBe('A ____ and a ____')
  })

  // displayText stays gated by question_type (content_text is shown raw for non-gap types —
  // see QuizRenderer.tsx:760). It does NOT mean question_text is left alone for non-gap
  // types in general: ReviewQuestionView's heading and buildQuestionStats's questionText
  // fallback go through blankHeading instead, which blanks unconditionally. See the
  // 'blankHeading' and regression describe blocks below for that half of the picture.
  it('leaves content_text-style callers untouched for non-gap types, asterisks and all', () => {
    expect(displayText('single_choice', 'What is 2 * 2?')).toBe('What is 2 * 2?')
  })

  it('treats a null/undefined field as empty text', () => {
    expect(displayText('fill_blank', undefined)).toBe('')
    expect(displayText('fill_blank', null)).toBe('')
  })
})

describe('blankHeading — the unconditional blanker for question_text headings', () => {
  it('replaces every [[…]] gap token with a blank placeholder, matching QuizRenderer.tsx\'s student-facing regex', () => {
    expect(blankHeading('A [[cat*,dog]] and a [[hat*,bat]]')).toBe('A ____ and a ____')
  })

  it('leaves ordinary text untouched', () => {
    expect(blankHeading('No gaps here')).toBe('No gaps here')
  })

  it('treats a null/undefined field as empty text', () => {
    expect(blankHeading(undefined)).toBe('')
    expect(blankHeading(null)).toBe('')
  })

  // [^\]]+ (unlike blankGapText's [\s\S]*?) refuses to match across a nested-bracket
  // expression, so a matrix literal keeps rendering as written instead of collapsing to a
  // single ____.
  it('does not match across nested brackets, e.g. a matrix literal', () => {
    expect(blankHeading('[[a,b],[c,d]]')).toBe('[[a,b],[c,d]]')
  })

  // Item 1's core regression: blankHeading blanks by looking at the text, not the type —
  // unlike displayText/isGapType, it must blank a gap token in question_text even when
  // question_type is something other than fill_blank/text_completion.
  it('blanks [[…*…]] tokens in question_text even when question_type is not a gap type', () => {
    expect(blankHeading(gapsInQuestionTextWrongType.question_text)).toBe('A ____ and a ____')
    expect(blankHeading(gapsInQuestionTextWrongType.question_text)).not.toContain('*')
    expect(blankHeading(gapsInQuestionTextWrongType.question_text)).not.toContain('[[')
  })
})

describe('buildQuestionStats — gap question text falls back to the blanked source, never the answer key', () => {
  it('never leaks the [[…*…]] gap syntax into questionText', () => {
    const [stat] = buildQuestionStats([gaps], [], names)
    expect(stat.questionText).toBe('A ____ and a ____')
    expect(stat.questionText).not.toContain('*')
    expect(stat.questionText).not.toContain('[[')
  })

  // C1 regression: when the gap syntax lives in question_text instead, it used to win the
  // `||` fallback unblanked and reach the finish screen's "Hardest questions" list raw.
  it('never leaks the [[…*…]] gap syntax into questionText when the gaps live in question_text', () => {
    const [stat] = buildQuestionStats([gapsInQuestionText], [], names)
    expect(stat.questionText).toBe('A ____ and a ____')
    expect(stat.questionText).not.toContain('*')
    expect(stat.questionText).not.toContain('[[')
  })

  // Item 1 regression: the non-gap-type branch of the questionText fallback used to be
  // gated by isGapType(type) and pass question_text through raw, so a converted/mistyped
  // question whose question_type isn't a gap type but whose question_text still carries
  // [[…*…]] tokens leaked the key into the "Hardest questions" list on the finish screen.
  it('never leaks the [[…*…]] gap syntax into questionText when question_type is not a gap type', () => {
    const [stat] = buildQuestionStats([gapsInQuestionTextWrongType], [], names)
    expect(stat.questionText).toBe('A ____ and a ____')
    expect(stat.questionText).not.toContain('*')
    expect(stat.questionText).not.toContain('[[')
  })
})

describe('splitPipeAnswers', () => {
  it('splits a pipe-delimited correct_answer into a readable, trimmed list', () => {
    expect(splitPipeAnswers({ correct_answer: 'paris | Paris|the capital ' })).toEqual([
      'paris', 'Paris', 'the capital',
    ])
  })

  it('returns an empty list when there is nothing to split', () => {
    expect(splitPipeAnswers({ correct_answer: null })).toEqual([])
    expect(splitPipeAnswers({})).toEqual([])
  })
})

describe('isCorrectOption', () => {
  it('agrees with gradeQuestion for single_choice, including its strict equality', () => {
    expect(isCorrectOption(single, 1)).toBe(true)
    expect(isCorrectOption(single, 2)).toBe(false)
  })

  it('does not disagree with gradeQuestion when correct_answer is authored as a numeric string', () => {
    // gradeQuestion's fallback path is a strict `===`, so a stored option index (a number)
    // never matches a correct_answer authored as the string "1" -- every student is graded
    // incorrect. The old coercing `Number(key) === index` would paint option B green here,
    // contradicting the score the whole class actually received.
    const stringKeyed = { ...single, correct_answer: '1' }
    expect(isCorrectOption(stringKeyed, 1)).toBe(false)
  })

  it('agrees with gradeQuestion for multiple_choice by reusing its own membership test', () => {
    expect(isCorrectOption(multi, 0)).toBe(true)
    expect(isCorrectOption(multi, 1)).toBe(false)
    expect(isCorrectOption(multi, 2)).toBe(true)
  })
})

describe('buildClassSummary — partial credit on multi-gap questions (I6)', () => {
  it('credits a half-right gap answer with partial credit, matching the score the student saw on submission', () => {
    const questions = [gaps]
    const attempts = [attempt(1, [['q4', ['cat', 'bat']]])] // 1 of 2 gaps correct
    const stats = buildQuestionStats(questions, attempts, names)
    const summary = buildClassSummary(stats, [{ stepId: 0, questions, attempts }], names, [])
    // An all-or-nothing scoring (gradeQuestion(...).isCorrect per question) would count
    // this as 0/1 = 0%. Scored gap-by-gap, like the student's own result screen, it is
    // 1/2 = 50%.
    expect(summary.top[0]).toMatchObject({ correct: 1, total: 2, percent: 50 })
  })

  it('still scores non-gap questions all-or-nothing, one part per question', () => {
    const questions = [single, multi]
    const attempts = [
      attempt(1, [['q1', 1], ['q2', [0, 2]]]),
      attempt(2, [['q1', 1], ['q2', [1]]]),
    ]
    const stats = buildQuestionStats(questions, attempts, names)
    const summary = buildClassSummary(stats, [{ stepId: 0, questions, attempts }], names, [])
    expect(summary.top[0]).toMatchObject({ correct: 2, total: 2, percent: 100 })
  })
})

describe('buildQuestionStats — per-gap stats (gap stepper)', () => {
  it('counts correct/incorrect/unanswered per gap, independently of the other gaps', () => {
    const attempts = [
      attempt(1, [['q9', ['cat', 'mat', 'door']]]),   // all three correct
      attempt(2, [['q9', ['cat', 'rug', 'door']]]),   // gap 2 (mat) wrong
      attempt(3, [['q9', ['dog', 'mat', 'window']]]), // gaps 1 and 3 wrong
    ]
    const [stat] = buildQuestionStats([threeGaps], attempts, names)
    expect(stat.gaps).toHaveLength(3)

    expect(stat.gaps[0]).toMatchObject({ answered: 3, correct: 2, incorrect: 1, unanswered: 0 })
    expect(stat.gaps[1]).toMatchObject({ answered: 3, correct: 2, incorrect: 1, unanswered: 0 })
    expect(stat.gaps[2]).toMatchObject({ answered: 3, correct: 2, incorrect: 1, unanswered: 0 })

    // The class-wide correct/incorrect/partial split (whole-question stats) is untouched by
    // any of this — still computed from gradeQuestion's aggregate verdict per student.
    expect(stat.correct).toBe(1) // only student 1 got every gap right
    expect(stat.partial).toBe(2)
  })

  it('treats a gap array shorter than the expected list as unanswered for the missing gaps, not wrong', () => {
    const attempts = [
      attempt(1, [['q9', ['cat', 'mat', 'door']]]), // full answer
      attempt(2, [['q9', ['cat', 'mat']]]),         // third gap missing entirely
    ]
    const [stat] = buildQuestionStats([threeGaps], attempts, names)
    expect(stat.gaps[0]).toMatchObject({ answered: 2, correct: 2, incorrect: 0, unanswered: 0 })
    expect(stat.gaps[1]).toMatchObject({ answered: 2, correct: 2, incorrect: 0, unanswered: 0 })
    // Gap 3 (door): student 2's array has no third entry.
    expect(stat.gaps[2]).toMatchObject({ answered: 1, correct: 1, incorrect: 0, unanswered: 1 })
    expect(stat.gaps[2].names.unanswered).toEqual(['Borisov'])
  })

  it('fill_blank: lists every option offered by the gap token, in token order, including one nobody chose', () => {
    const attempts = [
      attempt(1, [['q9', ['Cat', 'mat', 'door']]]),
      attempt(2, [['q9', [' cat ', 'mat', 'door']]]),
      attempt(3, [['q9', ['dog', 'mat', 'door']]]),
    ]
    const [stat] = buildQuestionStats([threeGaps], attempts, names)
    const gap0 = stat.gaps[0]
    // Token order ('cat' offered before 'dog'), authored option text — not the typed casing
    // ('Cat') and not sorted by count (this fixture's counts happen to agree with token
    // order; the ordering asserted here is token order, not a count sort).
    expect(gap0.options.map((o) => o.text)).toEqual(['cat', 'dog'])
    expect(gap0.options[0].count).toBe(2)
    expect(gap0.options[0].isCorrect).toBe(true)
    expect(gap0.options[0].names).toEqual(['Abenov', 'Borisov'])
    expect(gap0.options[1].text).toBe('dog')
    expect(gap0.options[1].count).toBe(1)
    expect(gap0.options[1].isCorrect).toBe(false)

    // Gap 2 ('mat*,rug'): every attempt typed 'mat', so the offered 'rug' option nobody
    // picked must still appear — count 0, percent 0 — the same "show every option" the
    // single_choice bars already give a wrong distractor nobody chose.
    const gap1 = stat.gaps[1]
    expect(gap1.options.map((o) => o.text)).toEqual(['mat', 'rug'])
    expect(gap1.options[1]).toMatchObject({ count: 0, percent: 0, isCorrect: false })
  })

  it('fill_blank: a submitted answer not among the offered options still gets its own row, after the offered ones', () => {
    const attempts = [
      attempt(1, [['q9', ['cat', 'mat', 'door']]]),
      attempt(2, [['q9', ['mouse', 'mat', 'door']]]), // not one of the gap's own options
    ]
    const [stat] = buildQuestionStats([threeGaps], attempts, names)
    const gap0 = stat.gaps[0]
    // Offered options ('cat', 'dog') come first, in token order; the stray 'mouse' answer
    // is appended after them rather than silently dropped.
    expect(gap0.options.map((o) => o.text)).toEqual(['cat', 'dog', 'mouse'])
    expect(gap0.options[2]).toMatchObject({ count: 1, isCorrect: false })
    expect(gap0.options[2].names).toEqual(['Borisov'])
  })

  it('fill_blank: still lists its options, all-zero, when nobody submitted anything for this gap', () => {
    const attempts = [
      attempt(1, [['q9', ['cat', 'mat']]]), // nobody ever fills gap 3
      attempt(2, [['q9', ['cat', 'rug']]]),
    ]
    const [stat] = buildQuestionStats([threeGaps], attempts, names)
    const gap2 = stat.gaps[2]
    expect(gap2.answered).toBe(0)
    expect(gap2.unanswered).toBe(2)
    expect(gap2.correct).toBe(0)
    expect(gap2.incorrect).toBe(0)
    expect(gap2.percentCorrect).toBeNull()
    // The old behaviour collapsed this to []; the fix still lists the gap's own options
    // ('door', 'window') with all-zero counts, so the teacher can discuss the question even
    // though nobody answered.
    expect(gap2.options.map((o) => o.text)).toEqual(['door', 'window'])
    expect(gap2.options.every((o) => o.count === 0 && o.percent === 0)).toBe(true)
    expect(gap2.options[0].isCorrect).toBe(true)
    expect(gap2.options[1].isCorrect).toBe(false)
    expect(gap2.names.unanswered).toEqual(['Abenov', 'Borisov'])
  })

  it('text_completion: keeps typed-answer rows, most common first, and does not gain option rows', () => {
    const attempts = [
      attempt(1, [['q10', ['Cat', 'mat', 'door']]]),
      attempt(2, [['q10', [' cat ', 'mat', 'door']]]),
      attempt(3, [['q10', ['dog', 'mat', 'door']]]),
    ]
    const [stat] = buildQuestionStats([threeGapsTyped], attempts, names)
    const gap0 = stat.gaps[0]
    // Typed casing preserved (first occurrence wins), most common first — unchanged from
    // before this fix. No 'rug'-style zero-count option row appears: text_completion has no
    // option list to draw one from.
    expect(gap0.options.map((o) => o.text)).toEqual(['Cat', 'dog'])
    expect(gap0.options[0].count).toBe(2)
    expect(gap0.options[0].isCorrect).toBe(true)
    expect(gap0.options[0].names).toEqual(['Abenov', 'Borisov'])
    expect(gap0.options[1].text).toBe('dog')
    expect(gap0.options[1].count).toBe(1)
    expect(gap0.options[1].isCorrect).toBe(false)
  })

  it('marks every gap unanswered when the whole cloze was left blank, without needing to replay/grade it', () => {
    const attempts = [attempt(1, [])] // never touched q9 at all
    const [stat] = buildQuestionStats([threeGaps], attempts, names)
    expect(stat.gaps.every((g) => g.unanswered === 1 && g.answered === 0)).toBe(true)
  })

  it('gives non-gap questions an empty gaps array', () => {
    const [stat] = buildQuestionStats([single], [], names)
    expect(stat.gaps).toEqual([])
  })

  it('keeps the whole-question distribution (joined "cat / hat" row) unchanged alongside the new per-gap breakdown', () => {
    // Regression: the per-gap stats are additive, not a replacement of the existing
    // whole-question text-row behaviour (reviewStats.ts:242-245's join(' / ')).
    const attempts = [attempt(1, [['q4', ['cat', 'hat']]])]
    const [stat] = buildQuestionStats([gaps], attempts, names)
    expect(stat.options[0].text).toBe('cat / hat')
    expect(stat.gaps).toHaveLength(2)
    expect(stat.gaps[0]).toMatchObject({ correct: 1, incorrect: 0, unanswered: 0 })
    expect(stat.gaps[1]).toMatchObject({ correct: 1, incorrect: 0, unanswered: 0 })
  })
})

describe('gradeQuestion — aggregate return values unchanged by the partResults addition (scoring.ts regression guard)', () => {
  it('image_content: unchanged', () => {
    expect(gradeQuestion({ question_type: 'image_content' }, undefined, undefined)).toEqual({
      isCorrect: true, correctParts: 0, totalParts: 0, isReview: false,
    })
  })

  it('fill_blank / text_completion: isCorrect/correctParts/totalParts/isReview unchanged; partResults is additive only', () => {
    const full = gradeQuestion(gaps, undefined, ['cat', 'bat'])
    expect(full).toMatchObject({ isCorrect: false, correctParts: 1, totalParts: 2, isReview: false })
    expect(full.partResults).toEqual([true, false])

    const allCorrect = gradeQuestion(gaps, undefined, ['cat', 'hat'])
    expect(allCorrect).toMatchObject({ isCorrect: true, correctParts: 2, totalParts: 2, isReview: false })

    const none = gradeQuestion(gaps, undefined, [])
    expect(none).toMatchObject({ isCorrect: false, correctParts: 0, totalParts: 2, isReview: false })
  })

  it('long_text: unchanged, including the isSpecialGroupStudent review path', () => {
    expect(gradeQuestion(essay, 'an answer', undefined)).toEqual({
      isCorrect: true, correctParts: 1, totalParts: 1, isReview: false,
    })
    expect(gradeQuestion(essay, '', undefined)).toEqual({
      isCorrect: false, correctParts: 0, totalParts: 1, isReview: false,
    })
    expect(gradeQuestion(essay, 'an answer', undefined, { isSpecialGroupStudent: true })).toEqual({
      isCorrect: false, correctParts: 0, totalParts: 0, isReview: true,
    })
  })

  it('short_answer: unchanged', () => {
    expect(gradeQuestion(short, 'cat', undefined)).toEqual({
      isCorrect: true, correctParts: 1, totalParts: 1, isReview: false,
    })
    expect(gradeQuestion(short, 'dog', undefined)).toEqual({
      isCorrect: false, correctParts: 0, totalParts: 1, isReview: false,
    })
  })

  it('multiple_choice: unchanged', () => {
    expect(gradeQuestion(multi, [0, 2], undefined)).toEqual({
      isCorrect: true, correctParts: 1, totalParts: 1, isReview: false,
    })
    expect(gradeQuestion(multi, [0], undefined)).toEqual({
      isCorrect: false, correctParts: 0, totalParts: 1, isReview: false,
    })
  })

  it('matching: unchanged', () => {
    const fullyCorrect = new Map([[0, 0], [1, 1]])
    expect(gradeQuestion(matching, fullyCorrect, undefined)).toEqual({
      isCorrect: true, correctParts: 2, totalParts: 2, isReview: false,
    })
  })

  it('single_choice / default fallback branch: unchanged', () => {
    expect(gradeQuestion(single, 1, undefined)).toEqual({
      isCorrect: true, correctParts: 1, totalParts: 1, isReview: false,
    })
    expect(gradeQuestion(single, 2, undefined)).toEqual({
      isCorrect: false, correctParts: 0, totalParts: 1, isReview: false,
    })
  })

  it('null question: unchanged', () => {
    expect(gradeQuestion(null, undefined, undefined)).toEqual({
      isCorrect: false, correctParts: 0, totalParts: 0, isReview: false,
    })
  })
})

// wholeQuestionRevealed is C1's fix, extracted (#F1): the JSX condition that stops a
// whole-question figure (percentCorrect, the name lists, the explanation) from disclosing an
// answer before the class has reached the LAST gap of a cloze. This repo has no jsdom, so
// this is the only place this predicate gets exercised at all — see #F5.
describe('wholeQuestionRevealed', () => {
  it('non-gap question: follows the raw revealed flag either way', () => {
    expect(wholeQuestionRevealed(false, 0, 0, true)).toBe(true)
    expect(wholeQuestionRevealed(false, 0, 0, false)).toBe(false)
  })

  it('gap question, not revealed at all: false regardless of position', () => {
    expect(wholeQuestionRevealed(true, 0, 3, false)).toBe(false)
    expect(wholeQuestionRevealed(true, 2, 3, false)).toBe(false)
  })

  it('gap question mid-sequence, revealed: still false -- later gaps have not been shown yet', () => {
    // 3-gap cloze, currently on gap 1 (index 0) or gap 2 (index 1) of 3 -- neither is the
    // last gap, so the whole-question verdict must stay hidden even though `revealed` is
    // true for the CURRENT gap. This is exactly the boundary C1 exists to protect.
    expect(wholeQuestionRevealed(true, 0, 3, true)).toBe(false)
    expect(wholeQuestionRevealed(true, 1, 3, true)).toBe(false)
  })

  it('gap question at the last gap, revealed: true', () => {
    expect(wholeQuestionRevealed(true, 2, 3, true)).toBe(true)
  })

  it('gapTotal === 0: collapses to the plain revealed check, like the non-gap case (#F2)', () => {
    // A gap-type question with no locatable gaps must not gate on `gapIndex === gapTotal - 1`
    // (0 === -1, unreachable) and hide whole-question content forever.
    expect(wholeQuestionRevealed(true, 0, 0, true)).toBe(true)
    expect(wholeQuestionRevealed(true, 0, 0, false)).toBe(false)
  })
})

// Question ids are NOT unique across the quiz steps of one unit (verified in production:
// lesson 134 has two quiz steps sharing 5 identical question ids). questionKey and
// buildQuestionStats's `key` field are what let a caller merge more than one step's stats
// into one Record without one step's entry silently overwriting another's same-id entry.
describe('questionKey / buildQuestionStats — composite (step, question) identity', () => {
  it('two different steps produce different keys for the same raw question id', () => {
    const q = { id: 'q1', question_type: 'short_answer', correct_answer: 'x' }
    expect(questionKey('stepA', q)).not.toBe(questionKey('stepB', q))
  })

  it('buildQuestionStats tags each stat with its own stepId and a matching composite key', () => {
    const q = { id: 'q1', question_type: 'short_answer', correct_answer: 'x' }
    const [statA] = buildQuestionStats([q], [], names, 'stepA')
    const [statB] = buildQuestionStats([q], [], names, 'stepB')
    expect(statA.stepId).toBe('stepA')
    expect(statA.key).toBe(questionKey('stepA', q))
    expect(statB.key).toBe(questionKey('stepB', q))
    expect(statA.key).not.toBe(statB.key)
    // The raw, non-composite id is still exposed (questionId) for display purposes, and IS
    // expected to collide -- that's the whole point of the fixture.
    expect(statA.questionId).toBe(statB.questionId)
  })

  it('merging two steps\' stats into one Record by `key` keeps both entries distinct -- this is the collision the whole feature exists to avoid', () => {
    // Two DIFFERENT questions that happen to share id 'q1', each with its own attempts and
    // its own correct answer -- exactly lesson 134's shape, minimised.
    const stepAQuestion = { id: 'q1', question_type: 'short_answer', correct_answer: 'red' }
    const stepBQuestion = { id: 'q1', question_type: 'short_answer', correct_answer: 'blue' }
    const stepAAttempts = [attempt(1, [['q1', 'red']])]  // correct for step A
    const stepBAttempts = [attempt(1, [['q1', 'red']])]  // WRONG for step B (key is 'blue')

    const statsA = buildQuestionStats([stepAQuestion], stepAAttempts, names, 'stepA')
    const statsB = buildQuestionStats([stepBQuestion], stepBAttempts, names, 'stepB')

    const merged: Record<string, ReturnType<typeof buildQuestionStats>[number]> = {}
    ;[...statsA, ...statsB].forEach((stat) => { merged[stat.key] = stat })

    // Against a `String(question.id)`-only implementation, questionKey collapses both
    // entries to the same 'q1' string and this assertion is exactly what fails (see the
    // collision-revert demonstration in useReviewSession.test.ts for the full failure output
    // reproduced against that implementation).
    expect(Object.keys(merged)).toHaveLength(2)
    expect(merged[statsA[0].key].percentCorrect).toBe(100) // step A: 'red' is correct
    expect(merged[statsB[0].key].percentCorrect).toBe(0)   // step B: 'red' is wrong ('blue' is the key)
  })
})
