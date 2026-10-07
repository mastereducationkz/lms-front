// Every user-facing string in review mode. Components import from here — no inline copy,
// so the wording stays consistent across the launcher, presenter, grid and summary.
// The copy lives in the quizReview catalog (src/lib/i18n/{en,ru}/quizReview.ts); each `EN.<name>`
// read looks it up in the signed-in user's language (the name is from when review was English-only).
import { t, type MessageKey } from '@/lib/i18n'
import '@/lib/i18n/catalogs/quizReview'

const KEYS = {
  pageTitle: 'quizReview.launcher.title',
  subtitle: 'quizReview.launcher.subtitle',

  courseLabel: 'quizReview.launcher.course',
  groupLabel: 'quizReview.launcher.group',
  unitLabel: 'quizReview.launcher.unit',
  quizLabel: 'quizReview.launcher.quiz',
  selectCourse: 'quizReview.launcher.selectCourse',
  selectGroup: 'quizReview.launcher.selectGroup',
  selectUnit: 'quizReview.launcher.selectUnit',
  selectQuiz: 'quizReview.launcher.selectQuiz',
  start: 'quizReview.launcher.start',
  // Shown on the same button as `start` once a unit is picked but no specific quiz is — so
  // the teacher is never surprised by which one Start is about to do.
  startUnit: 'quizReview.launcher.startUnit',

  questions: 'quizReview.count.questions',
  submitted: 'quizReview.count.submitted',
  students: 'quizReview.count.students',
  completed: 'quizReview.count.completed',

  questionOf: 'quizReview.presenter.questionOf',
  revealAnswer: 'quizReview.presenter.revealAnswer',
  hideAnswer: 'quizReview.presenter.hideAnswer',
  showStats: 'quizReview.presenter.showStats',
  hideStats: 'quizReview.presenter.hideStats',
  showNames: 'quizReview.presenter.showNames',
  hideNames: 'quizReview.presenter.hideNames',
  namesAfterReveal: 'quizReview.presenter.namesAfterReveal',
  questionList: 'quizReview.presenter.questionList',
  next: 'quizReview.presenter.next',
  prev: 'quizReview.presenter.prev',
  finish: 'quizReview.presenter.finish',
  exit: 'quizReview.presenter.exit',
  restart: 'quizReview.presenter.restart',

  correctAnswer: 'quizReview.answer.correctAnswer',
  explanation: 'quizReview.answer.explanation',
  answered: 'quizReview.answer.answered',
  noAnswer: 'quizReview.answer.noAnswer',
  correct: 'quizReview.answer.correct',
  partial: 'quizReview.answer.partial',
  incorrect: 'quizReview.answer.incorrect',
  percentCorrect: 'quizReview.answer.percentCorrect',
  answerDistribution: 'quizReview.answer.distribution',
  whoAnswered: 'quizReview.answer.whoAnswered',
  notGraded: 'quizReview.answer.notGraded',
  otherAnswers: 'quizReview.answer.otherAnswers',

  gapOf: 'quizReview.gap.of',
  gapChoices: 'quizReview.gap.choices',
  gapPrev: 'quizReview.gap.prev',
  gapNext: 'quizReview.gap.next',
  gapAnsweredOf: 'quizReview.gap.answeredOf',
  gapBreakdown: 'quizReview.gap.breakdown',
  gapNoAnswer: 'quizReview.gap.noAnswer',

  // What a question was answered from: the quiz's audio, document or passage, a map between
  // questions, a media question's attachment.
  materialAudio: 'quizReview.material.audio',
  materialDocument: 'quizReview.material.document',
  materialPassage: 'quizReview.material.passage',
  materialImage: 'quizReview.material.image',
  materialImages: 'quizReview.material.images',
  materialShow: 'quizReview.material.show',
  materialHide: 'quizReview.material.hide',
  questionImage: 'quizReview.material.questionImage',
  questionDocument: 'quizReview.material.questionDocument',
  optionImage: 'quizReview.material.optionImage',
  mediaUnavailable: 'quizReview.material.unavailable',
  openFile: 'quizReview.material.openFile',

  summaryTitle: 'quizReview.summary.title',
  summaryDistribution: 'quizReview.summary.distribution',
  summaryTop: 'quizReview.summary.top',
  summaryBottom: 'quizReview.summary.bottom',
  summaryHardest: 'quizReview.summary.hardest',
  summaryNotSubmitted: 'quizReview.summary.notSubmitted',
  notSubmittedCount: 'quizReview.summary.notSubmittedCount',
  anonymousStudent: 'quizReview.summary.anonymousStudent',
  averageScore: 'quizReview.summary.average',
  medianScore: 'quizReview.summary.median',
  minScore: 'quizReview.summary.lowest',
  maxScore: 'quizReview.summary.highest',
  averageTime: 'quizReview.summary.averageTime',
  minutesShort: 'quizReview.summary.minutesShort',

  worthReviewingTitle: 'quizReview.worth.title',
  worthReviewingSubtitle: 'quizReview.worth.subtitle',
  worthReviewingSubmittedOf: 'quizReview.worth.submittedOf',
  worthReviewingAvgOf: 'quizReview.worth.avgOf',
  worthReviewingMore: 'quizReview.worth.more',
  worthReviewingEmpty: 'quizReview.worth.empty',
  worthReviewingNoAverages: 'quizReview.worth.noAverages',

  noData: 'quizReview.state.noData',
  noQuizzes: 'quizReview.state.noQuizzes',
  noSubmissions: 'quizReview.state.noSubmissions',
  loading: 'quizReview.state.loading',
  loadError: 'quizReview.state.loadError',
  accessDenied: 'quizReview.state.accessDenied',
  retry: 'quizReview.state.retry',
  // Two variants: `[ ] step gap` only does anything on a gap question (ReviewPresenter gates
  // those keys on isGapQuestion), so the hint only advertises it there — see keyboardHintGap.
  keyboardHint: 'quizReview.presenter.keyboardHint',
  keyboardHintGap: 'quizReview.presenter.keyboardHintGap',
} as const satisfies Record<string, MessageKey>

export const EN = Object.defineProperties(
  {} as { readonly [Name in keyof typeof KEYS]: string },
  Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, { get: () => t(key), enumerable: true }])),
)

/** format(EN.questionOf, { n: 3, total: 22 }) -> 'Question 3 of 22' */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  )
}

// Readable labels for the question-type badge on the presenter — the raw slug
// (`media_open_question`) is an implementation detail, not something to project on screen.
export const QUESTION_TYPE_LABELS: Record<string, MessageKey> = {
  single_choice: 'quizReview.questionType.singleChoice',
  multiple_choice: 'quizReview.questionType.multipleChoice',
  short_answer: 'quizReview.questionType.shortAnswer',
  fill_blank: 'quizReview.questionType.fillBlank',
  text_completion: 'quizReview.questionType.textCompletion',
  long_text: 'quizReview.questionType.longText',
  media_question: 'quizReview.questionType.mediaQuestion',
  media_open_question: 'quizReview.questionType.mediaOpenQuestion',
  matching: 'quizReview.questionType.matching',
  image_content: 'quizReview.questionType.imageContent',
}

export function questionTypeLabel(type: string | undefined): string {
  if (!type) return ''
  return QUESTION_TYPE_LABELS[type] ? t(QUESTION_TYPE_LABELS[type]) : type
}
