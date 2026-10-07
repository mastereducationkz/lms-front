/** The Russian catalog (curators and head curators). Checked complete against en.ts by i18n.test.ts. */
import type { Message } from './types';
import { common } from './ru/common';
import { shell } from './ru/shell';
import { auth } from './ru/auth';
import { settings } from './ru/settings';
import { calendar } from './ru/calendar';
import { learning } from './ru/learning';
import { parent } from './ru/parent';
import { attendance } from './ru/attendance';
import { teacher } from './ru/teacher';
import { analytics } from './ru/analytics';
import { exams } from './ru/exams';
import { meet } from './ru/meet';
import { recordings } from './ru/recordings';
import { classLesson } from './ru/classLesson';
import { materials } from './ru/materials';
import { lessonRequests } from './ru/lessonRequests';
import { users } from './ru/users';
import { adminTools } from './ru/adminTools';
import { achievements } from './ru/achievements';
import { schedule } from './ru/schedule';
import { workspace } from './ru/workspace';
import { announcements } from './ru/announcements';
import { serverErrors } from './ru/serverErrors';
import { pwa } from './ru/pwa';
import { studentReport } from './ru/studentReport';
import { studentCard } from './ru/studentCard';
import { curatorHomeworks } from './ru/curatorHomeworks';
import { curatorPages } from './ru/curatorPages';
import { profile } from './ru/profile';
import { stars } from './ru/stars';
import { guide } from './ru/guide';
import { curatorDashboard } from './ru/curatorDashboard';
import { lessonPlayer } from './ru/lessonPlayer';
import { homework } from './ru/homework';
import { homeworkStaff } from './ru/homeworkStaff';
import { studentHome } from './ru/studentHome';
import { publicPages } from './ru/publicPages';
import { chatLive } from './ru/chatLive';
import { meetViews } from './ru/meetViews';
import { teacherDesk } from './ru/teacherDesk';
import { teacherInsights } from './ru/teacherInsights';
import { courseAuthoring } from './ru/courseAuthoring';
import { adminUsers } from './ru/adminUsers';
import { adminPages } from './ru/adminPages';
import { quizReview } from './ru/quizReview';
import { sharedUi } from './ru/sharedUi';

export const RU_NAMESPACES = {
  common,
  shell,
  auth,
  settings,
  calendar,
  learning,
  parent,
  attendance,
  teacher,
  analytics,
  exams,
  meet,
  recordings,
  classLesson,
  materials,
  lessonRequests,
  users,
  adminTools,
  achievements,
  schedule,
  workspace,
  announcements,
  serverErrors,
  pwa,
  studentReport,
  studentCard,
  curatorHomeworks,
  curatorPages,
  profile,
  stars,
  guide,
  curatorDashboard,
  lessonPlayer,
  homework,
  homeworkStaff,
  studentHome,
  publicPages,
  chatLive,
  meetViews,
  teacherDesk,
  teacherInsights,
  courseAuthoring,
  adminUsers,
  adminPages,
  quizReview,
  sharedUi,
} as const;

export const ru: Readonly<Record<string, Message>> = {
  ...common,
  ...shell,
  ...auth,
  ...settings,
  ...calendar,
  ...learning,
  ...parent,
  ...attendance,
  ...teacher,
  ...analytics,
  ...exams,
  ...meet,
  ...recordings,
  ...classLesson,
  ...materials,
  ...lessonRequests,
  ...users,
  ...adminTools,
  ...achievements,
  ...schedule,
  ...workspace,
  ...announcements,
  ...serverErrors,
  ...pwa,
  ...studentReport,
  ...studentCard,
  ...curatorHomeworks,
  ...curatorPages,
  ...profile,
  ...stars,
  ...guide,
  ...curatorDashboard,
  ...lessonPlayer,
  ...homework,
  ...homeworkStaff,
  ...studentHome,
  ...publicPages,
  ...chatLive,
  ...meetViews,
  ...teacherDesk,
  ...teacherInsights,
  ...courseAuthoring,
  ...adminUsers,
  ...adminPages,
  ...quizReview,
  ...sharedUi,
};
