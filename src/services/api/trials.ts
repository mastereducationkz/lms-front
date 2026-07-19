import type { TrialAccess, TrialCreateRequest, TrialUpdateRequest } from '../../types';
import { api } from './client';

export interface TrialCreateResponse {
  trials: TrialAccess[]; // one grant per course
  trial?: TrialAccess; // legacy alias (= trials[0])
  generated_password: string | null;
}

/** Surface the backend's error `detail` (e.g. 409 conflict messages) when present. */
function rethrow(error: unknown, fallback: string): never {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  throw new Error(typeof detail === 'string' ? detail : fallback);
}

export async function createTrial(data: TrialCreateRequest): Promise<TrialCreateResponse> {
  try {
    const response = await api.post('/trials/', data);
    return response.data;
  } catch (error) {
    rethrow(error, 'Failed to create trial');
  }
}

export async function getTrials(params?: {
  status?: string;
  course_id?: number;
  search?: string;
}): Promise<{ trials: TrialAccess[] }> {
  try {
    const response = await api.get('/trials/', { params });
    return response.data;
  } catch (error) {
    rethrow(error, 'Failed to fetch trials');
  }
}

export async function updateTrial(id: number, data: TrialUpdateRequest): Promise<TrialAccess> {
  try {
    const response = await api.patch(`/trials/${id}`, data);
    return response.data;
  } catch (error) {
    rethrow(error, 'Failed to update trial');
  }
}

export async function revokeTrial(id: number): Promise<TrialAccess> {
  try {
    const response = await api.post(`/trials/${id}/revoke`);
    return response.data;
  } catch (error) {
    rethrow(error, 'Failed to revoke trial');
  }
}

export async function resendTrialInvite(id: number): Promise<{ sent: boolean }> {
  try {
    const response = await api.post(`/trials/${id}/resend-invite`);
    return response.data;
  } catch (error) {
    rethrow(error, 'Failed to resend trial invite');
  }
}

export async function convertTrial(id: number): Promise<TrialAccess> {
  try {
    const response = await api.post(`/trials/${id}/convert`);
    return response.data;
  } catch (error) {
    rethrow(error, 'Failed to convert trial');
  }
}
