import { api } from './client';
import { liveApi, type Requester } from '../../lib/liveLesson/api';

/**
 * The live lesson over the main app's axios client (cookies, refresh, the request cache — `/live`
 * is never cached, see cache.ts). The Meet panel builds the same API over its own Bearer client.
 */
const request: Requester = async <T,>(path: string, init?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }): Promise<T> => {
  try {
    const response = await api.request<T>({ url: path, method: init?.method ?? 'GET', data: init?.body });
    return response.data;
  } catch (error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    throw new Error(typeof detail === 'string' ? detail : (error as Error)?.message || 'Request failed');
  }
};

export const live = liveApi(request);
