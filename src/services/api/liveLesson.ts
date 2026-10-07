import { api } from './client';
import { liveApi, type Requester } from '../../lib/liveLesson/api';
import { LiveRequestError } from '../../lib/liveLesson/resilience';

/**
 * The live lesson over the main app's axios client (cookies, refresh, the request cache — `/live`
 * is never cached, see cache.ts). The Meet panel builds the same API over its own Bearer client.
 */
const request: Requester = async <T,>(path: string, init?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }): Promise<T> => {
  try {
    const response = await api.request<T>({ url: path, method: init?.method ?? 'GET', data: init?.body });
    return response.data;
  } catch (error) {
    // Keep the status (null = no response at all) so a deploy's blip can be told from a refusal.
    const failed = error as { isAxiosError?: boolean; response?: { status?: number; data?: { detail?: unknown } } };
    const detail = failed?.response?.data?.detail;
    const status = failed?.response?.status ?? (failed?.isAxiosError ? null : undefined);
    throw new LiveRequestError(typeof detail === 'string' ? detail : (error as Error)?.message || 'Request failed', status);
  }
};

export const live = liveApi(request);
