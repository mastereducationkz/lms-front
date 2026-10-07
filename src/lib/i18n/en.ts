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
} as const;

export type MessageKey = keyof typeof en;
