/**
 * The three tours (owner, 2026-10-07): what each role actually uses today. Every stop speaks the
 * viewer's language (lib/i18n, guide.* keys), so a curator who picks English and a student who picks
 * Russian both get their own. Teachers' courses are read-only since 2026-10-03, so nothing here
 * offers to create one.
 *
 * Desktop stops point at the sidebar. Below 1024 px the sidebar is hidden (0×0), those stops skip
 * themselves and the `menu` stop — hidden on desktop — points at the menu button instead.
 */
import type { Placement } from '@floating-ui/react-dom';
import type { TourKind } from '@/lib/guide/state';
import type { StepLike } from '@/lib/guide/steps';
import { activeLocale, t, type Locale, type MessageKey } from '@/lib/i18n';
import '@/lib/i18n/catalogs/guide';

export interface TourStep extends StepLike {
  title: MessageKey;
  body: MessageKey;
  placement?: Placement;
}

export interface TourDefinition {
  kind: TourKind;
  steps: TourStep[];
}

const nav = (tour: string) => `[data-tour="${tour}"]`;
const MENU = nav('mobile-menu');
const SIDE: Placement = 'right';

const student: TourDefinition = {
  kind: 'student',
  steps: [
    {
      id: 'welcome',
      title: 'guide.student.welcome.title',
      body: 'guide.student.welcome.body',
    },
    {
      id: 'continue',
      target: `${nav('recent-courses')} > div > :first-child`,
      waits: true,
      placement: 'top-start',
      title: 'guide.student.continue.title',
      body: 'guide.student.continue.body',
    },
    {
      id: 'calendar',
      target: nav('calendar-nav'),
      placement: SIDE,
      title: 'guide.student.calendar.title',
      body: 'guide.student.calendar.body',
    },
    {
      id: 'homework',
      target: nav('assignments-nav'),
      placement: SIDE,
      title: 'guide.student.homework.title',
      body: 'guide.student.homework.body',
    },
    {
      id: 'recordings',
      target: nav('recordings-nav'),
      placement: SIDE,
      title: 'guide.student.recordings.title',
      body: 'guide.student.recordings.body',
    },
    {
      id: 'achievements',
      target: nav('achievements-nav'),
      placement: SIDE,
      title: 'guide.student.achievements.title',
      body: 'guide.student.achievements.body',
    },
    {
      id: 'menu',
      target: MENU,
      placement: 'bottom-end',
      title: 'guide.student.menu.title',
      body: 'guide.student.menu.body',
    },
    {
      id: 'stars',
      target: nav('stars-pill'),
      waits: true,
      placement: 'bottom-end',
      title: 'guide.student.stars.title',
      body: 'guide.student.stars.body',
    },
    {
      id: 'profile',
      target: nav('profile-nav'),
      placement: 'right-end',
      title: 'guide.student.profile.title',
      body: 'guide.student.profile.body',
    },
  ],
};

const teacher: TourDefinition = {
  kind: 'teacher',
  steps: [
    {
      id: 'welcome',
      title: 'guide.teacher.welcome.title',
      body: 'guide.teacher.welcome.body',
    },
    {
      id: 'today',
      target: nav('today-lessons'),
      waits: true,
      placement: 'bottom-start',
      title: 'guide.teacher.today.title',
      body: 'guide.teacher.today.body',
    },
    {
      id: 'register',
      target: nav('attendance-nav'),
      placement: SIDE,
      title: 'guide.teacher.register.title',
      body: 'guide.teacher.register.body',
    },
    {
      id: 'meet',
      target: nav('meet-attendance-nav'),
      placement: SIDE,
      title: 'guide.teacher.meet.title',
      body: 'guide.teacher.meet.body',
    },
    {
      id: 'homework',
      target: nav('assignments-nav'),
      placement: SIDE,
      title: 'guide.teacher.homework.title',
      body: 'guide.teacher.homework.body',
    },
    {
      id: 'courses',
      target: nav('courses-nav'),
      placement: SIDE,
      title: 'guide.teacher.courses.title',
      body: 'guide.teacher.courses.body',
    },
    {
      id: 'review',
      target: nav('quiz-review-nav'),
      placement: SIDE,
      title: 'guide.teacher.review.title',
      body: 'guide.teacher.review.body',
    },
    {
      id: 'menu',
      target: MENU,
      placement: 'bottom-end',
      title: 'guide.teacher.menu.title',
      body: 'guide.teacher.menu.body',
    },
    {
      id: 'profile',
      target: nav('profile-nav'),
      placement: 'right-end',
      title: 'guide.teacher.profile.title',
      body: 'guide.teacher.profile.body',
    },
  ],
};

const curator: TourDefinition = {
  kind: 'curator',
  steps: [
    {
      id: 'welcome',
      title: 'guide.curator.welcome.title',
      body: 'guide.curator.welcome.body',
    },
    {
      id: 'search',
      target: nav('student-search'),
      waits: true,
      placement: 'bottom-start',
      title: 'guide.curator.search.title',
      body: 'guide.curator.search.body',
    },
    {
      id: 'journal',
      target: nav('students-journal-nav'),
      placement: SIDE,
      title: 'guide.curator.journal.title',
      body: 'guide.curator.journal.body',
    },
    {
      id: 'groups',
      target: nav('curator-groups-nav'),
      placement: SIDE,
      title: 'guide.curator.groups.title',
      body: 'guide.curator.groups.body',
    },
    {
      id: 'homeworks',
      target: nav('homework-analytics-nav'),
      placement: SIDE,
      title: 'guide.curator.homeworks.title',
      body: 'guide.curator.homeworks.body',
    },
    {
      id: 'leaderboard',
      target: nav('leaderboard-nav'),
      placement: SIDE,
      title: 'guide.curator.leaderboard.title',
      body: 'guide.curator.leaderboard.body',
    },
    {
      id: 'tasks',
      target: nav('curator-tasks-nav'),
      placement: SIDE,
      title: 'guide.curator.tasks.title',
      body: 'guide.curator.tasks.body',
    },
    {
      id: 'menu',
      target: MENU,
      placement: 'bottom-end',
      title: 'guide.curator.menu.title',
      body: 'guide.curator.menu.body',
    },
    {
      id: 'profile',
      target: nav('profile-nav'),
      placement: 'right-end',
      title: 'guide.curator.profile.title',
      body: 'guide.curator.profile.body',
    },
  ],
};

export const TOURS: Record<TourKind, TourDefinition> = { student, teacher, curator };

/**
 * The «Replay tour» label in the viewer's language, for code outside React. Components say
 * t('guide.tour.replay'); the tour kind no longer matters (settings/HelpSection still passes it).
 */
export const replayLabel = (_kind?: TourKind, locale: Locale = activeLocale()): string => t('guide.tour.replay', undefined, locale);
