import type { AxiosRequestConfig } from 'axios';
import { api } from './client';
import type { DirectoryAccount } from '../../lib/workspaceRollout';

const NO_CACHE = { cache: false } as AxiosRequestConfig & { cache?: boolean };

/**
 * Admin → Recordings Rollout.
 *
 * Connecting a teacher stores their @mastereducation.kz Workspace account on the user record —
 * after that the scheduler gives their upcoming lessons Meet rooms, records them, and invites
 * the linked Telegram chats. Google accounts are created in the Admin Console from the import
 * file, never here; the uploaded Workspace users list is how the LMS knows which accounts
 * exist. Every refusal carries the server's reason, so each call surfaces `detail`.
 */

export interface RecordingTeacherGroup {
  id: number;
  name: string;
  telegram_linked: boolean;
  lessons: number;
}

export interface RecordingAccount {
  /** What the uploaded users list says about the connected or proposed address. */
  status: 'exists' | 'missing' | 'unknown';
  signed_in: boolean | null;
  suspended: boolean;
  org_unit: string | null;
}

export interface RecordingTeacher {
  id: number;
  name: string;
  official_full_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  workspace_email: string | null;
  suggested_workspace_email: string | null;
  /** English first and last name for the Google account (passport spelling). */
  first_name: string;
  last_name: string;
  /** Existing Workspace accounts with the same first name — maybe the same person. */
  similar_accounts: string[];
  skipped: boolean;
  account: RecordingAccount;
  /** Class lessons in the next 30 days with at least one operational group. */
  upcoming_lessons: number;
  /** Of those, lessons that already have an LMS meet.google.com room. */
  rooms_ready: number;
  groups: RecordingTeacherGroup[];
}

export interface WorkspaceDirectory {
  uploaded_at: string | null;
  uploaded_by: string | null;
  count: number;
  accounts: DirectoryAccount[];
}

export interface WorkspaceImportRow {
  user_id: number;
  workspace_email: string;
  first_name: string;
  last_name: string;
}

async function detailOf(error: unknown): Promise<string | null> {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return typeof parsed?.detail === 'string' ? parsed.detail : null;
    } catch {
      return null;
    }
  }
  const detail = (data as { detail?: unknown } | undefined)?.detail;
  return typeof detail === 'string' ? detail : null;
}

async function rethrow(error: unknown, fallback: string): Promise<never> {
  throw new Error((await detailOf(error)) || fallback);
}

export async function getRecordingTeachers(): Promise<RecordingTeacher[]> {
  try {
    return (await api.get('/admin/recordings/teachers', NO_CACHE)).data;
  } catch (error) {
    return rethrow(error, 'Failed to load teachers');
  }
}

export async function getRecordingTeacher(userId: number): Promise<RecordingTeacher> {
  try {
    return (await api.get(`/admin/recordings/teachers/${userId}`, NO_CACHE)).data;
  } catch (error) {
    return rethrow(error, 'Failed to load the teacher');
  }
}

export async function connectRecordingTeacher(
  userId: number,
  workspaceEmail: string | null,
): Promise<RecordingTeacher> {
  try {
    return (await api.put(`/admin/recordings/teachers/${userId}`, { workspace_email: workspaceEmail })).data;
  } catch (error) {
    return rethrow(error, workspaceEmail ? 'Failed to connect the teacher' : 'Failed to disconnect the teacher');
  }
}

export async function skipRecordingTeacher(userId: number, skipped: boolean): Promise<RecordingTeacher> {
  try {
    return (await api.put(`/admin/recordings/teachers/${userId}/skip`, { skipped })).data;
  } catch (error) {
    return rethrow(error, 'Failed to update the teacher');
  }
}

export async function getWorkspaceDirectory(): Promise<WorkspaceDirectory> {
  try {
    return (await api.get('/admin/recordings/directory', NO_CACHE)).data;
  } catch (error) {
    return rethrow(error, 'Failed to load the Workspace users list');
  }
}

/** Replace the users list with Google Admin's "Download users" CSV. */
export async function uploadWorkspaceDirectory(csvText: string): Promise<WorkspaceDirectory> {
  try {
    return (await api.post('/admin/recordings/directory', { csv_text: csvText })).data;
  } catch (error) {
    return rethrow(error, 'Failed to upload the Workspace users list');
  }
}

/** Download the Google Admin bulk-upload file for exactly these reviewed rows. */
export async function downloadWorkspaceImport(orgUnit: string, rows: WorkspaceImportRow[]): Promise<void> {
  let blob: Blob;
  try {
    const response = await api.post(
      '/admin/recordings/export.csv',
      { org_unit: orgUnit, rows },
      { ...NO_CACHE, responseType: 'blob' },
    );
    blob = response.data;
  } catch (error) {
    return rethrow(error, 'Failed to build the Google import file');
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'workspace-import.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same tick can cancel the download in Safari and Firefox.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
