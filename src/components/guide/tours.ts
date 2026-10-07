/**
 * The three tours (owner, 2026-10-07): what each role actually uses today, in the language of their
 * UI — English for students and teachers, Russian for curators. Teachers' courses are read-only
 * since 2026-10-03, so nothing here offers to create one.
 *
 * Desktop stops point at the sidebar. Below 1024 px the sidebar is hidden (0×0), those stops skip
 * themselves and the `menu` stop — hidden on desktop — points at the menu button instead.
 */
import type { Placement } from '@floating-ui/react-dom';
import type { TourKind } from '@/lib/guide/state';
import type { StepLike } from '@/lib/guide/steps';

export interface TourStep extends StepLike {
  title: string;
  body: string;
  placement?: Placement;
}

export interface TourText {
  /** Shown while a stop waits for its part of the page to load. */
  loading: string;
  next: string;
  back: string;
  done: string;
  skip: string;
  close: string;
  label: string;
  stepOf: (index: number, total: number) => string;
}

export interface TourDefinition {
  kind: TourKind;
  locale: 'en' | 'ru';
  text: TourText;
  steps: TourStep[];
}

const nav = (tour: string) => `[data-tour="${tour}"]`;
const MENU = nav('mobile-menu');
const SIDE: Placement = 'right';

const EN: TourText = {
  loading: 'Loading this part of the page…',
  next: 'Next',
  back: 'Back',
  done: 'Done',
  skip: 'Skip tour',
  close: 'Close tour',
  label: 'Platform tour',
  stepOf: (i, n) => `Step ${i} of ${n}`,
};

const RU: TourText = {
  loading: 'Загружаем эту часть страницы…',
  next: 'Далее',
  back: 'Назад',
  done: 'Готово',
  skip: 'Пропустить тур',
  close: 'Закрыть тур',
  label: 'Тур по платформе',
  stepOf: (i, n) => `Шаг ${i} из ${n}`,
};

const student: TourDefinition = {
  kind: 'student',
  locale: 'en',
  text: EN,
  steps: [
    {
      id: 'welcome',
      title: 'Here’s where everything lives',
      body: 'A few quick stops, about a minute. Close it whenever you like; you can replay it from the menu under your name.',
    },
    {
      id: 'continue',
      target: `${nav('recent-courses')} > div > :first-child`,
      waits: true,
      placement: 'top-start',
      title: 'Pick up where you left off',
      body: 'Your courses, with how far you’ve got. Lessons go at your own pace and your progress saves as you go.',
    },
    {
      id: 'calendar',
      target: nav('calendar-nav'),
      placement: SIDE,
      title: 'Lessons and deadlines',
      body: 'Every class and due date, in Almaty time. Tap a lesson for its Join link and its own page.',
    },
    {
      id: 'homework',
      target: nav('assignments-nav'),
      placement: SIDE,
      title: 'Homework',
      body: 'Everything your teachers set, with due dates. A red number means new grades you haven’t opened yet.',
    },
    {
      id: 'recordings',
      target: nav('recordings-nav'),
      placement: SIDE,
      title: 'Missed a class?',
      body: 'Recordings of your group’s lessons show up here shortly after each one ends.',
    },
    {
      id: 'achievements',
      target: nav('achievements-nav'),
      placement: SIDE,
      title: 'Achievements',
      body: 'Show up, hand in, keep your streak. Every badge unlocks something new for your Kasatik orca.',
    },
    {
      id: 'menu',
      target: MENU,
      placement: 'bottom-end',
      title: 'Everything else is in here',
      body: 'Calendar, courses, homework, recordings and achievements. Your profile and Replay tour are at the bottom.',
    },
    {
      id: 'stars',
      target: nav('stars-pill'),
      waits: true,
      placement: 'bottom-end',
      title: 'Your stars',
      body: 'Homework, quizzes and daily questions earn stars, and a daily streak multiplies them. Tap to see where each one came from.',
    },
    {
      id: 'profile',
      target: nav('profile-nav'),
      placement: 'right-end',
      title: 'You and your orca',
      body: 'Your profile, settings and your orca’s wardrobe. Replay tour is here too.',
    },
  ],
};

