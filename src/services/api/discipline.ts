import type { AxiosRequestConfig } from 'axios';

import { api, API_BASE_URL } from './client';

/**
 * The head teachers' register: who was late, who cut a lesson short, who never came, and what it
 * costs at 200 ₸ a minute. Filled from the Meet record and corrected by a head teacher.
 *
 * Never cached: a head teacher waives a fine and expects the totals to move on the next breath,
 * and a lesson's Meet record can land at any time while the period is open.
 */

export type DisciplineCellData = {
  late_minutes: number;
  early_minutes: number;
  misses: number;
  fine: number;
  unpriced: number;
  lessons: number;
  measured: number;
  unmeasurable: number;
  decided: number;
  state: string;
};

export type DisciplineTotals = {
  late_minutes: number;
  early_minutes: number;
  misses: number;
  fine: number;
  unpriced: number;
  lessons: number;
  unmeasurable: number;
};

export type DisciplineRow = {
  teacher_id: number;
  name: string;
  program: string;
  days: Record<string, DisciplineCellData>;
  totals: DisciplineTotals;
};

export type DisciplinePeriodInfo = {
  key: string;
  label: string;
  start: string;
  end: string;
  closed: boolean;
  closed_at?: string | null;
};

export type DisciplineRegister = {
  period: DisciplinePeriodInfo;
  days: string[];
  /** Every programme this period holds for this reader — the tabs, unchanged by the chosen one. */
  programs: string[];
  teachers: DisciplineRow[];
  totals: DisciplineTotals;
  reasons: { code: string; label: string }[];
};

export type DisciplineFinding = {
  kind: 'late' | 'ended_early' | 'miss';
  minutes: number;
  fine: number | null;
  made_up: boolean;
  decision: { amount: number; reason_code: string | null; note: string | null; by: string | null; at: string | null } | null;
};

export type DisciplineLesson = {
  event_id: number;
  title: string;
  group: string;
  program: string;
  starts_at: string;
  ends_at: string;
  measurable: boolean;
  state: string;
  first_join: string | null;
  last_leave: string | null;
  students: number;
  students_at_end: number;
  findings: DisciplineFinding[];
};

export type DisciplineDay = {
  day: string;
  teacher_id: number;
  lessons: DisciplineLesson[];
  reasons: { code: string; label: string }[];
};

export type DecisionBody = {
  event_id: number | null;
  teacher_id: number;
  day: string;
  kind: string;
  amount: number;
  reason_code?: string | null;
  note?: string | null;
  minutes?: number | null;
  proposed_amount?: number | null;
};

/** The register is never served from the request cache — see the note above. */
const FRESH = { cache: false } as AxiosRequestConfig & { cache?: boolean };

export async function listPeriods(): Promise<{ periods: DisciplinePeriodInfo[]; rule_start: string }> {
  const response = await api.get('/teacher-discipline/periods', FRESH);
  return response.data;
}

export async function getRegister(period: string, program?: string): Promise<DisciplineRegister> {
  const response = await api.get('/teacher-discipline/register',
    { ...FRESH, params: { period, ...(program ? { program } : {}) } });
  return response.data;
}

export async function getDay(teacherId: number, day: string): Promise<DisciplineDay> {
  const response = await api.get('/teacher-discipline/day',
    { ...FRESH, params: { teacher_id: teacherId, day } });
  return response.data;
}

export async function saveDecision(body: DecisionBody): Promise<{ id: number; amount: number }> {
  const response = await api.post('/teacher-discipline/decisions', body);
  return response.data;
}

export async function closePeriod(periodKey: string): Promise<{ period: string; totals: DisciplineTotals }> {
  const response = await api.post(`/teacher-discipline/periods/${periodKey}/close`);
  return response.data;
}

/** The download link; the browser fetches it with the session's cookies. */
export function exportUrl(period: string, program?: string): string {
  const query = new URLSearchParams({ period, ...(program ? { program } : {}) });
  return `${API_BASE_URL}/teacher-discipline/export.xlsx?${query.toString()}`;
}
