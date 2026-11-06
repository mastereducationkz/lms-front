/**
 * A student's own highlights and notes on lesson text, quiz passages and homework
 * (lms-backend `/annotations`, own rows only, private: owner Q9, 2026-11-02).
 * Quiz highlights belong to an attempt: the server numbers it, so a retake starts clean and the
 * review of a finished attempt shows what was marked during it.
 */
import { api } from './client';
import type { AnnotationColor } from '@/lib/annotations/paint';

export type AnnotationSurface = 'quiz' | 'homework' | 'lesson';

export interface TextAnnotation {
  id: number;
  block_key: string;
  color: AnnotationColor;
  start_offset: number;
  end_offset: number;
  quote: string;
  prefix: string;
  suffix: string;
  note: string | null;
  attempt_no: number;
  created_at?: string;
  updated_at?: string;
}

export interface NewAnnotation {
  block_key: string;
  color: AnnotationColor;
  start_offset: number;
  end_offset: number;
  quote: string;
  prefix: string;
  suffix: string;
  note?: string | null;
}

export async function listAnnotations(
  surface: AnnotationSurface,
  targetId: number,
  attempt: 'current' | 'latest' = 'current',
): Promise<{ attempt_no: number; annotations: TextAnnotation[] }> {
  // Never from the client cache: which attempt is «current» changes when a quiz is submitted,
  // which no /annotations mutation tells the cache about (a retake showed the last attempt's marks).
  const options = { params: { surface, target_id: targetId, attempt }, cache: false, timeout: 10000 } as never;
  try {
    const response = await api.get('/annotations', options);
    return response.data;
  } catch (error) {
    // Reading is safe to repeat. A timed-out write could already have reached the server,
    // so only this GET gets a second chance during a brief connection interruption.
    const code = (error as { code?: unknown } | null)?.code;
    if (code !== 'ECONNABORTED' && code !== 'ETIMEDOUT' && code !== 'ERR_NETWORK') throw error;
    const response = await api.get('/annotations', options);
    return response.data;
  }
}

export async function createAnnotation(surface: AnnotationSurface, targetId: number, body: NewAnnotation): Promise<TextAnnotation> {
  const response = await api.post('/annotations', { surface, target_id: targetId, ...body });
  return response.data;
}

export async function updateAnnotation(id: number, patch: { color?: AnnotationColor; note?: string | null }): Promise<TextAnnotation> {
  const response = await api.patch(`/annotations/${id}`, patch);
  return response.data;
}

export async function deleteAnnotation(id: number): Promise<void> {
  await api.delete(`/annotations/${id}`);
}

export async function importAnnotations(
  surface: AnnotationSurface,
  targetId: number,
  items: Omit<NewAnnotation, 'note'>[],
): Promise<{ imported: number }> {
  const response = await api.post('/annotations/import', { surface, target_id: targetId, items });
  return response.data;
}
