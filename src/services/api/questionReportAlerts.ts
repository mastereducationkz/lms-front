/** Who is told about a new question report (lms-backend src/content/routes/report_alerts.py). */
import { api } from './client';
import { apiError } from './apiError';

export interface AlertPerson {
  user_id: number;
  name: string | null;
  role: string;
  /** Whether Support has this person's Telegram. `null` when Support could not be asked. */
  linked: boolean | null;
}

export interface AlertState {
  /** Chat IDs set on the server: still told, but not editable here. */
  server_chats: number;
  recipients: AlertPerson[];
  candidates: (AlertPerson & { linked: boolean })[];
}

const base = '/admin/question-report-alerts';

export async function getAlertState(): Promise<AlertState> {
  try { return (await api.get(base)).data; } catch (error: any) { throw apiError(error, 'Failed to load the alert list'); }
}

export async function setAlertRecipients(userIds: number[]): Promise<AlertState> {
  try { return (await api.put(base, { user_ids: userIds })).data; } catch (error: any) { throw apiError(error, 'Failed to save the alert list'); }
}

export async function sendAlertTest(userId: number): Promise<{ status: string }> {
  try { return (await api.post(`${base}/test/${userId}`)).data; } catch (error: any) { throw apiError(error, 'Failed to send the test'); }
}
