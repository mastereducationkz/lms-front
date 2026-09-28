import { api, API_BASE_URL, tokenManager } from './client';
import type { RecordingViewSummary, ViewReport } from '../../lib/recordingViews';

/**
 * One heartbeat of a playing recording (see lib/recordingViews). `keepalive` is for a page being
 * hidden or closed: a plain `fetch` the browser finishes after the page is gone, carrying the same
 * bearer token the API client would. `refused` is the server saying this viewer may not (or no
 * longer may) watch it — a recording pulled mid-play — so the player stops reporting; anything else
 * that fails is thrown and retried with the next heartbeat.
 */
export async function reportRecordingView(
  eventId: number, report: ViewReport, keepalive = false,
): Promise<'sent' | 'refused'> {
  const path = `/recordings/${eventId}/view-progress`;
  if (!keepalive) {
    try {
      await api.post(path, report);
      return 'sent';
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) return 'refused';
      throw error;
    }
  }
  const token = tokenManager.getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    keepalive: true,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(report),
  });
  if (response.status === 404 || response.status === 403) return 'refused';
  if (!response.ok) throw new Error(`view-progress ${response.status}`);
  return 'sent';
}

/** Staff: of the students who missed a recorded lesson, how many watched it within 7 days. */
export async function getRecordingViewSummary(): Promise<RecordingViewSummary> {
  const response = await api.get('/recordings/view-summary', { cache: false } as never);
  return response.data as RecordingViewSummary;
}
