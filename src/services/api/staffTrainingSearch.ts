/**
 * Staff training search (lms-backend src/staff_training/search, docs/training/CONTRACTS.md §6.8): one call for the
 * results, grouped by clip, handbook or task; a second, after the results are on screen, for the short written answer.
 * Neither read goes through the client cache: the library changes whenever the pipeline registers a clip.
 */
import { api } from './client';
import { apiError } from './apiError';
import type { Bilingual } from './staffTraining';

const BASE = '/staff-training/search';

export type SearchDocument =
  | { kind: 'clip'; clip_id: number; title: Bilingual; role_tracks: string[] }
  | { kind: 'task'; task_id: number; title: Bilingual; role_tracks: string[] }
  | { kind: 'handbook'; key: string; title: Bilingual; url: string | null };

export interface SearchMoment {
  chunk_id: number;
  /** null for a title/summary chunk, a task or a handbook section. */
  start_ms: number | null;
  /** «0:42», or '' when there is no time. */
  label: string;
  text: Bilingual;
  /** The text with `<mark>…</mark>` around the hits; every other `<`, `>` and `&` is HTML-escaped. */
  highlight: Bilingual;
  /** Handbooks only. */
  anchor?: string | null;
  url?: string | null;
}

export interface SearchResult { document: SearchDocument; score: number; moments: SearchMoment[] }
export interface SearchResponse { query: string; results: SearchResult[]; answer_available: boolean }

export interface AnswerCitation {
  chunk_id: number;
  label: string;
  clip_id: number | null;
  kind: 'clip' | 'task' | 'handbook';
  start_ms: number | null;
  task_id: number | null;
  key?: string;
  anchor?: string | null;
  url?: string | null;
}

export type AnswerReason = 'cap_reached' | 'disabled' | 'error' | 'user_limit';
export interface AnswerResponse { answer: string | null; unknown: boolean; citations: AnswerCitation[]; reason: AnswerReason | null }

export async function searchTraining(q: string, limit = 10): Promise<SearchResponse> {
  try {
    return (await api.get(BASE, { params: { q, limit }, cache: false } as never)).data as SearchResponse;
  } catch (error) {
    throw apiError(error, 'Could not search the training');
  }
}

export async function answerTraining(q: string, chunkIds: number[]): Promise<AnswerResponse> {
  try {
    return (await api.post(`${BASE}/answer`, { q, chunk_ids: chunkIds })).data as AnswerResponse;
  } catch (error) {
    throw apiError(error, 'Could not write an answer');
  }
}
