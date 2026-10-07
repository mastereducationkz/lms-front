/**
 * What the signed-in person has seen of the tour and the one-time tips, and their small choices
 * (lms-backend `/ui-state`, own row only). The state itself arrives with /auth/me; these mark it
 * and return the new state.
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

/** Look Up's translation language, kept on the account so every device uses it. */
export async function saveLookupLang(lang: 'ru' | 'kk'): Promise<UiState & { prefs?: { lookup_lang?: 'ru' | 'kk' } }> {
  const response = await api.put('/ui-state/prefs/lookup_lang', { value: lang });
  return response.data;
}
