import { api } from './client';
import type { MeetSync } from './meetAttendance';
import type { RecordingStatus } from '../../types';

/**
 * What the backend says about a lesson's recording.
 *
 * `missing` covers both "this lesson was never recorded" and "you may not see it" — the
 * endpoint returns 404 to anyone outside the group rather than 403, so that the existence
 * of a recording is not confirmed to someone who cannot watch it. The UI must therefore
 * treat "missing" as "show nothing", never as an error. `waiting` means no recording yet on
 * purpose: the lesson is still on, or Google Meet is finishing the file.
 */
export type LessonRecordingStatus = 'ready' | 'pending' | 'failed' | 'removed' | 'missing' | 'waiting';

/** Where a recording is on its way to watchable (2026-09-15). `ready`, `failed` and `removed` are final. */
export type RecordingStage =
  | 'lesson_running' | 'waiting_for_google' | 'queued' | 'processing' | 'retrying' | 'ready' | 'failed' | 'removed';

/** The step of preparing a recording under way — only while `processing`. */
export type RecordingPhase = 'downloading' | 'packaging' | 'preview' | 'uploading';

export interface RecordingProgress {
  stage: RecordingStage;
  phase: RecordingPhase | null;
  /** 0–100, when the step's size is known. */
  phase_percent: number | null;
  /** 0–100 across every step, while processing. */
  percent: number | null;
  /** Left in the step under way — only from a rate the server measured, never a guess. */
  eta_seconds: number | null;
  /** 1-based place in the line (queued, retrying). */
  position: number | null;
  queue_length: number | null;
  /** The worker holds the line: the server's disk is nearly full. */
  held_for_disk: boolean;
  attempts: number;
  max_attempts: number;
  /** Staff only: the last failure, first line. */
  error: string | null;
  lesson_ended_at: string | null;
  /** Waiting on Google: when the lesson would be flagged as having no recording. */
  missing_after: string | null;
  /** When the LMS found the recording file. */
  claimed_at: string | null;
  /** When the worker last reported this progress. */
  updated_at: string | null;
  sync: MeetSync | null;
}

export interface LessonRecording {
  status: LessonRecordingStatus;
  /** Signed HLS URL, scoped to the current viewer and short-lived. Only when ready. */
  url: string | null;
  /** Signed preview image under the same token. Only when ready, and only if one was made. */
  poster_url?: string | null;
  duration_seconds?: number | null;
  /** While not ready: stage, step, percent, place in line. Absent from an older server. */
  progress?: RecordingProgress | null;
}

/**
 * Fetch a lesson's recording.
 *
 * **Never cached.** The URL carries a signed token minted for this viewer and expires, so
 * a cached response would either hand one viewer's token to another or replay an expired
 * one. The backend deliberately excludes this route from its cache rules for the same
 * reason; `{ cache: false }` is the client half of that contract.
 */
export async function getLessonRecording(eventId: number): Promise<LessonRecording> {
  try {
    const response = await api.get(`/events/${eventId}/recording`, { cache: false } as never);
    return response.data as LessonRecording;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 403) {
      // Not visible to this viewer, or no such lesson. Indistinguishable by design.
      return { status: 'missing', url: null };
    }
    throw new Error('Failed to load the recording');
  }
}


/** One card in the Recordings library. Times are UTC ISO strings with a Z. */
export interface RecordingLibraryItem {
  event_id: number;
  title: string;
  topic: string | null;
  start_datetime: string;
  end_datetime: string;
  groups: { id: number; name: string }[];
  teacher: { id: number; name: string | null } | null;
  status: RecordingStatus;
  duration_seconds: number | null;
  /** Signed for this viewer; null while processing, when removed, or if no preview exists. */
  poster_url: string | null;
  ingested_at: string | null;
  /** While not ready: stage, step, percent, place in line. Absent from an older server. */
  progress?: RecordingProgress | null;
}

/** One lesson's news for a card or the player: what `GET /recordings/status` returns per lesson. */
export interface RecordingStatusEntry {
  status: LessonRecordingStatus;
  progress: RecordingProgress | null;
  /** Signed for this viewer, once ready. */
  poster_url: string | null;
  duration_seconds: number | null;
}

/** The most lessons one status request may ask about. */
export const RECORDING_STATUS_BATCH = 48;

