/**
 * Staff training («Обучение сотрудников», lms-backend src/staff_training): the track per role, the clip player's
 * calls, practical tasks in the training copy, and the progress pages for heads and admins.
 * Shapes follow docs/training/CONTRACTS.md §6.1–6.2.
 *
 * Every read opts out of the client cache: progress and results change by the minute and a stale «done» would
 * mislead the person looking at it.
 */
import { api, tokenManager, API_BASE_URL } from './client';
import { apiError } from './apiError';

export type Bilingual = { ru: string; en: string };
export type TrainingPlatform = 'lms' | 'crm';
export type TrainingState = 'done' | 'in_progress' | 'stuck' | 'not_started';
export type CheckStatus = 'passed' | 'failed' | 'error';

export interface ClipSummary {
  id: number;
  key: string;
  title: Bilingual;
  duration_ms: number;
  platform: TrainingPlatform;
  watch_pct?: number;
  questions_total?: number;
  questions_passed?: number;
  poster_url?: string | null;
}

export interface CheckItem { id: string; ok: boolean; ru: string; en: string }

export interface TaskResult {
  status: CheckStatus;
  message: Bilingual;
  checked_at: string;
  details?: { checks?: CheckItem[] };
}

export interface TaskSummary {
  id: number;
  key: string;
  platform: TrainingPlatform;
  title: Bilingual;
  /** Instructions (Markdown subset). */
  body?: Bilingual | null;
  last_result?: TaskResult | null;
}

export interface TrackItem {
  position: number;
  kind: 'clip' | 'task';
  required: boolean;
  done?: boolean;
  clip?: ClipSummary;
  task?: TaskSummary;
  /** The heads' detail page only: how many wrong answers (clip) or checks (task) it took. */
  attempts?: { questions?: unknown[]; wrong_total?: number; checks?: number; failed?: number };
}

export interface TrackView {
  id: number;
  role: string;
  title: Bilingual;
  version: number;
  state: TrainingState;
  done_items: number;
  total_items: number;
  completed_at: string | null;
  items: TrackItem[];
}

export interface TrainingEnrollment {
  id: number;
  kind: 'track' | 'clip';
  track_id: number | null;
  clip_id: number | null;
  source: 'new_hire' | 'assigned';
  required: boolean;
  due_at: string | null;
  completed_at: string | null;
}

export interface AssignedClip {
  clip: ClipSummary;
  done: boolean;
  due_at: string | null;
  enrollment_id: number;
  required: boolean;
}

export interface TrainingMe {
  user: { id: number; role: string; ui_locale: 'ru' | 'en' };
  enrollments: TrainingEnrollment[];
  track: TrackView | null;
  assigned_clips: AssignedClip[];
}

export interface LibraryTrack {
  id: number;
  role: string;
  title: Bilingual;
  items: TrackItem[];
}

export interface ClipSubtitle { lang: 'ru' | 'en'; label: string; url: string; default: boolean }
export interface ClipSegment { idx: number; start_ms: number; end_ms: number; text: Bilingual }
export interface QuestionOption { id: string; text: Bilingual }
export interface ClipQuestion {
  id: number;
  key: string;
  kind: 'single' | 'multi';
  prompt: Bilingual;
  options: QuestionOption[];
  passed: boolean;
}

export interface ClipDetail {
  id: number;
  key: string;
  title: Bilingual;
  /** `{ru: null, en: null}` when the clip has no summary. */
  summary: { ru: string | null; en: string | null } | null;
  platform: TrainingPlatform;
  duration_ms: number;
  content_version: number;
  video_url: string;
  poster_url: string | null;
  subtitles: ClipSubtitle[];
  segments: ClipSegment[];
  questions: ClipQuestion[];
  next_item: { kind: 'clip' | 'task'; id: number } | null;
  progress: { watch_pct: number; last_position_ms: number; watched: boolean; questions_passed: boolean };
}

export interface BeatBody { content_version: number; played: [number, number][]; position_ms: number }
export interface BeatResult { watch_pct: number; watched: boolean }

export interface AnswerResult {
  correct: boolean;
  explain?: { ms: number; text: Bilingual };
  clip_questions_passed: boolean;
  clip_done: boolean;
}

