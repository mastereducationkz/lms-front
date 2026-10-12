import type { AxiosRequestConfig } from 'axios';
import { api } from './client';

/**
 * Master League, staff side (lms-backend `src/master_league/`).
 *
 * The Telegram checklist is a live read of Support's chat registry and the group links, so it is
 * never served from cache: the point of the screen is to see a step turn green after someone did it.
 */

/**
 * One setup step. `ok` is true (done), false (open) or null (Support could not be reached, so the
 * step could not be checked). `label` and `hint` are the server's Russian wording, kept only as a
 * fallback for a step key this client does not know yet.
 */
export interface ChecklistStep {
  key: string;
  label: string;
  ok: boolean | null;
  hint: string;
}

export interface ChecklistGroup {
  id: number;
  name: string;
  teacher_name: string | null;
  ready: boolean;
  steps: ChecklistStep[];
}

export interface TelegramChecklist {
  /** Set when Support could not be reached: the chat steps are then `ok: null`. */
  registry_error: string | null;
  /** Live Master League groups only (finished and switched-off ones are left out by the server). */
  groups: ChecklistGroup[];
}

const NO_CACHE = { cache: false } as AxiosRequestConfig & { cache?: boolean };

export async function getTelegramChecklist(): Promise<TelegramChecklist> {
  const response = await api.get('/master-league/telegram-checklist', NO_CACHE);
  return response.data;
}

/** The backend's own reason for a failed call, when it gave one. */
export function failureDetail(error: unknown): string | null {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const message = error instanceof Error ? error.message : '';
  return message.trim() || null;
}
