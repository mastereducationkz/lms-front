import { api } from './client';
import { activeLocale, formatDateTime, t, type Locale } from '../../lib/i18n';
import '@/lib/i18n/catalogs/lessonPlayer';

// SAT Checkpoints (docs/superpowers/plans/2026-09-03-sat-checkpoints.md).
// Backend: /checkpoints/me (student) and /checkpoints/admin/* (staff).

export type CheckpointStatus = 'locked' | 'available' | 'completed' | 'overdue' | 'reopened';
export type UnitKind = 'verbal' | 'math';

export interface CheckpointUnit {
  lesson_id: number;
  title: string;
  kind: UnitKind;
  completed: boolean;
}

export interface CheckpointRow {
  id: number | null;
  status: CheckpointStatus;
  opened_at: string | null;
  deadline: string | null;
  submitted_at: string | null;
  correct_answers: number | null;
  total_questions: number | null;
  percentage: number | null;
  /** `baseline`: stored skipped at switch-on (already earned then); `transfer`: carried from another group. */
  opened_by: 'auto' | 'admin' | 'transfer' | 'baseline' | null;
  reopen_count: number;
  quiz_attempt_id: number | null;
  /** Submitted after the deadline (the deadline is soft: late work is accepted and flagged). */
  late: boolean;
  late_minutes: number | null;
}

export interface StudentCheckpointItem extends CheckpointRow {
  checkpoint_id: number;
  number: number;
  title: string;
  group_id: number;
  group_name: string;
  covers: CheckpointUnit[];
  total_questions: number;
  locked_reason: string | null;
  /** Never opens by itself (staff may open it by hand): already earned when checkpoints were
   *  switched on for the student (`opened_by: 'baseline'`), or below the group's start number. */
  skipped: boolean;
  quiz: { course_id: number; lesson_id: number } | null;
}

export interface CheckpointDefinition {
  id: number;
  course_id: number;
  number: number;
  title: string;
  is_active: boolean;
  total_questions: number;
  quiz_lesson_id: number | null;
  quiz: { course_id: number; lesson_id: number } | null;
  required_units: { lesson_id: number; title: string; kind: UnitKind }[];
  question_count: number;
}

export interface UnitOption {
  lesson_id: number;
  title: string;
  module: string;
  kind: UnitKind;
}

export interface CheckpointQuizCheck {
  question_count: number;
  expected: number;
  by_difficulty: { easy: number; medium: number; hard: number; unset: number };
  problems: string[];
}

export interface CheckpointGroup {
  id: number;
  name: string;
  program_type: string;
  teacher_name: string | null;
  student_count: number;
  checkpoints_enabled: boolean;
  checkpoints_start_number: number;
}

export interface CheckpointCell extends CheckpointRow {
  checkpoint_id: number;
  number: number;
  units: CheckpointUnit[];
  locked_reason: string | null;
  skipped: boolean;
}

export interface CheckpointMatrix {
  group: CheckpointGroup;
  definitions: CheckpointDefinition[];
  students: { student_id: number; name: string; email: string; cells: CheckpointCell[] }[];
}

export async function getMyCheckpoints(): Promise<{ enabled: boolean; items: StudentCheckpointItem[] }> {
  const response = await api.get('/checkpoints/me');
  return response.data;
}

export async function listCheckpointDefinitions(courseId?: number): Promise<CheckpointDefinition[]> {
  const response = await api.get('/checkpoints/admin/definitions', { params: courseId ? { course_id: courseId } : {} });
  return response.data;
}

export async function updateCheckpointDefinition(
  id: number,
  body: Partial<Pick<CheckpointDefinition, 'title' | 'is_active' | 'quiz_lesson_id' | 'total_questions'>> & {
    required_units?: { lesson_id: number; kind: UnitKind }[];
  },
): Promise<CheckpointDefinition> {
  const response = await api.put(`/checkpoints/admin/definitions/${id}`, body);
  return response.data;
}

export async function listUnitOptions(definitionId: number): Promise<UnitOption[]> {
  const response = await api.get(`/checkpoints/admin/definitions/${definitionId}/unit-options`);
  return response.data;
}

export async function checkCheckpointQuiz(id: number): Promise<CheckpointQuizCheck> {
  const response = await api.get(`/checkpoints/admin/definitions/${id}/quiz-check`, { cache: false } as any);
  return response.data;
}

export async function listCheckpointGroups(programType = 'sat'): Promise<CheckpointGroup[]> {
  const response = await api.get('/checkpoints/admin/groups', { params: { program_type: programType } });
  return response.data;
}

export async function updateCheckpointGroupSettings(
  groupId: number,
  body: { enabled?: boolean; start_number?: number },
): Promise<{ group_id: number; checkpoints_enabled: boolean; checkpoints_start_number: number; opened: number }> {
  const response = await api.patch(`/checkpoints/admin/groups/${groupId}`, body);
  return response.data;
}

