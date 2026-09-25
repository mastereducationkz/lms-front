import type { AxiosProgressEvent } from 'axios';

import { errorMessage, preCheckFile } from '../../lib/classMaterials';
import { mediaUrl } from '../../lib/mediaUrl';
import { UploadFailedError } from '../../lib/uploadFailure';
import { api } from './client';

/**
 * «Материалы урока» — per-lesson teacher files and links. Mirrors the backend contract in
 * docs/class-materials/PLAN.md (Tasks 4–6) field for field; never cached (see `cache.ts`'s
 * TTL rule for `/class-materials`, and every GET below opts out per-call too, matching the
 * `recordings.ts` convention for signed/per-viewer data).
 */

export interface ClassFile {
  id: number;
  title: string;
  original_name: string;
  ext: string;
  mime_type: string;
  kind: 'file' | 'image' | 'audio';
  size_bytes: number;
  created_at: string;
  attached_count: number;
}

export interface LessonBrief {
  id: number;
  title: string;
  start_datetime: string;
  end_datetime: string;
  is_active: boolean;
  topic: string | null;
  group_ids: number[];
  group_names: string[];
}

export interface MaterialItemFile {
  id: number;
  ext: string;
  mime_type: string;
  kind: 'file' | 'image' | 'audio';
  size_bytes: number;
  original_name: string;
}

export interface MaterialItemRemoved {
  kind: 'moderated';
  reason: string;
  removed_at: string;
  removed_by_name: string | null;
}

export interface MaterialItem {
  id: number;
  event_id: number;
  kind: 'file' | 'link';
  title: string;
  position: number;
  show_after_end: boolean;
  hidden_until_end: boolean;
  added_by: { id: number; name: string } | null;
  added_at: string;
  file: MaterialItemFile | null;
  url: string | null;
  removed: MaterialItemRemoved | null;
  can_edit: boolean;
  can_detach: boolean;
  can_moderate: boolean;
}

export interface LessonMaterials {
  lesson: LessonBrief;
  items: MaterialItem[];
  pending_after_end: number;
  can_manage: boolean;
  can_moderate: boolean;
  can_see_catch_up: boolean;
  homework: { id: number; title: string }[];
  stats: { opened_count: number; roster_count: number } | null;
}

export interface FeedLessonEntry {
  lesson: LessonBrief;
  items: MaterialItem[];
  pending_after_end: number;
}

export interface FeedPage {
  lessons: FeedLessonEntry[];
  next_before: string | null;
  groups: { id: number; name: string }[];
}

export interface OpenResult {
  url: string;
  expires_at: string;
  kind: 'file' | 'image' | 'audio' | 'link';
  mime_type: string | null;
  filename: string | null;
}

