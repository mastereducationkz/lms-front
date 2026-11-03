/**
 * The training copy's own API (lms-backend src/training_copy, mounted only when TRAINING_MODE=true): redeeming the
 * one-click login link from production, and the inbox of everything the copy would have sent.
 */
import axios from 'axios';
import type { User } from '../../types';
import { api, API_BASE_URL, tokenManager } from './client';
import { getCurrentUser } from './auth';

export interface InboxMessage {
  id: number;
  created_at: string | null;
  source_app: 'lms' | 'crm';
  channel: string;
  kind: string;
  recipient_kind: 'parent' | 'student' | 'staff' | 'group_chat' | 'external' | 'unknown';
  recipient_label: string;
  subject: string | null;
  body_text: string;
  has_html: boolean;
}

export interface InboxMessageFull extends InboxMessage {
  body_html: string | null;
  payload: Record<string, unknown>;
}

export interface LinkLogin {
  user: User;
  path: string;
  task: string | null;
}

/** The path prod put in the link, kept to a path on this site: a leading slash and no `//` or backslash. */
export function safePath(path: unknown): string {
  return typeof path === 'string' && /^\/($|[^/\\])/.test(path) ? path : '/dashboard';
}

/** Spends the single-use link. Every refusal is one 401 with no reason (the server logs it); the caller shows one sentence. */
export async function redeemTrainingLink(token: string): Promise<LinkLogin> {
  const response = await axios.post(`${API_BASE_URL}/training-copy/login`, { t: token }, { withCredentials: true });
  const { access_token, refresh_token, path, task } = response.data;
  tokenManager.setTokens(access_token, refresh_token);
  const user = await getCurrentUser();
  return { user, path: safePath(path), task: typeof task === 'string' ? task : null };
}

export async function fetchInbox(params: { channel?: string; before_id?: number; limit?: number } = {}): Promise<InboxMessage[]> {
  const response = await api.get('/training-copy/inbox', { params });
  return response.data.messages as InboxMessage[];
}

export async function fetchInboxMessage(id: number): Promise<InboxMessageFull> {
  const response = await api.get(`/training-copy/inbox/${id}`);
  return response.data as InboxMessageFull;
}
