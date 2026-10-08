/**
 * The English catalog: the source of truth for keys and types. One file per area under en/,
 * each key prefixed with its namespace ("settings.title"). ru.ts must match it key for key.
 */
import { common } from './en/common';
import { shell } from './en/shell';
import { auth } from './en/auth';
import { settings } from './en/settings';
import { calendar } from './en/calendar';
import { learning } from './en/learning';
import { parent } from './en/parent';
import { attendance } from './en/attendance';
import { teacher } from './en/teacher';
import { analytics } from './en/analytics';
import { exams } from './en/exams';
import { meet } from './en/meet';
import { recordings } from './en/recordings';
import { classLesson } from './en/classLesson';
import { materials } from './en/materials';
import { lessonRequests } from './en/lessonRequests';
import { users } from './en/users';
import { adminTools } from './en/adminTools';
import { achievements } from './en/achievements';
import { schedule } from './en/schedule';
import { workspace } from './en/workspace';
import { announcements } from './en/announcements';
import { serverErrors } from './en/serverErrors';
import { pwa } from './en/pwa';
import { studentReport } from './en/studentReport';
import { studentCard } from './en/studentCard';
import { curatorHomeworks } from './en/curatorHomeworks';
import { curatorPages } from './en/curatorPages';
import { profile } from './en/profile';
import { stars } from './en/stars';
import { guide } from './en/guide';
import { curatorDashboard } from './en/curatorDashboard';
import { lessonPlayer } from './en/lessonPlayer';
import { homework } from './en/homework';
import { homeworkStaff } from './en/homeworkStaff';
import { studentHome } from './en/studentHome';
import { publicPages } from './en/publicPages';
import { chatLive } from './en/chatLive';
import { meetViews } from './en/meetViews';
import { teacherDesk } from './en/teacherDesk';
import { teacherInsights } from './en/teacherInsights';
import { courseAuthoring } from './en/courseAuthoring';
import { adminUsers } from './en/adminUsers';
import { adminPages } from './en/adminPages';
import { quizReview } from './en/quizReview';
import { sharedUi } from './en/sharedUi';
import { live } from './en/live';
import { offboarding } from './en/offboarding';

export const EN_NAMESPACES = {
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
  live,
  offboarding,
} as const;

export const en = {
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
  ...live,
  ...offboarding,
} as const;

export type MessageKey = keyof typeof en;
