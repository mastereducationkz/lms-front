import { mediaUrl } from '../../lib/mediaUrl';
import { UploadFailedError, uploadFailureReason } from '../../lib/uploadFailure';
import {
  missingChunks, planChunks, preCheckLibraryFile, retryDelayMs, uploadPercent,
} from '../../lib/library';
import { COPY, errorMessage, t, type Locale } from '../../lib/classMaterials';
import { api } from './client';
import { apiErrorCode, type ClassFile, type MaterialItemFile, type OpenResult } from './classMaterials';

/**
 * «Библиотека» — program libraries and teacher sections (docs/materials-library/SPEC.md §6–§7).
 * Every GET opts out of the request cache: the library is per-viewer. Mutations answer with
 * whatever the backend returns, but callers refetch `getLibrary()` afterwards rather than
 * patching state from a response shape, so only the upload/open responses are typed strictly.
 */

const BASE = '/class-materials/library';
const NO_CACHE = { cache: false } as never;

export type LibraryProgram = 'sat' | 'ielts' | 'general_english' | 'nuet';

export interface LibraryItem {
  id: number;
  kind: 'file' | 'link';
  title: string;
  position: number;
  file: MaterialItemFile | null;
  url: string | null;
  added_by: { id: number; name: string } | null;
  added_at: string;
  removed: { reason: string; removed_at: string; removed_by_name: string | null } | null;
  /** Students who opened it — managers only, null for everyone else. */
  open_count: number | null;
  can_remove: boolean;
  can_moderate: boolean;
}

export interface LibrarySection {
  id: number;
  scope: 'program' | 'teacher';
  program_type: LibraryProgram | null;
  title: string;
  teachers_only: boolean;
  position: number;
  owner: { id: number; name: string } | null;
  /** The groups a teacher section is shared with — its owner and admins only. */
  shared_group_ids?: number[] | null;
  can_manage: boolean;
  items: LibraryItem[];
}

export interface LibraryProgramBlock {
  program: LibraryProgram;
  label: string;
  can_manage: boolean;
  sections: LibrarySection[];
}

export interface LibraryGroupBlock {
  group_id: number;
  group_name: string;
  teacher_name: string | null;
  sections: LibrarySection[];
}

export interface LibraryView {
  programs: LibraryProgramBlock[];
  groups: LibraryGroupBlock[];
  can_create_teacher_sections: boolean;
}

export interface MyLibrary {
  sections: LibrarySection[];
  shareable_groups: { id: number; name: string }[];
}

export async function getLibrary(): Promise<LibraryView> {
  const response = await api.get(BASE, NO_CACHE);
  const data = (response.data ?? {}) as Partial<LibraryView>;
  return {
    programs: Array.isArray(data.programs) ? data.programs : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
    can_create_teacher_sections: !!data.can_create_teacher_sections,
  };
}

export async function getMyLibrary(): Promise<MyLibrary> {
  const response = await api.get(`${BASE}/mine`, NO_CACHE);
  const data = (response.data ?? {}) as Partial<MyLibrary>;
  return {
    sections: Array.isArray(data.sections) ? data.sections : [],
    shareable_groups: Array.isArray(data.shareable_groups) ? data.shareable_groups : [],
  };
}

export async function createLibrarySection(body: {
  scope: 'program' | 'teacher';
  program_type?: LibraryProgram;
  title: string;
  teachers_only?: boolean;
}): Promise<unknown> {
  return (await api.post(`${BASE}/sections`, body)).data;
}

export async function updateLibrarySection(id: number, patch: { title?: string; teachers_only?: boolean }): Promise<unknown> {
  return (await api.patch(`${BASE}/sections/${id}`, patch)).data;
}

export async function archiveLibrarySection(id: number): Promise<unknown> {
  return (await api.post(`${BASE}/sections/${id}/archive`)).data;
}

export async function reorderLibrarySections(ids: number[]): Promise<unknown> {
  return (await api.post(`${BASE}/sections/reorder`, { ids })).data;
}

