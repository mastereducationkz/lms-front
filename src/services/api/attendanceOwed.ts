import { api } from './client';
import { apiError } from './apiError';

/**
 * What the signed-in teacher still owes on lessons that ran (owner, 2026-10-17): the registers Meet
 * could not take and the activity scores of present students. One lesson per item, oldest first; every
 * item opens its lesson page. Contract: lms-backend `GET /dashboard/attendance-owed`.
 */

export type OwedKind = 'register' | 'scores';

export interface OwedItem {
  event_id: number;
  title: string;
  group_id: number;
  group_name: string;
  start: string;
  kind: OwedKind;
  /** Students without a mark (`register`) or present students without a score (`scores`). */
  missing: number;
}

export interface AttendanceOwed {
  items: OwedItem[];
  /** Lessons Meet handed back that nobody has marked. */
  registers: number;
  /** Lessons with a present student still unscored. */
  scores: number;
  /** Lessons Meet is still processing: nothing to do yet. */
  waiting: number;
}

/** The caller's own owed work, or null from a server that does not have the endpoint yet. */
export async function getAttendanceOwed(): Promise<AttendanceOwed | null> {
  try {
    const response = await api.get('/dashboard/attendance-owed', { cache: false } as never);
    return response.data as AttendanceOwed;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 403 || status === 405) return null;
    throw apiError(error, 'Failed to load the attendance you owe');
  }
}