const teacher: TourDefinition = {
  kind: 'teacher',
  locale: 'en',
  text: EN,
  steps: [
    {
      id: 'welcome',
      title: 'Your week in Master Education',
      body: 'A one-minute look at the tools you’ll use every week. Close it whenever you like; Replay tour is in the menu under your name.',
    },
    {
      id: 'today',
      target: nav('today-lessons'),
      waits: true,
      placement: 'bottom-start',
      title: 'Today, lesson by lesson',
      body: 'Each lesson opens its own page: register, scores, homework and notes in one place. Join opens ten minutes before the start; the full week is in the Calendar.',
    },
    {
      id: 'register',
      target: nav('attendance-nav'),
      placement: SIDE,
      title: 'The register',
      body: 'Meet now marks who came. A red number here is what still needs you, like a score to give; amber means Meet is still finishing.',
    },
    {
      id: 'meet',
      target: nav('meet-attendance-nav'),
      placement: SIDE,
      title: 'Meet attendance',
      body: 'Who was in each lesson’s room, and for how long. Confirm a student’s Google account once and Meet knows them in every lesson.',
    },
    {
      id: 'homework',
      target: nav('assignments-nav'),
      placement: SIDE,
      title: 'Homework',
      body: 'Set homework for a group and grade what comes in. Each group shows how many are waiting for you.',
    },
    {
      id: 'courses',
      target: nav('courses-nav'),
      placement: SIDE,
      title: 'Courses, read-only',
      body: 'Open any lesson and see the quiz answers. Nothing you do there counts as a student’s progress.',
    },
    {
      id: 'review',
      target: nav('quiz-review-nav'),
      placement: SIDE,
      title: 'Quiz Review',
      body: 'Go through a quiz with your group on a shared screen, question by question, with how they answered.',
    },
    {
      id: 'menu',
      target: MENU,
      placement: 'bottom-end',
      title: 'Everything else is in here',
      body: 'Calendar, the register, Meet attendance, homework and courses. Replay tour is at the bottom, under your name.',
    },
    {
      id: 'profile',
      target: nav('profile-nav'),
      placement: 'right-end',
      title: 'Your profile',
      body: 'Settings and your account. Replay tour is here whenever you want this again.',
    },
  ],
};

const curator: TourDefinition = {
  kind: 'curator',
  locale: 'ru',
  text: RU,
  steps: [
    {
      id: 'welcome',
      title: 'Инструменты куратора',
      body: 'Минута на главное: журнал, группы, домашки и задачи. Закрыть можно в любой момент, а повторить — в меню под вашим именем.',
    },
    {
      id: 'search',
      target: nav('student-search'),
      waits: true,
      placement: 'bottom-start',
      title: 'Найти ученика',
      body: 'Начните вводить имя или email — откроется отчёт об успеваемости ученика.',
    },
    {
      id: 'journal',
      target: nav('students-journal-nav'),
      placement: SIDE,
      title: 'Журнал',
      body: 'Все ученики ваших групп: посещаемость, прогресс и домашки. Нажмите на ученика, чтобы открыть его карточку.',
    },
    {
      id: 'groups',
      target: nav('curator-groups-nav'),
      placement: SIDE,
      title: 'Мои группы',
      body: 'Состав каждой группы и отчёты родителям.',
    },
    {
      id: 'homeworks',
      target: nav('homework-analytics-nav'),
      placement: SIDE,
      title: 'Домашние задания',
      body: 'Сколько сдано, не сдано и просрочено в каждой группе. Сразу видно, кому напомнить.',
    },
    {
      id: 'leaderboard',
      target: nav('leaderboard-nav'),
      placement: SIDE,
      title: 'Лидерборд',
      body: 'Неделя группы урок за уроком: посещаемость, баллы и домашки. Здесь же выбирают звезду недели.',
    },
    {
      id: 'tasks',
      target: nav('curator-tasks-nav'),
      placement: SIDE,
      title: 'Задачи — в CRM',
      body: 'Задачи по ученикам живут в CRM. Ссылка откроет их в новой вкладке.',
    },
    {
      id: 'menu',
      target: MENU,
      placement: 'bottom-end',
      title: 'Всё остальное — здесь',
      body: 'Журнал, группы, домашки, лидерборд и задачи. Внизу, под вашим именем, — «Повторить тур».',
    },
    {
      id: 'profile',
      target: nav('profile-nav'),
      placement: 'right-end',
      title: 'Профиль',
      body: 'Профиль и настройки. Здесь же — «Повторить тур», если захочется пройти его снова.',
    },
  ],
};

export const TOURS: Record<TourKind, TourDefinition> = { student, teacher, curator };

/** The «Replay tour» menu label in the viewer's language. */
export const replayLabel = (kind: TourKind): string => (TOURS[kind].locale === 'ru' ? 'Повторить тур' : 'Replay tour');
