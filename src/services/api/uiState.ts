/**
 * What the signed-in person has seen of the tour and the one-time tips (lms-backend `/ui-state`,
 * own row only). The state itself arrives with /auth/me; these mark it and return the new state.
 */
import { api } from './client';
import type { UiState } from '@/lib/guide/state';

export async function markTourSeen(version: number): Promise<UiState> {
  const response = await api.post('/ui-state/tour', { version });
  return response.data as UiState;
}

export async function dismissTip(key: string): Promise<UiState> {
  const response = await api.post(`/ui-state/tips/${encodeURIComponent(key)}`);
  return response.data as UiState;
}
