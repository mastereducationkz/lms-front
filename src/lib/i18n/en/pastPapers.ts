import type { MessageTable } from '../types';

/**
 * SAT past papers as homework: the builder's picker, the student's task card, the teacher's review
 * panel, the group grid and the student-report block. Every scaled score is the SAT platform's
 * ESTIMATE and carries that word; none of it is ever used to rank students.
 */
export const pastPapers = {
  'pastPapers.partial': 'Partial',
  'pastPapers.prediction': 'Prediction',

  'pastPapers.taskType.label': 'SAT past paper',
  'pastPapers.taskType.hint': 'A full practice test from the SAT platform',

  'pastPapers.builder.dueDateRequired': 'Set a due date: a homework with a SAT past paper needs one, because the SAT platform shows the answers only after it.',

  'pastPapers.builder.paperRequired': 'Pick a SAT past paper for task {number}.',

  'pastPapers.picker.search': 'Search past papers',
  'pastPapers.picker.listLabel': 'SAT past papers',
  'pastPapers.picker.loading': 'Loading the SAT past papers…',
  'pastPapers.picker.noMatch': 'No past paper matches the search',
  'pastPapers.picker.unavailable': "The SAT paper list can't be loaded right now.",
  'pastPapers.picker.retry': 'Try again',
  'pastPapers.picker.chooseGroups': 'Choose the groups first to see who has already done each paper.',
  'pastPapers.picker.testDate': 'Test date {date}',
  'pastPapers.picker.alreadyDone': 'already done by {done} of {total}',
  'pastPapers.picker.inProgress': 'in progress: {count}',

  'pastPapers.state.notStarted': 'Not started',
  'pastPapers.state.inProgress': 'In progress',
  'pastPapers.state.completed': 'Done',
  'pastPapers.state.resetWaiting': 'Reset on SAT',

  'pastPapers.score.estimate': '≈{score} (estimate)',
  'pastPapers.score.rw': 'RW {correct}/{total}',
  'pastPapers.score.math': 'Math {correct}/{total}',
  'pastPapers.score.partial': 'Correct {correct}/{total}',

  'pastPapers.card.untitled': 'SAT past paper',
  'pastPapers.card.checking': 'Checking the paper…',
  'pastPapers.card.statusFailed': "Couldn't check this paper's status right now. You can still open it.",
  'pastPapers.card.retry': 'Retry',
  'pastPapers.card.start': 'Start on SAT',
  'pastPapers.card.continue': 'Continue on SAT',
  'pastPapers.card.results': 'See results',
  'pastPapers.card.doneBefore': 'Done before it was assigned ({date})',
  'pastPapers.card.inProgressSince': 'In progress on the platform since {date}',
  'pastPapers.card.resetWaiting': 'Reset on SAT — waiting for a new attempt',
  'pastPapers.card.cantOpen': "Can't open it? Tell your curator",
  'pastPapers.card.selfSubmits': 'This homework submits itself when you finish the paper',

  'pastPapers.review.notDone': 'Paper not done yet',
  'pastPapers.review.inProgressSince': 'Paper not finished: in progress on the platform since {date}',
  'pastPapers.review.statusFailed': "Couldn't read this paper's result from the SAT platform right now.",
  'pastPapers.review.completedOn': 'Finished {date}',
  'pastPapers.review.beforeAssigned': 'done before it was assigned',
  'pastPapers.review.weakest': 'Weakest topics',
  'pastPapers.review.domainLine': '{domain}: {correct}/{total}',
  'pastPapers.review.openFull': 'Open full review on SAT',
  'pastPapers.review.history': 'Earlier attempts (reset on SAT)',
  'pastPapers.review.historyEstimate': '{date}: ≈{score} (estimate)',
  'pastPapers.review.historyPartial': '{date}: correct {correct}/{total}',

  'pastPapers.grid.title': 'Platform practice tests',
  'pastPapers.grid.estimateNote': 'Scores are estimates from the SAT platform and are never used for rankings.',
  'pastPapers.grid.noPapers': 'No SAT past papers have been given to this group as homework yet.',
  'pastPapers.grid.loadFailed': "Couldn't load the practice test results.",
  'pastPapers.grid.due': 'Due {date}',
  'pastPapers.grid.notStarted': 'not started',
  'pastPapers.grid.resetWaiting': 'reset on SAT',
  'pastPapers.grid.late': 'Late',
  'pastPapers.grid.beforeAssigned': 'Before assigned',

  'pastPapers.report.section': 'Platform practice tests',
  'pastPapers.report.note': 'Scores are estimates from the SAT platform, not official results.',
  'pastPapers.report.paper': 'Paper',
  'pastPapers.report.score': 'Score',
  'pastPapers.report.rw': 'RW',
  'pastPapers.report.math': 'Math',
  'pastPapers.report.partialScore': 'Partial paper, no score',
} as const satisfies MessageTable;
