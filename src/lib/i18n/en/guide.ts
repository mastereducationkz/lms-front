import type { MessageTable } from '../types';

/**
 * The tours and one-time page tips (components/guide). Every tour and tip speaks the viewer's
 * language; which role gets which one is decided in tours.ts / tips.ts. Tip copy is keyed by what
 * the tip says, not by its server key (those never change once shipped).
 */
export const guide = {
  // The tour card and the menu entry.
  'guide.tour.loading': 'Loading this part of the page…',
  'guide.tour.next': 'Next',
  'guide.tour.back': 'Back',
  'guide.tour.done': 'Done',
  'guide.tour.skip': 'Skip tour',
  'guide.tour.close': 'Close tour',
  'guide.tour.stepOf': 'Step {index} of {total}',
  'guide.tour.replay': 'Replay tour',
  'guide.tip.gotIt': 'Got it',

  // Student tour.
  'guide.student.welcome.title': 'Here’s where everything lives',
  'guide.student.welcome.body': 'A few quick stops, about a minute. Close it whenever you like; you can replay it from the menu under your name.',
  'guide.student.continue.title': 'Pick up where you left off',
  'guide.student.continue.body': 'Your courses, with how far you’ve got. Lessons go at your own pace and your progress saves as you go.',
  'guide.student.calendar.title': 'Lessons and deadlines',
  'guide.student.calendar.body': 'Every class and due date, in Almaty time. Tap a lesson for its Join link and its own page.',
  'guide.student.homework.title': 'Homework',
  'guide.student.homework.body': 'Everything your teachers set, with due dates. A red number means new grades you haven’t opened yet.',
  'guide.student.recordings.title': 'Missed a class?',
  'guide.student.recordings.body': 'Recordings of your group’s lessons show up here shortly after each one ends.',
  'guide.student.achievements.title': 'Achievements',
  'guide.student.achievements.body': 'Show up, hand in, keep your streak. Every badge unlocks something new for your Kasatik orca.',
  'guide.student.menu.title': 'Everything else is in here',
  'guide.student.menu.body': 'Calendar, courses, homework, recordings and achievements. Your profile and Replay tour are at the bottom.',
  'guide.student.stars.title': 'Your stars',
  'guide.student.stars.body': 'Homework, quizzes and daily questions earn stars, and a daily streak multiplies them. Tap to see where each one came from.',
  'guide.student.profile.title': 'You and your orca',
  'guide.student.profile.body': 'Your profile, settings and your orca’s wardrobe. Replay tour is here too.',

  // Teacher tour.
  'guide.teacher.welcome.title': 'Your week in Master Education',
  'guide.teacher.welcome.body': 'A one-minute look at the tools you’ll use every week. Close it whenever you like; Replay tour is in the menu under your name.',
  'guide.teacher.today.title': 'Today, lesson by lesson',
  'guide.teacher.today.body': 'Each lesson opens its own page: register, scores, homework and notes in one place. Join opens ten minutes before the start; the full week is in the Calendar.',
  'guide.teacher.register.title': 'The register',
  'guide.teacher.register.body': 'Meet now marks who came. A red number here is what still needs you, like a score to give; amber means Meet is still finishing.',
  'guide.teacher.meet.title': 'Meet attendance',
  'guide.teacher.meet.body': 'Who was in each lesson’s room, and for how long. Confirm a student’s Google account once and Meet knows them in every lesson.',
  'guide.teacher.homework.title': 'Homework',
  'guide.teacher.homework.body': 'Set homework for a group and grade what comes in. Each group shows how many are waiting for you.',
  'guide.teacher.courses.title': 'Courses, read-only',
  'guide.teacher.courses.body': 'Open any lesson and see the quiz answers. Nothing you do there counts as a student’s progress.',
  'guide.teacher.review.title': 'Quiz Review',
  'guide.teacher.review.body': 'Go through a quiz with your group on a shared screen, question by question, with how they answered.',
  'guide.teacher.menu.title': 'Everything else is in here',
  'guide.teacher.menu.body': 'Calendar, the register, Meet attendance, homework and courses. Replay tour is at the bottom, under your name.',
  'guide.teacher.profile.title': 'Your profile',
  'guide.teacher.profile.body': 'Settings and your account. Replay tour is here whenever you want this again.',

  // Curator tour (curators and head curators).
  'guide.curator.welcome.title': 'Your curator tools',
  'guide.curator.welcome.body': 'A minute on the essentials: students, groups, homework and tasks. Close it whenever you like; Replay tour is in the menu under your name.',
  'guide.curator.search.title': 'Find a student',
  'guide.curator.search.body': 'Start typing a name or email to open that student’s progress report.',
  'guide.curator.journal.title': 'Students',
  'guide.curator.journal.body': 'Everyone in your groups: attendance, progress and homework. Open a student to see their card.',
  'guide.curator.groups.title': 'My groups',
  'guide.curator.groups.body': 'Who’s in each group, and the reports for parents.',
  'guide.curator.homeworks.title': 'Homework',
  'guide.curator.homeworks.body': 'What’s handed in, missing and overdue in each group, so you can see at once who needs a reminder.',
  'guide.curator.leaderboard.title': 'Leaderboard',
  'guide.curator.leaderboard.body': 'The group’s week, lesson by lesson: attendance, points and homework. Star of the Week is picked here too.',
  'guide.curator.tasks.title': 'Tasks live in the CRM',
  'guide.curator.tasks.body': 'Student tasks are kept in the CRM. The link opens them in a new tab.',
  'guide.curator.menu.title': 'Everything else is in here',
  'guide.curator.menu.body': 'Students, groups, homework, the leaderboard and tasks. Replay tour is at the bottom, under your name.',
  'guide.curator.profile.title': 'Your profile',
  'guide.curator.profile.body': 'Your profile and settings. Replay tour is here too, whenever you want to go through it again.',

  // Page tips: students.
  'guide.tips.lessonSections.title': 'Everything from this lesson',
  'guide.tips.lessonSections.body': 'Your mark, the recording once it’s ready, notes, homework and your teacher’s materials. Tap a chip to jump there.',
  'guide.tips.homeworkLate.title': 'Late still counts',
  'guide.tips.homeworkLate.body': 'After the due date your work is still accepted, just marked late. Until it’s graded, you can send a better version while attempts remain.',
  'guide.tips.tryOn.title': 'Try it on first',
  'guide.tips.tryOn.body': 'Every badge unlocks something for your Kasatik. Try it on to see your orca wearing it now; once you earn it, it’s yours to keep.',
  'guide.tips.checkpoint.title': 'Checkpoints',
  'guide.tips.checkpoint.body': 'A checkpoint opens once you finish the units before it. Take it within a day to see where you stand. It’s optional and never holds your course back.',

  // Page tips: teachers.
  'guide.tips.lessonRegister.title': 'Meet takes the register',
  'guide.tips.lessonRegister.body': 'In an LMS Meet room, Meet marks who came. Change a mark only if it’s wrong (we’ll ask why), then give each present student a score by 23:59 that day.',
  'guide.tips.allowAttempt.title': 'One more try',
  'guide.tips.allowAttempt.body': 'Once graded, a student can’t resubmit on their own. Allow another attempt reopens it for just them: one more try, or until a time you pick.',
  'guide.tips.reviewPickQuiz.title': 'Made for the big screen',
  'guide.tips.reviewPickQuiz.body': 'Pick a course, a group and a quiz they took. Each question then opens on its own, with how the group answered. Share it in Meet or on a projector.',
  'guide.tips.starOfWeekTeacher.title': 'Star of the Week',
  'guide.tips.starOfWeekTeacher.body': 'Once a week, pick one student and say why. They’ll see your star and your words on their achievements page.',

  // Page tips: curators and head curators.
  'guide.tips.starOfWeekCurator.title': 'Star of the Week',
  'guide.tips.starOfWeekCurator.body': 'Once a week, pick a student in the group and say why. They’ll see the star and your words on their achievements page.',
  'guide.tips.studentCard.title': 'Student card',
  'guide.tips.studentCard.body': 'Open a student: attendance, homework, progress and their progress report on one page.',
  'guide.tips.lagging.title': 'Who needs a reminder',
  'guide.tips.lagging.body': '“Needs attention only” keeps the groups with missing or overdue homework. Start with those.',
} as const satisfies MessageTable;