export interface CheckResult {
  status: CheckStatus;
  message: Bilingual;
  details?: { checks?: CheckItem[] };
  checked_at: string;
  task_done: boolean;
  track_done: boolean;
}

export interface ProgressRow {
  user: { id: number; name: string; email: string; role: string; created_at: string };
  required: boolean;
  state: TrainingState;
  done_items: number;
  total_items: number;
  current_item: { kind: 'clip' | 'task'; title: Bilingual; failed_attempts: number } | null;
  last_active_at: string | null;
  completed_at: string | null;
}

export interface ProgressList { rows: ProgressRow[]; counts: Record<TrainingState, number> }
export interface ProgressDetail {
  person: { id: number; name: string; role: string; last_active_at: string | null };
  user: ProgressRow['user'] & { is_active: boolean };
  enrollments: TrainingEnrollment[];
  track: TrackView | null;
  assigned_clips: AssignedClip[];
}

export interface ProgressFilters { role?: string; state?: string; required?: boolean }
export interface AssignBody {
  user_ids: number[];
  track_id: number | null;
  clip_ids: number[] | null;
  required: boolean;
  due_at: string | null;
}

const BASE = '/staff-training';

async function get<T>(path: string, fallback: string, params?: object): Promise<T> {
  try {
    return (await api.get(`${BASE}${path}`, { params, cache: false } as never)).data as T;
  } catch (error) {
    throw apiError(error, fallback);
  }
}

async function post<T>(path: string, body: unknown, fallback: string): Promise<T> {
  try {
    return (await api.post(`${BASE}${path}`, body)).data as T;
  } catch (error) {
    throw apiError(error, fallback);
  }
}

export const getTrainingMe = () => get<TrainingMe>('/me', 'Could not load your training');
export const getTrainingLibrary = async () => (await get<{ tracks: LibraryTrack[] }>('/library', 'Could not load the library')).tracks;
export const getTrainingClip = (id: number) => get<ClipDetail>(`/clips/${id}`, 'Could not load the clip');

export const sendBeat = async (clipId: number, body: BeatBody): Promise<BeatResult> => {
  try {
    return (await api.post(`${BASE}/clips/${clipId}/beats`, body)).data as BeatResult;
  } catch (error) {
    throw apiError(error, 'Could not save your progress');
  }
};

/**
 * The last beat of a page that is going away (tab hidden, closed): `keepalive` lets it finish after the page is
 * gone. Best effort; its answer is never read.
 */
export function sendBeatOnExit(clipId: number, body: BeatBody): void {
  const token = tokenManager.getAccessToken();
  try {
    void fetch(`${API_BASE_URL}${BASE}/clips/${clipId}/beats`, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    /* the page is going away: nothing to tell */
  }
}

export const answerQuestion = (questionId: number, chosen: string[]) =>
  post<AnswerResult>(`/questions/${questionId}/answer`, { chosen }, 'Could not check your answer');

/** Opens the single-use sign-in link. Never call this ahead of a click: the link is good for one use. */
export const openTask = (taskId: number) =>
  post<{ url: string; expires_at: string }>(`/tasks/${taskId}/open`, {}, 'Could not open the training copy');
export const checkTask = (taskId: number) => post<CheckResult>(`/tasks/${taskId}/check`, {}, 'Could not check the task');
export const resetPractice = (taskId: number) => post<{ ok: boolean }>(`/tasks/${taskId}/reset-practice`, {}, 'Could not reset the practice');

export const getTrainingProgress = (filters: ProgressFilters) =>
  get<ProgressList>('/progress', 'Could not load the progress', {
    role: filters.role || undefined,
    state: filters.state || undefined,
    required: filters.required === undefined ? undefined : filters.required,
  });
export const getTrainingProgressOf = (userId: number) => get<ProgressDetail>(`/progress/${userId}`, 'Could not load this person’s progress');

export const assignTraining = (body: AssignBody) =>
  post<{ created: number; skipped_existing: number }>('/assignments', body, 'Could not assign');
export const cancelAssignment = async (enrollmentId: number): Promise<void> => {
  try {
    await api.delete(`${BASE}/assignments/${enrollmentId}`);
  } catch (error) {
    throw apiError(error, 'Could not cancel the assignment');
  }
};
