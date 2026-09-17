// The score a student sees («Correct / Incorrect / Total», saved as correct_answers/total_questions)
// against what the review marks incorrect. Reported: a quiz at 40/45 (5 lost) marked only 4 answers
// incorrect; a unit-3 quiz at 14/17 (3 lost) marked only 2. The review draws gap marks from
// gapMarks and badges / navigator squares from getQuestionStatus, so counting those here counts what
// the student sees.
import { describe, expect, it } from 'vitest'
import {
  gapMarks,
  getQuestionStatus,
  gradeQuestion,
  isAnswerComplete,
  scoreQuiz,
  visibleIncorrectItems,
} from './scoring'

type Answers = Record<string, unknown>

function tally(questions: any[], answers: Answers) {
  const answerFor = (q: any) => answers[String(q.id)]
  const gapsFor = (q: any) => answers[String(q.id)] as string[] | undefined
  const stats = scoreQuiz(questions, answerFor, gapsFor)
  const total = stats.totalGaps + stats.regularQuestions
  const correct = stats.correctGaps + stats.correctRegular
  return { total, correct, incorrect: total - correct, marked: visibleIncorrectItems(questions, answerFor, gapsFor) }
}

// Every way the score and the review drifted apart, in one quiz.
const quiz = [
  { id: 1, question_type: 'fill_blank', content_text: 'The [[cat*, dog]] sat on the [[mat*, hat]] by the [[door*, floor]].' },
  // text_completion keeps its key in the tokens; correct_answer was never filled in.
  { id: 2, question_type: 'text_completion', content_text: 'Paris is in [[France*]] and Berlin in [[Germany*]].' },
  // Two gaps, but a stale three-entry correct_answer made the answer array three long.
  { id: 3, question_type: 'fill_blank', content_text: '[[a*, b]] and [[c*, d]]', correct_answer: ['a', 'c', 'x'] },
  {
    id: 4, question_type: 'matching',
    matching_pairs: [{ left: 'one', right: '1' }, { left: 'two', right: '2' }, { left: 'three', right: '3' }],
  },
  { id: 5, question_type: 'image_content', media_url: '/uploads/map.png' },
  { id: 6, question_type: 'single_choice', correct_answer: 1, options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] },
]

const answers: Answers = {
  1: ['cat', 'hat', ''],             // one wrong, one left empty
  2: ['Spain', 'Germany'],           // one wrong
  3: ['a', 'c', ''],                 // both visible gaps right; a third, invisible slot
  4: new Map([[0, 0], [1, 2], [2, 1]]), // one of three pairs right
  6: 2,                              // wrong option
}

describe('the «Incorrect» count is what the review marks incorrect', () => {
  it('counts one lost item per visibly marked item across every question type', () => {
    const { total, correct, incorrect, marked } = tally(quiz, answers)
    expect(marked).toBe(incorrect)
    // 3 + 2 + 2 visible gaps, plus the matching and choice questions.
    expect({ total, correct }).toEqual({ total: 9, correct: 4 })
  })

  it('reproduces 40/45 with four marks: one gap costs a point without a mark', () => {
    // 44 clean items (4 of them wrong) plus one gap the review never marks.
    const clean = Array.from({ length: 22 }, (_, i) => ({
      id: 100 + i, question_type: 'fill_blank', content_text: '[[x*, y]] [[p*, q]]',
    }))
    const given: Answers = Object.fromEntries(clean.map((q, i) => [q.id, i < 4 ? ['y', 'p'] : ['x', 'p']]))
    const withBlank = [...clean, { id: 999, question_type: 'fill_blank', content_text: '[[m*, n]]' }]
    given[999] = ['']
    const { total, correct, incorrect, marked } = tally(withBlank, given)
    expect({ total, correct }).toEqual({ total: 45, correct: 40 })
    expect(marked).toBe(incorrect)
  })
})

describe('each drift, on its own', () => {
  it('an empty gap is marked incorrect, because it is scored incorrect', () => {
    expect(gapMarks(quiz[0], answers[1] as string[]).marks).toEqual(['correct', 'incorrect', 'incorrect'])
  })

  it('text_completion marks against the tokens, the key the score uses', () => {
    expect(gapMarks(quiz[1], answers[2] as string[])).toEqual({
      expected: ['France', 'Germany'], marks: ['incorrect', 'correct'],
    })
  })

  it('an answer array longer than the gaps on screen scores only the gaps on screen', () => {
    expect(gradeQuestion(quiz[2], undefined, ['a', 'c', ''])).toMatchObject({
      isCorrect: true, correctParts: 2, totalParts: 2, partResults: [true, true],
    })
  })

  it('a partly right matching question is lost whole, and its badge says so', () => {
    expect(gradeQuestion(quiz[3], answers[4], undefined).isCorrect).toBe(false)
    const status = getQuestionStatus(quiz[3], answers[4], undefined)
    expect(status.key).toBe('incorrect')
    expect(status.label).toBe('Incorrect · 1/3 pairs')
  })

  it('matching entries for pairs that no longer exist do not make a question correct', () => {
    const twoPairs = { question_type: 'matching', matching_pairs: [{}, {}] }
    expect(gradeQuestion(twoPairs, new Map([[0, 0], [1, 0], [5, 5]]), undefined)).toMatchObject({
      isCorrect: false, correctParts: 1, totalParts: 2,
    })
  })

  it('an image block is neither scored nor marked incorrect', () => {
    expect(getQuestionStatus(quiz[4], undefined, undefined).key).toBe('unscored')
  })

  it('a cleared choice (-1) is not an answer', () => {
    expect(isAnswerComplete(quiz[5], -1, undefined)).toBe(false)
    expect(isAnswerComplete(quiz[5], 0, undefined)).toBe(true)
    expect(isAnswerComplete({ question_type: 'multiple_choice', correct_answer: [0, 2] }, [0, -1], undefined)).toBe(false)
  })

  it('a gap question counts every gap on screen as unanswered until each is filled', () => {
    expect(isAnswerComplete(quiz[0], undefined, ['cat', 'mat'])).toBe(false)
    expect(isAnswerComplete(quiz[0], undefined, ['cat', 'mat', 'door'])).toBe(true)
    expect(isAnswerComplete(quiz[2], undefined, ['a', 'c', ''])).toBe(true)
  })
})