export async function getCheckpointMatrix(groupId: number): Promise<CheckpointMatrix> {
  const response = await api.get(`/checkpoints/admin/groups/${groupId}/matrix`, { cache: false } as any);
  return response.data;
}

export async function openCheckpoint(
  groupId: number, checkpointId: number, body: { student_ids?: number[]; deadline?: string },
): Promise<{ changed: number; rows: (CheckpointRow & { student_id: number })[] }> {
  const response = await api.post(`/checkpoints/admin/groups/${groupId}/checkpoints/${checkpointId}/open`, body);
  return response.data;
}

export async function reopenCheckpoint(
  groupId: number, checkpointId: number, body: { student_ids?: number[]; deadline?: string },
): Promise<{ changed: number; rows: (CheckpointRow & { student_id: number })[] }> {
  const response = await api.post(`/checkpoints/admin/groups/${groupId}/checkpoints/${checkpointId}/reopen`, body);
  return response.data;
}

export async function updateCheckpointDeadline(rowId: number, deadline: string): Promise<CheckpointRow> {
  const response = await api.patch(`/checkpoints/admin/student-checkpoints/${rowId}`, { deadline });
  return response.data;
}

/** "Covers: Verbal Units 1–2 + Math Unit 1" style label built from the required units. */
export function coversLabel(units: CheckpointUnit[]): string {
  const short = (t: string) => t.replace(/^Unit\s+(\d+(?:\.\d+)?)[:.].*$/i, 'Unit $1');
  const verbal = units.filter((u) => u.kind === 'verbal').map((u) => short(u.title));
  const math = units.filter((u) => u.kind === 'math').map((u) => short(u.title));
  const parts: string[] = [];
  if (verbal.length) parts.push(`Verbal ${verbal.join(', ')}`);
  if (math.length) parts.push(`Math ${math.join(', ')}`);
  return parts.join(' + ');
}

/** "5 Sept, 17:48" / «5 сент., 17:48», on Almaty time, in the user's language. */
export const formatDeadline = (iso: string | null | undefined, locale: Locale = activeLocale()): string => {
  if (!iso) return '';
  if (Number.isNaN(new Date(iso).getTime())) return iso;
  return formatDateTime(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }, locale);
};

/** "5h 12m" / "3d 2h" style duration for countdowns and lateness. */
export const formatDuration = (minutes: number, locale: Locale = activeLocale()): string => {
  const m = Math.max(0, Math.round(minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  if (d > 0) return t('lessonPlayer.duration.daysHours', { days: d, hours: h }, locale);
  if (h > 0) return t('lessonPlayer.duration.hoursMinutes', { hours: h, minutes: min }, locale);
  return t('lessonPlayer.duration.minutes', { minutes: min }, locale);
};

/** "due in 5h 12m" while the deadline is ahead, "overdue by 3h 05m" once it has passed. */
export const deadlineCountdown = (iso: string | null | undefined, now: Date = new Date(), locale: Locale = activeLocale()): string => {
  if (!iso) return '';
  const deadline = new Date(iso);
  if (Number.isNaN(deadline.getTime())) return '';
  const minutes = (deadline.getTime() - now.getTime()) / 60000;
  return minutes >= 0
    ? t('lessonPlayer.deadline.dueIn', { duration: formatDuration(minutes, locale) }, locale)
    : t('lessonPlayer.deadline.overdueBy', { duration: formatDuration(-minutes, locale) }, locale);
};

/** "late by 3h 12m" for a row submitted after its deadline, '' otherwise. */
export const lateLabel = (row: Pick<CheckpointRow, 'late' | 'late_minutes'>, locale: Locale = activeLocale()): string =>
  row.late && row.late_minutes != null ? t('lessonPlayer.deadline.lateBy', { duration: formatDuration(row.late_minutes, locale) }, locale) : '';

export const STATUS_LABEL: Record<CheckpointStatus, string> = {
  locked: 'Locked', available: 'Available', completed: 'Completed', overdue: 'Overdue', reopened: 'Reopened',
};

export const STATUS_CLASS: Record<CheckpointStatus, string> = {
  locked: 'bg-muted text-muted-foreground',
  available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  completed: 'bg-brand-subtle text-brand-subtle-foreground',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  reopened: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

/**
 * How long a checkpoint stays open once it unlocks. Mirrors the server's `DEADLINE_HOURS`
 * (lms-backend `src/checkpoints/service.py:29`). Stated once here so the screens that explain
 * the window to a student cannot drift from each other, or from the server.
 */
export const CHECKPOINT_WINDOW_HOURS = 24;
export const CHECKPOINT_WINDOW_LABEL = `${CHECKPOINT_WINDOW_HOURS} hours`;
