import { api } from './client';

export type SatDateStatus = 'confirmed' | 'anticipated';

export interface SatOfficialDate {
  test_date: string;          // ISO yyyy-mm-dd - always unambiguous
  status: SatDateStatus;
  label: string;              // localized display form, e.g. "August 22, 2026"
  month: number;
  year: number;
  registration_deadline: string | null;
  change_deadline: string | null;
  is_past: boolean;
}

export interface SatOfficialDatesResponse {
  dates: SatOfficialDate[];
  /** null once the confirmed list is exhausted - render "no upcoming date", never a countdown. */
  next_confirmed_date: string | null;
  source_url: string;
  verified_at: string;
}

/**
 * The canonical SAT calendar, served from the backend.
 *
 * This replaces two hand-copied frontend date tables that projected the 2025-26
 * day-of-month onto the current year, making every 2026-27 date wrong by 1-8 days
 * (Aug 23 vs 22, Mar 14 vs 6, ...). Never hard-code SAT dates in the frontend again.
 *
 * Anticipated dates are excluded by default: College Board lists the 2027-28 schedule
 * under "Anticipated Test Dates" and they must never be offered as settled.
 */
export async function getSatOfficialDates(params?: {
  includeAnticipated?: boolean;
  includePast?: boolean;
}): Promise<SatOfficialDatesResponse> {
  const response = await api.get('/exams/sat-dates', {
    params: {
      include_anticipated: params?.includeAnticipated ?? false,
      include_past: params?.includePast ?? true,
    },
  });
  return response.data;
}

export interface ExamResultRow {
  student: {
    student_id: number;
    full_name: string;
    student_phone: string | null;
    telegram_tag: string | null;
    parent_full_name: string | null;
    parent_phone: string | null;
  };
  group_id: number | null;
  group_name: string | null;
  planned_test_date: string | null;
  result: {
    id: number;
    exam_type: string;
    test_date: string;
    total_score: string;
    verbal_score: number | null;
    math_score: number | null;
    listening_band: string | null;
    reading_band: string | null;
    writing_band: string | null;
    speaking_band: string | null;
    status: 'reported' | 'verified' | 'rejected';
    source: string;
    has_proof: boolean;
  } | null;
}

export interface ExamResultFilters {
  examType?: 'sat' | 'ielts' | 'nuet';
  groupId?: number;
  /** Which date the range applies to: the planned administration or the date actually sat. */
  dateField?: 'planned' | 'actual';
  dateFrom?: string;
  dateTo?: string;
  exactDate?: string;
  status?: 'reported' | 'verified' | 'rejected';
  search?: string;
  limit?: number;
  offset?: number;
}

const toQuery = (f: ExamResultFilters) => ({
  exam_type: f.examType ?? 'sat',
  ...(f.groupId != null ? { group_id: f.groupId } : {}),
  date_field: f.dateField ?? 'planned',
  ...(f.dateFrom ? { date_from: f.dateFrom } : {}),
  ...(f.dateTo ? { date_to: f.dateTo } : {}),
  ...(f.exactDate ? { exact_date: f.exactDate } : {}),
  ...(f.status ? { status: f.status } : {}),
  ...(f.search ? { search: f.search } : {}),
  ...(f.limit != null ? { limit: f.limit } : {}),
  ...(f.offset != null ? { offset: f.offset } : {}),
});

export async function getExamResults(filters: ExamResultFilters = {}): Promise<ExamResultRow[]> {
  const response = await api.get('/exams/results', { params: toQuery(filters) });
  return response.data;
}

/**
 * Download the XLSX for the current filters.
 *
 * The server re-derives row scope from the authenticated user, so this cannot return
 * anything the grid would not show.
 */
export async function exportExamResults(filters: ExamResultFilters = {}): Promise<Blob> {
  const response = await api.get('/exams/results/export', {
    params: toQuery(filters),
    responseType: 'blob',
  });
  return response.data;
}

export interface BluebookGrid {
  group_id: number;
  group_name: string;
  teacher_name: string | null;
  start_date: string | null;
  finish_date: string | null;
  columns: Array<{
    key: string;
    label: string;
    test_number: number | null;
    assignment_id: number | null;
    due_date: string | null;
    week_number: number | null;
    is_baseline: boolean;
    /** False when no Bluebook homework exists for this test in this group. */
    is_assigned: boolean;
  }>;
  rows: Array<{
    student_id: number;
    full_name: string;
    display_id: string | null;
    email: string | null;
    cells: Record<string, {
      state: 'submitted' | 'not_submitted' | 'not_assigned';
      verbal_score: number | null;
      math_score: number | null;
      total_score: number | null;
      taken_at: string | null;
      screenshot_url: string | null;
      source: string | null;
      delta: number | null;
      trend: 'up' | 'down' | 'same' | null;
    }>;
    submitted_count: number;
    assigned_count: number;
    best_total: number | null;
    latest_total: number | null;
    average_total: number | null;
    baseline_total: number | null;
    improvement_from_baseline: number | null;
    official_result: { total_score: string; test_date: string; source: string } | null;
  }>;
  column_stats: Record<string, {
    submitted_count: number;
    expected_count: number;
    completion_rate: number;
    mean_total: number | null;
    median_total: number | null;
    mean_verbal: number | null;
    mean_math: number | null;
  }>;
  group_stats: {
    student_count: number;
    tests_assigned: number;
    tests_available: number;
    submitted_count: number;
    expected_count: number;
    completion_rate: number;
    average_latest_total: number | null;
    median_latest_total: number | null;
    average_best_total: number | null;
    highest_total: number | null;
    lowest_latest_total: number | null;
    average_improvement: number | null;
    improved_count: number;
    declined_count: number;
    students_with_no_results: number;
  };
}

export interface ExamGroupOption {
  id: number;
  name: string;
  program_type: string;
  teacher_id: number | null;
  teacher_name: string | null;
}

/** Groups the caller may filter exam results by, across all programs. Scope-aware. */
export async function getExamGroups(params?: {
  program?: 'sat' | 'ielts' | 'nuet';
  search?: string;
}): Promise<ExamGroupOption[]> {
  const response = await api.get('/exams/groups', {
    params: {
      ...(params?.program ? { program: params.program } : {}),
      ...(params?.search ? { search: params.search } : {}),
    },
  });
  return response.data;
}

export interface BluebookGroupOption {
  id: number;
  name: string;
  program_type: string;
  teacher_id: number | null;
  teacher_name: string | null;
}

/**
 * SAT groups the current staff user may open a Bluebook grid for.
 *
 * Must NOT be replaced with getMyGroups(): `/users/groups/me` implements only the
 * student, teacher and curator branches and returns [] for admin, head_teacher and
 * head_curator, which made this page look empty for exactly those roles. This endpoint
 * derives scope from the shared row-scope service instead.
 */
export async function getBluebookGroups(search?: string): Promise<BluebookGroupOption[]> {
  const response = await api.get('/exams/bluebook/groups', {
    params: search ? { search } : {},
  });
  return response.data;
}

export async function getBluebookGrid(groupId: number, cohortDate?: string): Promise<BluebookGrid> {
  const response = await api.get(`/exams/bluebook/groups/${groupId}/grid`, {
    params: cohortDate ? { cohort_date: cohortDate } : {},
  });
  return response.data;
}

export async function exportBluebookGrid(groupId: number, cohortDate?: string): Promise<Blob> {
  const response = await api.get(`/exams/bluebook/groups/${groupId}/export`, {
    params: cohortDate ? { cohort_date: cohortDate } : {},
    responseType: 'blob',
  });
  return response.data;
}
