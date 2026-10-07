/**
 * One-time page tips (owner, 2026-10-07): a small card on a real element, the first time someone
 * opens that page. «Got it» hides it for good on every device (the key is stored on the server, so
 * keys never change once shipped). One tip may carry a variant per role, under the same key.
 *
 * Every line here was checked against the page it sits on; a tip whose element isn't on screen
 * simply waits.
 */
import type { Placement } from '@floating-ui/react-dom';

export interface TipDefinition {
  key: string;
  roles: readonly string[];
  path: RegExp;
  target: string;
  placement: Placement;
  locale: 'en' | 'ru';
  title: string;
  body: string;
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
    locale: 'en',
    title: 'Everything from this lesson',
    body: 'Your mark, the recording once it’s ready, notes, homework and your teacher’s materials. Tap a chip to jump there.',
  },
  {
    key: 'homework.late',
    roles: STUDENT,
    path: /^\/homework\/\d+\/?$/,
    target: tip('homework-due'),
    placement: 'bottom-start',
    locale: 'en',
    title: 'Late still counts',
    body: 'After the due date your work is still accepted, just marked late. Until it’s graded, you can send a better version while attempts remain.',
  },
  {
    key: 'achievements.try-on',
    roles: STUDENT,
    path: /^\/achievements\/?$/,
    target: tip('try-on'),
    placement: 'bottom-start',
    locale: 'en',
    title: 'Try it on first',
    body: 'Every badge unlocks something for your Kasatik. Try it on to see your orca wearing it now; once you earn it, it’s yours to keep.',
  },
  {
    key: 'course.checkpoint',
    roles: STUDENT,
    path: /^\/course\/\d+\/?$/,
    target: tip('checkpoint-row'),
    placement: 'top-start',
    locale: 'en',
    title: 'Checkpoints',
    body: 'A checkpoint opens once you finish the units before it. Take it within a day to see where you stand. It’s optional and never holds your course back.',
  },
  {
    key: 'lesson.register',
    roles: TEACHER,
    path: /^\/lessons\/\d+\/?$/,
    target: 'section#register h2',
    placement: 'top-start',
    locale: 'en',
    title: 'Meet takes the register',
    body: 'In an LMS Meet room, Meet marks who came. Change a mark only if it’s wrong (we’ll ask why), then give each present student a score by 23:59 that day.',
  },
  {
    key: 'homework.allow-attempt',
    roles: TEACHER,
    path: /^\/homework\/\d+\/grade\/?$/,
    target: tip('allow-attempt'),
    placement: 'bottom-end',
    locale: 'en',
    title: 'One more try',
    body: 'Once graded, a student can’t resubmit on their own. Allow another attempt reopens it for just them: one more try, or until a time you pick.',
  },
  {
    key: 'review.pick-quiz',
    roles: TEACHER,
    path: /^\/review\/?$/,
    target: '#review-course',
    placement: 'bottom-start',
    locale: 'en',
    title: 'Made for the big screen',
    body: 'Pick a course, a group and a quiz they took. Each question then opens on its own, with how the group answered. Share it in Meet or on a projector.',
  },
  {
    key: 'leaderboard.star-of-week',
    roles: TEACHER,
    path: /^\/attendance\/?$/,
    target: tip('star-of-week'),
    placement: 'bottom-end',
    locale: 'en',
    title: 'Star of the Week',
    body: 'Once a week, pick one student and say why. They’ll see your star and your words on their achievements page.',
  },
  {
    key: 'leaderboard.star-of-week',
    roles: CURATORS,
    path: /^\/curator\/leaderboard\/?$/,
    target: tip('star-of-week'),
    placement: 'bottom-end',
    locale: 'ru',
    title: 'Звезда недели',
    body: 'Раз в неделю выберите ученика группы и напишите, за что. Он увидит звезду и ваши слова на странице достижений.',
  },
  {
    key: 'journal.student-card',
    roles: CURATORS,
    path: /^\/curator\/students\/?$/,
    target: tip('journal-row'),
    placement: 'bottom-start',
    locale: 'ru',
    title: 'Карточка ученика',
    body: 'Нажмите на ученика: посещаемость, домашки, прогресс и отчёт об успеваемости на одной странице.',
  },
  {
    key: 'homeworks.lagging',
    roles: CURATORS,
    path: /^\/curator\/homeworks\/?$/,
    target: tip('lagging-filter'),
    placement: 'bottom',
    locale: 'ru',
    title: 'Кому напомнить',
    body: '«Только отстающие» оставит группы, где есть несданные или просроченные домашки. С них и начните.',
  },
];

export const tipGotIt = (locale: 'en' | 'ru'): string => (locale === 'ru' ? 'Понятно' : 'Got it');

/** The tips this person could see on this page, in order, minus those already dismissed. */
export function tipsFor(role: string | null | undefined, pathname: string, dismissed: (key: string) => boolean): TipDefinition[] {
  if (!role) return [];
  return TIPS.filter((t) => t.roles.includes(role) && t.path.test(pathname) && !dismissed(t.key));
}
