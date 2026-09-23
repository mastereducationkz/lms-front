import { api } from './client';

/**
 * Meet takes the register (owner, 2026-09-23). `shadow`: Meet decides and logs what it would write;
 * `live`: Meet writes the register for lessons from `live_since` on; `off`: nothing.
 */
export type RegisterMode = 'off' | 'shadow' | 'live';
export type RegisterState =
  | 'written' | 'kept' | 'held' | 'skipped' | 'would_write' | 'would_keep' | 'override' | 'reverted';

export interface RegisterOverride {
  status: string | null;
  reason_code: string | null;
  reason_label: string | null;
  text: string | null;
  by: string | null;
  at: string | null;
  /** `external`: changed where the LMS could not see it (the CRM card). */
  via: 'lms' | 'external' | null;
}

/** What the register says about one student in one lesson. */
export interface StudentRegister {
  state: RegisterState;
  mode: 'shadow' | 'live';
  /** The mark after Meet's decision (what it wrote or kept). */
  status: string | null;
  skip_reason: string | null;
  verdict: string | null;
  minutes: number | null;
  required: number | null;
  late_minutes: number | null;
  override: RegisterOverride | null;
}

export interface RegisterSettings {
  mode: RegisterMode;
  shadow_since: string | null;
  live_since: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface RegisterCounts {
  lessons: number;
  decided: number;
  writes: number;
  /** Marks Meet disagrees with the teacher about attending (what it would flip). */
  changes: number;
  held: number;
  overrides: number;
  left_alone: Record<string, number>;
}

export interface RegisterTeacherRow extends RegisterCounts {
  teacher_id: number | null;
  name: string;
}

export interface RegisterReport {
  mode: RegisterMode;
  from: string;
  to: string;
  teachers: RegisterTeacherRow[];
  total: RegisterCounts;
}

const NO_CACHE = { cache: false } as never;

function detailOf(error: unknown, fallback: string): Error {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return new Error(typeof detail === 'string' ? detail : fallback);
}

/** The switch, or null for someone who may not see it. */
export async function getRegisterSettings(): Promise<RegisterSettings | null> {
  try {
    const response = await api.get('/meet-attendance/register/settings', NO_CACHE);
    return response.data as RegisterSettings;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 403) return null;
    throw detailOf(error, 'Could not load the register switch');
  }
}

export async function updateRegisterSettings(mode: RegisterMode): Promise<RegisterSettings> {
  try {
    const response = await api.put('/meet-attendance/register/settings', { mode });
    return response.data as RegisterSettings;
  } catch (error: unknown) {
    throw detailOf(error, 'Could not change the register switch');
  }
}

export async function getRegisterReport(query: { date_from?: string; date_to?: string } = {}): Promise<RegisterReport> {
  try {
    const response = await api.get('/meet-attendance/register/report', { params: query, cache: false } as never);
    return response.data as RegisterReport;
  } catch (error: unknown) {
    throw detailOf(error, 'Could not load the register report');
  }
}
