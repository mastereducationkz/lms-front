import { api } from './client';

/**
 * SAT past papers as homework (task type `sat_past_paper_task`). The contracts mirror the backend's
 * /past-papers routes. Every scaled score is an ESTIMATE: show it with its label and never rank by it.
 */

export type PastPaperState = 'not_started' | 'in_progress' | 'completed' | 'reset_waiting';

export interface PastPaperSection {
  correct: number;
  total: number;
  /** null for a partial paper (raw score only). */
  scaled_estimate: number | null;
}

export interface PastPaperDomain {
  section: string;
  domain: string;
  correct: number;
  total: number;
}

export interface PastPaperHistoryEntry {
  completed_at: string;
  total_scaled_estimate: number | null;
  rw: PastPaperSection | null;
  math: PastPaperSection | null;
}

export interface PastPaperTaskStatus {
  task_id: string | number;
  paper_id: number;
  paper_title: string;
  is_partial: boolean;
  state: PastPaperState;
  /** Completed before the homework was created. */
  before_assigned: boolean;
  started_at: string | null;
  completed_at: string | null;
  is_estimate: boolean;
  rw: PastPaperSection | null;
  math: PastPaperSection | null;
  total_scaled_estimate: number | null;
  weakest_domains: PastPaperDomain[];
  /** SAT path to open the paper (handoff). */
  paper_path: string | null;
  results_path: string | null;
  /** Staff only, after completion: the SAT admin per-student page. */
  review_url: string | null;
  history: PastPaperHistoryEntry[];
}

export interface PastPaperAssignmentStatus {
  past_paper_only: boolean;
  tasks: PastPaperTaskStatus[];
}

export interface PastPaperCatalogGroupCount {
  group_id: number;
  done: number;
  in_progress: number;
  total: number;
}

export interface PastPaperCatalogEntry {
  id: number;
  title: string;
  test_date: string | null;
  is_partial: boolean;
  is_prediction: boolean;
  module_count: number;
  groups: PastPaperCatalogGroupCount[];
}

export interface PastPaperCatalog {
  /** The PAST_PAPER_HOMEWORK_ENABLED switch: false hides the task type in the builder. */
  enabled: boolean;
  /** false when SAT's list could not be read right now. */
  available: boolean;
  papers: PastPaperCatalogEntry[];
}

export interface PastPaperGridCell {
  state: PastPaperState;
  total_scaled_estimate: number | null;
  rw: PastPaperSection | null;
  math: PastPaperSection | null;
  before_assigned: boolean;
  late: boolean;
}

export interface PastPaperGridPaper {
  paper_id: number;
  paper_title: string;
  is_partial: boolean;
  assignment_ids: number[];
  due_date: string | null;
}

export interface PastPaperGridRow {
  student_id: number;
  name: string;
  cells: Record<string, PastPaperGridCell>;
}

export interface PastPaperGrid {
  group: { id: number; name: string };
  papers: PastPaperGridPaper[];
  rows: PastPaperGridRow[];
}

/** The picker's list, with "already done by N of M" counted per chosen group. */
export async function getPastPaperCatalog(groupIds: number[]): Promise<PastPaperCatalog> {
  const response = await api.get('/past-papers/catalog', {
    params: groupIds.length ? { group_ids: groupIds.join(',') } : {},
  });
  return response.data;
}

/** Live state of every past-paper task in a homework; staff pass the student, a student's own view passes none. */
export async function getPastPaperStatus(
  assignmentId: number,
  studentId?: number | null,
): Promise<PastPaperAssignmentStatus> {
  const response = await api.get(`/past-papers/assignments/${assignmentId}/status`, {
    params: studentId ? { student_id: studentId } : {},
  });
  return response.data;
}

export async function getPastPaperGrid(groupId: number): Promise<PastPaperGrid> {
  const response = await api.get(`/past-papers/groups/${groupId}/grid`);
  return response.data;
}
