/**
 * One-time page tips (owner, 2026-10-07): a small card on a real element, the first time someone
 * opens that page. «Got it» hides it for good on every device (the key is stored on the server, so
 * keys never change once shipped). One tip may carry a variant per role, under the same key. The
 * copy lives in the guide.* catalog and shows in the viewer's language.
 *
 * Every line here was checked against the page it sits on; a tip whose element isn't on screen
 * simply waits.
 */
import type { Placement } from '@floating-ui/react-dom';
import type { MessageKey } from '@/lib/i18n';
import '@/lib/i18n/catalogs/guide';

export interface TipDefinition {
  key: string;
  roles: readonly string[];
  path: RegExp;
  target: string;
  placement: Placement;
  title: MessageKey;
  body: MessageKey;
}

const STUDENT = ['student'] as const;
const TEACHER = ['teacher'] as const;
const CURATORS = ['curator', 'head_curator'] as const;
const tip = (name: string) => `[data-tip="${name}"]`;

export const TIPS: readonly TipDefinition[] = [
  {
    key: 'lesson.sections',
    roles: STUDENT,
    path: /^\/lessons\/\d+\/?$/,
    target: tip('lesson-sections'),
    placement: 'bottom-start',
    title: 'guide.tips.lessonSections.title',
    body: 'guide.tips.lessonSections.body',
  },
  {
    key: 'homework.late',
    roles: STUDENT,
    path: /^\/homework\/\d+\/?$/,
    target: tip('homework-due'),
    placement: 'bottom-start',
    title: 'guide.tips.homeworkLate.title',
    body: 'guide.tips.homeworkLate.body',
  },
  {
    key: 'achievements.try-on',
    roles: STUDENT,
    path: /^\/achievements\/?$/,
    target: tip('try-on'),
    placement: 'bottom-start',
    title: 'guide.tips.tryOn.title',
    body: 'guide.tips.tryOn.body',
  },
  {
    key: 'course.checkpoint',
    roles: STUDENT,
    path: /^\/course\/\d+\/?$/,
    target: tip('checkpoint-row'),
    placement: 'top-start',
    title: 'guide.tips.checkpoint.title',
    body: 'guide.tips.checkpoint.body',
  },
  {
    key: 'lesson.register',
    roles: TEACHER,
    path: /^\/lessons\/\d+\/?$/,
    target: 'section#register h2',
    placement: 'top-start',
    title: 'guide.tips.lessonRegister.title',
    body: 'guide.tips.lessonRegister.body',
  },
  {
    key: 'homework.allow-attempt',
    roles: TEACHER,
    path: /^\/homework\/\d+\/grade\/?$/,
    target: tip('allow-attempt'),
    placement: 'bottom-end',
    title: 'guide.tips.allowAttempt.title',
    body: 'guide.tips.allowAttempt.body',
  },
  {
    key: 'review.pick-quiz',
    roles: TEACHER,
    path: /^\/review\/?$/,
    target: '#review-course',
    placement: 'bottom-start',
    title: 'guide.tips.reviewPickQuiz.title',
    body: 'guide.tips.reviewPickQuiz.body',
  },
  {
    key: 'leaderboard.star-of-week',
    roles: TEACHER,
    path: /^\/attendance\/?$/,
    target: tip('star-of-week'),
    placement: 'bottom-end',
    title: 'guide.tips.starOfWeekTeacher.title',
    body: 'guide.tips.starOfWeekTeacher.body',
  },
  {
    key: 'leaderboard.star-of-week',
    roles: CURATORS,
    path: /^\/curator\/leaderboard\/?$/,
    target: tip('star-of-week'),
    placement: 'bottom-end',
    title: 'guide.tips.starOfWeekCurator.title',
    body: 'guide.tips.starOfWeekCurator.body',
  },
  {
    key: 'journal.student-card',
    roles: CURATORS,
    path: /^\/curator\/students\/?$/,
    target: tip('journal-row'),
    placement: 'bottom-start',
    title: 'guide.tips.studentCard.title',
    body: 'guide.tips.studentCard.body',
  },
  {
    key: 'homeworks.lagging',
    roles: CURATORS,
    path: /^\/curator\/homeworks\/?$/,
    target: tip('lagging-filter'),
    placement: 'bottom',
    title: 'guide.tips.lagging.title',
    body: 'guide.tips.lagging.body',
  },
];

/** The tips this person could see on this page, in order, minus those already dismissed. */
export function tipsFor(role: string | null | undefined, pathname: string, dismissed: (key: string) => boolean): TipDefinition[] {
  if (!role) return [];
  return TIPS.filter((t) => t.roles.includes(role) && t.path.test(pathname) && !dismissed(t.key));
}