export async function setLibrarySectionGroups(id: number, groupIds: number[]): Promise<unknown> {
  return (await api.put(`${BASE}/sections/${id}/groups`, { group_ids: groupIds })).data;
}

/** Take a section out of one group — the group's own teacher may do this to a colleague's section. */
export async function unshareLibrarySection(id: number, groupId: number): Promise<void> {
  await api.delete(`${BASE}/sections/${id}/groups/${groupId}`);
}

/** A library error as a sentence: our copy for a known `detail.code`, else the server's own message. */
export function libraryErrorText(error: unknown, locale: Locale): string {
  const code = apiErrorCode(error);
  if (code && Object.prototype.hasOwnProperty.call(COPY, code)) return t(code as keyof typeof COPY, locale);
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string') {
    return (detail as { message: string }).message;
  }
  if (typeof detail === 'string' && detail.trim()) return detail;
  return t('somethingWrong', locale);
}

export async function addLibraryItem(
  sectionId: number,
  body: { file_id: number } | { url: string; link_title?: string },
): Promise<unknown> {
  return (await api.post(`${BASE}/sections/${sectionId}/items`, body)).data;
}

export async function updateLibraryItem(id: number, patch: { link_title?: string }): Promise<unknown> {
  return (await api.patch(`${BASE}/items/${id}`, patch)).data;
}

export async function reorderLibraryItems(sectionId: number, ids: number[]): Promise<unknown> {
  return (await api.post(`${BASE}/sections/${sectionId}/items/reorder`, { ids })).data;
}

export async function detachLibraryItem(id: number): Promise<void> {
  await api.delete(`${BASE}/items/${id}`);
}

export async function moderateRemoveLibraryItem(id: number, reason: string): Promise<unknown> {
  return (await api.post(`${BASE}/items/${id}/remove`, { reason })).data;
}

/** Log the open and get a URL: a file's token path resolved to the API host, a link passed through. */
export async function openLibraryItem(id: number): Promise<OpenResult> {
  const response = await api.post(`${BASE}/items/${id}/open`, null, NO_CACHE);
  const data = response.data as OpenResult;
  if (data.kind === 'link') return data;
  return { ...data, url: mediaUrl(data.url) ?? data.url };
}

// ── chunked, resumable upload (SPEC §6) ────────────────────────────────────────────────

export interface UploadSession {
  upload_id: string;
  chunk_size: number;
}

/** One chunk may take this long on a slow phone connection; the instance's 20 s would kill it. */
const CHUNK_TIMEOUT_MS = 180_000;
const CHUNK_TRIES = 3;

export async function createLibraryUpload(filename: string, size: number): Promise<UploadSession> {
  return (await api.post(`${BASE}/uploads`, { filename, size })).data as UploadSession;
}

export async function putLibraryChunk(
  uploadId: string,
  index: number,
  chunk: Blob,
  opts: { signal?: AbortSignal; onBytes?: (loaded: number) => void } = {},
): Promise<void> {
  await api.put(`${BASE}/uploads/${uploadId}/chunks/${index}`, chunk, {
    headers: { 'Content-Type': 'application/octet-stream' },
    timeout: CHUNK_TIMEOUT_MS,
    signal: opts.signal,
    onUploadProgress: opts.onBytes ? (event: { loaded: number }) => opts.onBytes?.(event.loaded) : undefined,
  } as never);
}

export async function getLibraryUploadStatus(uploadId: string): Promise<{ received: number[]; chunk_size: number | null }> {
  const response = await api.get(`${BASE}/uploads/${uploadId}`, NO_CACHE);
  const data = (response.data ?? {}) as { received?: unknown; chunk_size?: unknown };
  const received = Array.isArray(data.received) ? data.received.filter((n): n is number => typeof n === 'number') : [];
  return { received, chunk_size: typeof data.chunk_size === 'number' && data.chunk_size > 0 ? data.chunk_size : null };
}

