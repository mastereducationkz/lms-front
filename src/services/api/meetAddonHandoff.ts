import { api } from './client';
import type { HandoffInfo } from '../../lib/meetAddonLink';

/**
 * The Meet add-on's sign-in popup, answering the handoff a Meet side panel started
 * (lms-backend `/auth/addon-handoff`). Per-request and one-off: never cached.
 */

export class HandoffRequestError extends Error {
  constructor(readonly status: number | null, readonly detail: string | null) {
    super(detail ?? 'Request failed');
  }
}

const NO_CACHE = { cache: false } as never;

function asError(error: unknown): HandoffRequestError {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail;
  return new HandoffRequestError(response?.status ?? null, typeof detail === 'string' ? detail : null);
}

export async function describeHandoff(id: string): Promise<HandoffInfo> {
  try {
    const response = await api.get(`/auth/addon-handoff/${encodeURIComponent(id)}`, NO_CACHE);
    return response.data as HandoffInfo;
  } catch (error) {
    throw asError(error);
  }
}

export async function answerHandoff(id: string, approve: boolean): Promise<void> {
  try {
    await api.post(`/auth/addon-handoff/${encodeURIComponent(id)}/${approve ? 'approve' : 'deny'}`);
  } catch (error) {
    throw asError(error);
  }
}
