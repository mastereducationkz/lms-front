import { api } from './client';

// Platform-test assignments (Platform Integration Pack §6.3, E1/E2). Every call answers 503
// while PLATFORM_ASSIGNMENTS_ENABLED is off on the backend; callers treat that as "feature off".

export type PlatformModuleName = 'listening' | 'reading' | 'writing' | 'speaking' | string;
export type PlatformModuleState = 'not_started' | 'in_progress' | 'done';
export type PlatformTestStatus = 'not_started' | 'in_progress' | 'submitted';

export interface PlatformModuleProgress {
  module: PlatformModuleName;
  test_title: string | null;
  /** Platform path to open the part (Listening/Reading test, the weekly-set page for Writing, the Speaking setup). */
  path: string | null;
  state: PlatformModuleState;
  band: number | null;
  /** Platform path of the result page once the part is done. */
  result_url: string | null;
  finished_at: string | null;
  /** "due" for Listening/Reading/Writing (still takeable after the deadline), "closes" for Speaking. */
  deadline_kind: 'due' | 'closes';
  /** False only for Speaking outside its window. */
  available: boolean;
}

export interface PlatformTestProgress {
  assignment_id: number;
  group_id: number | null;
  title: string;
  platform: string;
  weekly_set_id: number;
  set_title: string | null;
  set_path: string;
  date_from: string | null;
  date_to: string | null;
  due_date: string | null;
  days_left: number | null;
  is_active: boolean;
  status: PlatformTestStatus;
  modules: PlatformModuleProgress[];
}

export interface PlatformTestStudentRow {
  user_id: number;
  name: string;
  email: string;
  status: PlatformTestStatus;
  modules: PlatformModuleProgress[];
}

export interface PlatformTestMatrix {
  assignment: Omit<PlatformTestProgress, 'status' | 'modules'>;
  students: PlatformTestStudentRow[];
}

export async function getWeeklyTestsMe(): Promise<PlatformTestProgress[]> {
  const response = await api.get('/integrations/weekly-tests/me');
  return (response.data?.items ?? []) as PlatformTestProgress[];
}

export async function getPlatformProgress(
  assignmentId: number | string,
): Promise<PlatformTestProgress | PlatformTestMatrix> {
  const response = await api.get(`/integrations/assignments/${assignmentId}/platform-progress`);
  return response.data;
}

export const isPlatformTestMatrix = (
  value: PlatformTestProgress | PlatformTestMatrix,
): value is PlatformTestMatrix => Array.isArray((value as PlatformTestMatrix).students);

export async function setGroupPlatformTestsOptOut(
  groupId: number,
  optOut: boolean,
): Promise<{ group_id: number; opt_out: boolean }> {
  const response = await api.patch(`/integrations/groups/${groupId}/platform-tests`, { opt_out: optOut });
  return response.data;
}

/** Almaty wall-clock rendering of a platform timestamp (the platforms live in UTC+5). */
export const formatAlmaty = (iso: string | null | undefined, withTime = true): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};
