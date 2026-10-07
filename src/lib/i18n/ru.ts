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
};
