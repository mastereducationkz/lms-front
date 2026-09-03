import { api } from './client';

// Structured per-track targets + progress (Platform Integration Pack §6.4, E5).
// Every call answers 503 while PLATFORM_TARGETS_ENABLED is off on the backend.

export type TargetTrack = 'sat' | 'ielts' | 'nuet';
export type IeltsModule = 'listening' | 'reading' | 'writing' | 'speaking';

export interface TargetRecord {
  track: string;
  targets: Record<string, number>;
  note: string | null;
  source: 'assignment_zero' | 'student' | 'staff' | string;
  set_by: number | null;
  updated_at: string | null;
}

export interface IeltsModuleProgress {
  now: number | null;
  set_id: number | null;
  scored_at: string | null;
  result_url: string | null;
  previous: number | null;
  trend: number | null;
  best: number | null;
}

export interface DiagnosticModule {
  band: number | null;          // null = taken, not scored yet
  completed_at: string | null;
  result_url: string | null;
}

/** Diagnostic entry bands (no Speaking); stored nightly by the LMS. */
export interface DiagnosticStart {
  listening: DiagnosticModule | null;
  reading: DiagnosticModule | null;
  writing: DiagnosticModule | null;
  completed_count: number | null;
  overall: number | null;
  fetched_at: string | null;
}

export interface IeltsProgress {
  modules: Record<IeltsModule, IeltsModuleProgress>;
  start?: DiagnosticStart | null;
  overall_now: number | null;
  overall_best: number | null;
  overall_missing: IeltsModule[];
  window_set_ids: number[];
  gaps: Record<string, number | null>;
  reached: boolean;
}

export interface SatCurrent {
  total: number | null;
  math: number | null;
  verbal: number | null;
  week: number | null;
  set_name: string | null;
  completed_at: string | null;
  source: string;
}

export interface SatProgress {
  current: SatCurrent | null;
  gaps: Record<string, number | null>;
  reached: boolean;
}

export interface TargetsPayload {
  tracks: string[];
  targets: Record<string, TargetRecord>;
  progress: { ielts?: IeltsProgress; sat?: SatProgress; nuet?: { current: null; gaps: Record<string, null>; reached: false } };
}

export async function getMyTargets(): Promise<TargetsPayload> {
  const response = await api.get('/targets/me');
  return response.data;
}

export async function setMyTarget(track: TargetTrack, targets: Record<string, number>): Promise<TargetRecord> {
  const response = await api.put(`/targets/me/${track}`, { targets });
  return response.data;
}

export async function getStudentTargets(studentId: number | string): Promise<TargetsPayload> {
  const response = await api.get(`/targets/students/${studentId}`);
  return response.data;
}

export async function setStudentTarget(
  studentId: number | string,
  track: TargetTrack,
  targets: Record<string, number>,
): Promise<TargetRecord> {
  const response = await api.put(`/targets/students/${studentId}/${track}`, { targets });
  return response.data;
}

export const band = (value: number | null | undefined): string => (value == null ? '—' : value.toFixed(1));
export const score = (value: number | null | undefined): string => (value == null ? '—' : String(value));
export const trendArrow = (trend: number | null | undefined): string =>
  trend == null || trend === 0 ? '' : trend > 0 ? '↑' : '↓';