/**
 * The live status of several lessons at once — the library asks this for every card still on its
 * way in one request, never one request per card. Lessons the viewer may not see are left out.
 * **Never cached**: a ready entry's preview link carries a token minted for this viewer.
 */
export async function getRecordingStatuses(eventIds: number[]): Promise<Record<string, RecordingStatusEntry>> {
  const ids = eventIds.slice(0, RECORDING_STATUS_BATCH);
  if (!ids.length) return {};
  const response = await api.get('/recordings/status', { params: { event_ids: ids.join(',') }, cache: false } as never);
  return (response.data?.items ?? {}) as Record<string, RecordingStatusEntry>;
}

/** Try a failed recording again (admins, head teachers, head curators). Returns its new status. */
export async function retryRecording(eventId: number): Promise<RecordingStatusEntry> {
  try {
    const response = await api.post(`/recordings/${eventId}/retry`);
    return response.data as RecordingStatusEntry;
  } catch (error: unknown) {
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Could not try the recording again');
  }
}

export interface RecordingFacets {
  /** Includes completed and archived groups: recording history must remain findable. */
  groups: { id: number; name: string; is_active: boolean | null; is_over: boolean | null }[];
  teachers: { id: number; name: string | null }[];
}

export interface RecordingLibraryPage {
  items: RecordingLibraryItem[];
  next_cursor: string | null;
  /** First page only. */
  total?: number;
  /** First page only: what the filter menus can offer, from the viewer's whole library. */
  facets?: RecordingFacets;
}

export type RecordingPeriod = '7d' | '30d' | 'all';

export interface RecordingLibraryQuery {
  limit?: number;
  cursor?: string | null;
  q?: string;
  group_id?: number | null;
  teacher_id?: number | null;
  period?: RecordingPeriod;
  status?: 'ready' | 'pending' | 'failed' | null;
  /** One Almaty day, "YYYY-MM-DD"; the server lets it win over `period`. */
  date?: string | null;
}

export type RecordingGroupState = 'active' | 'finished' | 'archived';

/** One group folder under the teacher who actually taught its recorded lessons. */
export interface RecordingFolderGroup {
  id: number;
  name: string;
  state: RecordingGroupState;
  video_count: number;
  /** How many recordings were taught by a substitute for this group's regular teacher. */
  substitution_count: number;
  regular_teacher: { id: number; name: string | null } | null;
}

export interface RecordingFolderTeacher {
  id: number | null;
  name: string | null;
  video_count: number;
  group_count: number;
  groups: RecordingFolderGroup[];
}

/** Compact navigation data for Folders view; it never contains a media URL. */
export interface RecordingFolders {
  teachers: RecordingFolderTeacher[];
}

/**
 * A page of the viewer's Recordings library. **Never cached**: the preview links carry a
 * media token minted for this viewer, exactly like the playback URL.
 */
export async function listRecordings(query: RecordingLibraryQuery = {}): Promise<RecordingLibraryPage> {
  const params: Record<string, string | number> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && !(key === 'period' && value === 'all')) {
      params[key] = value as string | number;
    }
  });
  const response = await api.get('/recordings', { params, cache: false } as never);
  return response.data as RecordingLibraryPage;
}

/**
 * The server-side Teacher → Group index, narrowed by the exact same search and filters as the
 * recording cards. This prevents older videos disappearing because they are beyond gallery page one.
 */
export async function listRecordingFolders(
  query: Omit<RecordingLibraryQuery, 'limit' | 'cursor'>,
): Promise<RecordingFolders> {
  const params: Record<string, string | number> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && !(key === 'period' && value === 'all')) {
      params[key] = value as string | number;
    }
  });
  const response = await api.get('/recordings/folders', { params, cache: false } as never);
  return response.data as RecordingFolders;
}

/** How many recordings each Almaty day of a month holds; days without any are left out. */
export interface RecordingDays {
  month: string;
  days: Record<string, number>;
  total: number;
}

export type RecordingDaysQuery = Pick<RecordingLibraryQuery, 'q' | 'group_id' | 'teacher_id' | 'status'> & {
  month: string;
};

/** The date picker's marks, under the list's own filters (not its period or date). */
export async function listRecordingDays(query: RecordingDaysQuery): Promise<RecordingDays> {
  const params: Record<string, string | number> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params[key] = value as string | number;
  });
  const response = await api.get('/recordings/days', { params, cache: false } as never);
  return response.data as RecordingDays;
}