export async function finishLibraryUpload(uploadId: string): Promise<ClassFile> {
  return (await api.post(`${BASE}/uploads/${uploadId}/finish`, null, { timeout: CHUNK_TIMEOUT_MS } as never)).data as ClassFile;
}

/** A failed upload that can be resumed: `uploadId` is the server session the chunks went to. */
export class LibraryUploadError extends UploadFailedError {
  constructor(fileName: string, reason: string, readonly uploadId: string | null, readonly cancelled = false) {
    super(fileName, reason);
    this.name = 'LibraryUploadError';
  }
}

function isAbort(error: unknown): boolean {
  const e = error as { code?: string; name?: string } | null;
  return e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError';
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('canceled'), { name: 'AbortError' }));
    }, { once: true });
  });
}

function reasonFor(error: unknown): string {
  const code = apiErrorCode(error);
  if (code === 'too_large') return errorMessage('library_too_large', 'en');
  if (code) return libraryErrorText(error, 'en');
  const reason = uploadFailureReason(error);
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

/**
 * Send one file to the caller's shelf in chunks: a new server session, or `resumeId`'s, whose
 * already-received chunks are skipped. Each chunk is tried three times with 1 s/2 s backoff; a
 * failure keeps the session id on the error so «Повторить» resumes instead of starting over.
 */
export async function uploadLibraryFile(
  file: File,
  opts: { onProgress?: (pct: number) => void; signal?: AbortSignal; resumeId?: string | null } = {},
): Promise<ClassFile> {
  const rejection = preCheckLibraryFile(file);
  if (rejection) throw new LibraryUploadError(file.name, errorMessage(rejection, 'en'), null);

  let uploadId = opts.resumeId ?? null;
  try {
    let chunkSize: number;
    let received: number[] = [];
    let status: { received: number[]; chunk_size: number | null } | null = null;
    if (uploadId) {
      try {
        status = await getLibraryUploadStatus(uploadId);
      } catch (error) {
        // A session the server already ended (a 4xx on finish, or swept after 24 h) starts over.
        const code = (error as { response?: { status?: number } })?.response?.status;
        if (!code || code >= 500) throw error;
        SESSION_CHUNK.delete(uploadId);
        uploadId = null;
      }
    }
    if (uploadId && status) {
      received = status.received;
      chunkSize = status.chunk_size ?? SESSION_CHUNK.get(uploadId) ?? 5 * 1024 * 1024;
    } else {
      const session = await createLibraryUpload(file.name, file.size);
      uploadId = session.upload_id;
      chunkSize = session.chunk_size;
      SESSION_CHUNK.set(uploadId, chunkSize);
    }
    const plan = planChunks(file.size, chunkSize);
    const done = new Set(received);
    opts.onProgress?.(uploadPercent(plan, done));

    for (const chunk of missingChunks(plan, received)) {
      for (let attempt = 1; ; attempt += 1) {
        try {
          await putLibraryChunk(uploadId, chunk.index, file.slice(chunk.start, chunk.end), {
            signal: opts.signal,
            onBytes: (loaded) => opts.onProgress?.(uploadPercent(plan, done, loaded)),
          });
          break;
        } catch (error) {
          if (isAbort(error) || attempt >= CHUNK_TRIES) throw error;
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) throw error;
          await wait(retryDelayMs(attempt), opts.signal);
        }
      }
      done.add(chunk.index);
      opts.onProgress?.(uploadPercent(plan, done));
    }
    const classFile = await finishLibraryUpload(uploadId);
    SESSION_CHUNK.delete(uploadId);
    return classFile;
  } catch (error) {
    if (error instanceof LibraryUploadError) throw error;
    if (isAbort(error)) throw new LibraryUploadError(file.name, 'Cancelled', uploadId, true);
    throw new LibraryUploadError(file.name, reasonFor(error), uploadId);
  }
}

/** The chunk size each live session was opened with, so a resume cuts the file the same way. */
const SESSION_CHUNK = new Map<string, number>();
