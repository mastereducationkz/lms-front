import type { AxiosRequestConfig } from 'axios';
import { api } from './client';

const NO_CACHE = { cache: false } as AxiosRequestConfig & { cache?: boolean };

/**
 * Admin → lesson recordings rollout.
 *
 * Connecting a teacher means storing their @mastereducation.kz Workspace account on the
 * user record — after that the scheduler gives their upcoming lessons Meet rooms, records
 * them, and invites the linked Telegram chats. The Google account itself is created in the
 * Admin Console (bulk CSV from `downloadWorkspaceImportCsv`), never here.
 */

export interface RecordingTeacherGroup {
  id: number;
  name: string;
  telegram_linked: boolean;
  lessons: number;
}

export interface RecordingTeacher {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  workspace_email: string | null;
  suggested_workspace_email: string | null;
  /** Class lessons in the next 30 days with at least one operational group. */
  upcoming_lessons: number;
  /** Of those, lessons that already have an LMS meet.google.com room. */
  rooms_ready: number;
  groups: RecordingTeacherGroup[];
}

export async function getRecordingTeachers(): Promise<RecordingTeacher[]> {
  const response = await api.get('/admin/recordings/teachers', NO_CACHE);
  return response.data;
}

export async function getRecordingTeacher(userId: number): Promise<RecordingTeacher> {
  const response = await api.get(`/admin/recordings/teachers/${userId}`, NO_CACHE);
  return response.data;
}

export async function connectRecordingTeacher(
  userId: number,
  workspaceEmail: string | null,
): Promise<RecordingTeacher> {
  const response = await api.put(`/admin/recordings/teachers/${userId}`, {
    workspace_email: workspaceEmail,
  });
  return response.data;
}

/** URL of the Google Admin bulk-import CSV for every teacher not yet connected. */
export function workspaceImportCsvUrl(orgUnit: string = '/'): string {
  return `/admin/recordings/export.csv?org_unit=${encodeURIComponent(orgUnit)}`;
}

export async function downloadWorkspaceImportCsv(orgUnit: string = '/'): Promise<void> {
  const response = await api.get(workspaceImportCsvUrl(orgUnit), {
    ...NO_CACHE,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'workspace-import.csv';
  a.click();
  URL.revokeObjectURL(url);
}
