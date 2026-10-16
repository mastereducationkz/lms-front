/** The admin side of open webinars (lms-backend src/public_webinars/routes/admin.py). */
import { api } from './client';
import { apiError } from './apiError';

export type AccessMode = 'students' | 'open' | 'registration';

export interface Pipeline { id: number; name: string }

export interface OpenSettings {
  policy_text: string;
  policy_version: string;
  policy_updated_at: string | null;
  consent_text_ru: string;
  consent_text_en: string;
  pipelines: Pipeline[];
}

export interface GuestSpeaker {
  id: number;
  name: string;
  organisation: string | null;
  bio: string | null;
  photo_url: string | null;
  email: string | null;
  is_active: boolean;
}
export type SpeakerInput = Omit<GuestSpeaker, 'id' | 'is_active'>;

export interface Funnel {
  registered: number;
  joined: number;
  consultation_requests: number;
  leads_sent: number;
  leads_pending: number;
  leads_failed: number;
  existing_students: number;
}

export interface OpenAccess {
  event_id: number;
  open: boolean;
  access_mode: AccessMode;
  slug: string | null;
  speaker_id: number | null;
  lead_pipeline_id: number | null;
  funnel: Funnel;
}

export interface RegistrationRow {
  id: number;
  kind: 'registration' | 'consultation';
  name: string;
  phone: string;
  email: string | null;
  registered_at: string;
  joined: boolean;
  lead_state: 'pending' | 'sent' | 'failed' | 'skipped_student';
  lead_outcome: string | null;
  lead_error: string | null;
  lead_attempts: number;
  amo_lead_id: number | null;
  utm: Record<string, string>;
}

const base = '/admin/open-webinars';

async function run<T>(request: Promise<{ data: T }>, fallback: string): Promise<T> {
  try {
    return (await request).data;
  } catch (error: any) {
    throw apiError(error, fallback);
  }
}

export const getOpenSettings = () => run<OpenSettings>(api.get(`${base}/settings`), 'Failed to load the settings');
export const saveOpenSettings = (body: Partial<Pick<OpenSettings, 'policy_text' | 'consent_text_ru' | 'consent_text_en'>>) =>
  run<OpenSettings>(api.put(`${base}/settings`, body), 'Failed to save the settings');

export const listGuestSpeakers = () => run<GuestSpeaker[]>(api.get(`${base}/speakers`), 'Failed to load the speakers');
export const createGuestSpeaker = (body: SpeakerInput) => run<GuestSpeaker>(api.post(`${base}/speakers`, body), 'Failed to add the speaker');
export const updateGuestSpeaker = (id: number, body: SpeakerInput) => run<GuestSpeaker>(api.put(`${base}/speakers/${id}`, body), 'Failed to save the speaker');
export const retireGuestSpeaker = (id: number) => run<{ ok: boolean }>(api.delete(`${base}/speakers/${id}`), 'Failed to remove the speaker');

export const getOpenAccess = (eventId: number) => run<OpenAccess>(api.get(`${base}/${eventId}`), 'Failed to load the public access');
export const saveOpenAccess = (eventId: number, body: { access_mode: 'open' | 'registration'; slug?: string | null; speaker_id: number | null; lead_pipeline_id: number }) =>
  run<{ event_id: number; access_mode: string; slug: string }>(api.put(`${base}/${eventId}`, body), 'Failed to save the public access');
export const closeOpenAccess = (eventId: number) => run<{ ok: boolean }>(api.delete(`${base}/${eventId}`), 'Failed to close the public access');
export const listRegistrations = (eventId: number) => run<RegistrationRow[]>(api.get(`${base}/${eventId}/registrations`, { params: { limit: 500 } }), 'Failed to load the registrations');
export const retryLead = (registrationId: number) => run<{ id: number; lead_state: string }>(api.post(`${base}/registrations/${registrationId}/retry`), 'Failed to retry');