/** The `detail.code` a class-materials route answers with, when it sent one. */
export function apiErrorCode(err: unknown): string | undefined {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (detail && typeof detail === 'object' && 'code' in (detail as Record<string, unknown>)) {
    const code = (detail as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export async function getClassMaterials(eventId: number): Promise<LessonMaterials> {
  const response = await api.get(`/class-materials/events/${eventId}/items`, { cache: false } as never);
  return response.data as LessonMaterials;
}

/**
 * Upload a file to the caller's shelf. Refuses client-side up front via `preCheckFile` (same
 * rule the backend enforces), so a doomed upload never leaves the browser. `onProgress` gets a
 * 0–100 percentage; the axios upload-stall watchdog (`uploadWatchdog.ts`) composes with it
 * automatically for any FormData body, no extra wiring needed here.
 */
export async function uploadClassFile(file: File, onProgress?: (pct: number) => void): Promise<ClassFile> {
  const rejection = preCheckFile(file);
  if (rejection) throw new UploadFailedError(file.name, errorMessage(rejection, 'en'));
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await api.post('/class-materials/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (event: AxiosProgressEvent) => {
          if (event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        }
        : undefined,
    } as never);
    return response.data as ClassFile;
  } catch (error) {
    throw new UploadFailedError(file.name, errorMessage(apiErrorCode(error), 'en'));
  }
}

export async function listMyClassFiles(
  p: { q?: string; beforeId?: number },
): Promise<{ items: ClassFile[]; next_before_id: number | null }> {
  const params: Record<string, string | number> = {};
  if (p.q) params.q = p.q;
  if (p.beforeId !== undefined) params.before_id = p.beforeId;
  const response = await api.get('/class-materials/files', { params, cache: false } as never);
  return response.data as { items: ClassFile[]; next_before_id: number | null };
}

export async function updateClassFile(id: number, patch: { title?: string; hidden?: boolean }): Promise<ClassFile> {
  const response = await api.patch(`/class-materials/files/${id}`, patch);
  return response.data as ClassFile;
}

export async function attachClassMaterials(
  eventId: number,
  body: { file_ids?: number[]; link?: { url: string; title?: string }; show_after_end?: boolean },
): Promise<LessonMaterials & { skipped: number }> {
  const response = await api.post(`/class-materials/events/${eventId}/items`, body);
  return response.data as LessonMaterials & { skipped: number };
}

export async function copyClassMaterials(
  eventId: number,
  sourceEventId: number,
): Promise<{ added: number; skipped: number; lesson: LessonMaterials }> {
  const response = await api.post(`/class-materials/events/${eventId}/copy-from/${sourceEventId}`);
  return response.data as { added: number; skipped: number; lesson: LessonMaterials };
}

export async function listMyMaterialLessons(
  excludeEventId?: number,
): Promise<{ lessons: { lesson: LessonBrief; item_count: number }[] }> {
  const params: Record<string, number> = {};
  if (excludeEventId !== undefined) params.exclude_event_id = excludeEventId;
  const response = await api.get('/class-materials/my-lessons', { params, cache: false } as never);
  return response.data as { lessons: { lesson: LessonBrief; item_count: number }[] };
}

export async function updateClassMaterialItem(
  id: number,
  patch: { show_after_end?: boolean; position?: number; link_title?: string },
): Promise<MaterialItem> {
  const response = await api.patch(`/class-materials/items/${id}`, patch);
  return response.data as MaterialItem;
}

export async function detachClassMaterialItem(id: number): Promise<void> {
  await api.delete(`/class-materials/items/${id}`);
}

export async function moderateRemoveClassMaterialItem(id: number, reason: string): Promise<MaterialItem> {
  const response = await api.post(`/class-materials/items/${id}/remove`, { reason });
  return response.data as MaterialItem;
}

export async function restoreClassMaterialItem(id: number): Promise<MaterialItem> {
  const response = await api.post(`/class-materials/items/${id}/restore`);
  return response.data as MaterialItem;
}

/**
 * Log an open and get a URL to show it. File items come back as a relative path
 * (`/class-materials/download/<token>`) — resolved here to an absolute API URL via
 * `mediaUrl`, the same helper every other uploaded-file surface uses. Link items pass their
 * external URL through untouched.
 */
export async function openClassMaterialItem(id: number): Promise<OpenResult> {
  const response = await api.post(`/class-materials/items/${id}/open`, null, { cache: false } as never);
  const data = response.data as OpenResult;
  if (data.kind === 'link') return data;
  return { ...data, url: mediaUrl(data.url) ?? data.url };
}

export async function getClassMaterialsFeed(
  p: { groupId?: number; q?: string; before?: string | null; limit?: number },
): Promise<FeedPage> {
  const params: Record<string, string | number> = {};
  if (p.groupId !== undefined) params.group_id = p.groupId;
  if (p.q) params.q = p.q;
  if (p.before) params.before = p.before;
  if (p.limit !== undefined) params.limit = p.limit;
  const response = await api.get('/class-materials/feed', { params, cache: false } as never);
  return response.data as FeedPage;
}

/** The backend refuses more than 100 event ids per request; slice before asking. */
export const CLASS_MATERIAL_COUNTS_BATCH = 100;

export async function getClassMaterialCounts(eventIds: number[]): Promise<Record<number, number>> {
  const ids = eventIds.slice(0, CLASS_MATERIAL_COUNTS_BATCH);
  if (!ids.length) return {};
  const response = await api.get('/class-materials/counts', {
    params: { event_ids: ids.join(',') },
    cache: false,
  } as never);
  const counts = (response.data?.counts ?? {}) as Record<string, number>;
  const result: Record<number, number> = {};
  Object.entries(counts).forEach(([key, value]) => {
    result[Number(key)] = value;
  });
  return result;
}

export async function getClassMaterialsCatchUp(
  eventId: number,
): Promise<{ students: { id: number; name: string }[] }> {
  const response = await api.get(`/class-materials/events/${eventId}/catch-up`, { cache: false } as never);
  return response.data as { students: { id: number; name: string }[] };
}
