import type { TrialAccess, TrialCreateRequest, TrialUpdateRequest } from '../../types';
import { api } from './client';

export interface TrialCreateResponse {
  trial: TrialAccess;
  generated_password: string | null;
}

export async function createTrial(data: TrialCreateRequest): Promise<TrialCreateResponse> {
  try {
    const response = await api.post('/trials/', data);
    return response.data;
  } catch (error) {
    throw new Error('Failed to create trial');
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
    throw new Error('Failed to fetch trials');
  }
}

export async function updateTrial(id: number, data: TrialUpdateRequest): Promise<TrialAccess> {
  try {
    const response = await api.patch(`/trials/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error('Failed to update trial');
  }
}

export async function revokeTrial(id: number): Promise<TrialAccess> {
  try {
    const response = await api.post(`/trials/${id}/revoke`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to revoke trial');
  }
}

export async function resendTrialInvite(id: number): Promise<{ sent: boolean }> {
  try {
    const response = await api.post(`/trials/${id}/resend-invite`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to resend trial invite');
  }
}

export async function convertTrial(id: number): Promise<TrialAccess> {
  try {
    const response = await api.post(`/trials/${id}/convert`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to convert trial');
  }
}
