import { api } from './client';

/** «Папки»: exam results grouped by sitting (exam type + date). Mirrors lms-backend src/exams/folders.py. */

export type ResultStatus = 'reported' | 'verified' | 'rejected';

export interface FolderCounts {
  total: number;
  with_proof: number;
  /** Reported and no proof - what a curator still has to confirm or document. */
  unconfirmed: number;
  reported: number;
  verified: number;
  rejected: number;
}

export interface ExamFolder extends FolderCounts {
  key: string;
  exam_type: string;
  test_date: string | null;
}

export interface FolderList {
  folders: ExamFolder[];
  all: ExamFolder;
  curators: { id: number; name: string }[];
}

export interface FolderResultRow {
  result_id: number;
  student_id: number;
  student_name: string;
  group_id: number | null;
  group_name: string | null;
  curator_id: number | null;
  curator_name: string | null;
  exam_type: 'sat' | 'ielts' | 'nuet';
  test_date: string;
  total_score: number;
  verbal_score: number | null;
  math_score: number | null;
  listening_band: number | null;
  reading_band: number | null;
  writing_band: number | null;
  speaking_band: number | null;
  status: ResultStatus;
  source: string;
  has_proof: boolean;
  unconfirmed: boolean;
  proof_uploaded_at: string | null;
  recorded_at: string | null;
  recorded_by_name: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  notes: string | null;
}

export interface FolderFilters {
  examType?: 'sat' | 'ielts' | 'nuet';
  testDate?: string;
  groupId?: number;
  curatorId?: number;
  status?: ResultStatus;
  proof?: 'with' | 'without';
  unconfirmedOnly?: boolean;
  search?: string;
}

const toQuery = (f: FolderFilters) => ({
  ...(f.examType ? { exam_type: f.examType } : {}),
  ...(f.testDate ? { test_date: f.testDate } : {}),
  ...(f.groupId != null ? { group_id: f.groupId } : {}),
  ...(f.curatorId != null ? { curator_id: f.curatorId } : {}),
  ...(f.status ? { status: f.status } : {}),
  ...(f.proof ? { proof: f.proof } : {}),
  ...(f.unconfirmedOnly ? { unconfirmed_only: true } : {}),
  ...(f.search ? { search: f.search } : {}),
});

/** Folders (one per sitting) under the filters. ``testDate`` is ignored here. */
export async function getResultFolders(filters: FolderFilters = {}): Promise<FolderList> {
  const { testDate: _ignored, ...rest } = filters;
  const response = await api.get('/exams/folders', { params: toQuery(rest), cache: false } as never);
  return response.data;
}

export async function getFolderResults(filters: FolderFilters = {}): Promise<{ rows: FolderResultRow[]; total: number }> {
  const response = await api.get('/exams/folders/results', { params: toQuery(filters), cache: false } as never);
  return response.data;
}

/** XLSX of exactly the rows ``getFolderResults`` lists, with a proof link column. */
export async function exportFolderResults(filters: FolderFilters = {}): Promise<Blob> {
  const response = await api.get('/exams/folders/export', { params: toQuery(filters), responseType: 'blob' });
  return response.data;
}
