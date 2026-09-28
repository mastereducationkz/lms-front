import { API_BASE } from './config';
import { client as defaultClient, type ApiClient } from './api';
import type { LessonNote, LessonStatus, LessonView, NoteKind } from '../services/api/classLessons';
import type { LessonMaterials, OpenResult } from '../services/api/classMaterials';

/**
 * The panel's reads and writes: the lesson page's own endpoints (`GET /lessons/{id}`, notes,
 * activity scores, class materials) plus the one the panel adds, `GET /lessons/by-meet-code/{code}`,
 * which finds the lesson running in this Meet. Types come from the main app (type-only imports,
 * so nothing of its API client is bundled).
 */

export interface LessonBrief { id: number; title: string; start: string; end: string; status: LessonStatus }

export interface ByMeetCode {
  code: string;
  lesson: LessonBrief | null;
  previous: LessonBrief | null;
  next: LessonBrief | null;
}

export type LessonChoice =
  | { kind: 'lesson'; id: number }
  | { kind: 'none'; previous: LessonBrief | null; next: LessonBrief | null };

/** The lesson to show for a meeting, or the choice to offer when nothing runs in it now. */
export function pickLesson(found: ByMeetCode): LessonChoice {
  if (found.lesson) return { kind: 'lesson', id: found.lesson.id };
  return { kind: 'none', previous: found.previous, next: found.next };
}

/** File items open through a relative `/class-materials/download/<token>` on the API host. */
export function absoluteUrl(url: string, base: string = API_BASE): string {
  return url.startsWith('/') ? `${base}${url}` : url;
}

export function lessonsApi(api: Pick<ApiClient, 'request'> = defaultClient) {
  return {
    byMeetCode: (code: string) => api.request<ByMeetCode>(`/lessons/by-meet-code/${encodeURIComponent(code)}`),
    lesson: (id: number) => api.request<LessonView>(`/lessons/${id}`),
    saveNote: (id: number, kind: NoteKind, text: string) =>
      api.request<LessonNote | null>(`/lessons/${id}/notes/${kind}`, { method: 'PUT', body: JSON.stringify({ text }) }),
    saveScores: (id: number, scores: { student_id: number; activity_score: number }[]) =>
      api.request<{ written: number }>(`/events/${id}/activity-scores`, { method: 'PUT', body: JSON.stringify({ scores }) }),
    materials: (id: number) => api.request<LessonMaterials>(`/class-materials/events/${id}/items`),
    openMaterial: async (itemId: number) => {
      const opened = await api.request<OpenResult>(`/class-materials/items/${itemId}/open`, { method: 'POST' });
      return { ...opened, url: absoluteUrl(opened.url) };
    },
  };
}

export const lessons = lessonsApi();
