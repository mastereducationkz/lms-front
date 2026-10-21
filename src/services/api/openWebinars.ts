/** The admin side of open webinars (lms-backend src/public_webinars/routes/admin.py). */
import { api } from './client';
import { apiError } from './apiError';

export type AccessMode = 'students' | 'open' | 'registration';

/** Who is named on the public page: the guest speaker (photo, bio), the event's host (name only), or nobody. */
export type Presenter = 'speaker' | 'host' | 'none';

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
  /** English versions, shown on the public page in English; absent on an older server. Empty = the page shows the original. */
  name_en?: string | null;
  bio_en?: string | null;
  /** A stable relative path (`/uploads/webinar_speakers/…`) from `uploadSpeakerPhoto`; an older speaker may still hold an absolute URL. Show it through `mediaUrl`. */
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

/** The event's saved host, as the guard on «open to everyone» sees them. */
export interface AccessHost { id: number; name: string; role: string; has_workspace: boolean }

/** Why public access cannot be closed any more: the webinar began, or people have registered. */
export type CloseBlockedReason = 'started' | 'has_registrations' | null;

export interface OpenAccess {
  event_id: number;
  open: boolean;
  access_mode: AccessMode;
  slug: string | null;
  speaker_id: number | null;
  presenter: Presenter;
  lead_pipeline_id: number | null;
  /** The saved host; null when the event has none. A Meet room is made only for a host with a Workspace account. */
  host: AccessHost | null;
  /** Someone already pasted a Meet link into the event, so no host is needed for the room. */
  has_meeting_url: boolean;
  funnel: Funnel;
  /** A stable relative path (`/uploads/webinar_banners/…`); show it through `mediaUrl`. */
  banner_url: string | null;
  starts_at: string;
  ends_at: string;
  started: boolean;
  ended: boolean;
  registrations_total: number;
  /** The English title and description of the public page; null/absent = the page shows the original. */
  title_en?: string | null;
  description_en?: string | null;
  /** Registrations exist: the address can no longer change. */
  slug_locked: boolean;
  can_close: boolean;
  close_blocked_reason: CloseBlockedReason;
  /** A recurring series cannot be opened; each occurrence is opened from its own edit page. */
  is_recurring: boolean;
}

/** One line of the overview: a webinar that is, or was, open to everyone, with its funnel in numbers. */
export interface OverviewItem {
  event_id: number;
  title: string;
  start_datetime: string;
  end_datetime: string;
  is_active: boolean;
  access_mode: AccessMode;
  slug: string | null;
  registered: number;
  consultations: number;
  joined: number;
  leads_sent: number;
  leads_pending: number;
  leads_failed: number;
}
export interface Overview { failed_total: number; items: OverviewItem[] }

/** What the create form knows before the event exists. The server answers with the address it WILL use, or refuses as `PUT /{event_id}` would. */
export interface PreflightBody {
  access_mode: 'open' | 'registration';
  lead_pipeline_id: number;
  /** Not in the contract's list, sent so the previewed address (made from the title) is the one that will be used. */
  title?: string;
  teacher_id?: number | null;
  meeting_url?: string | null;
  start_datetime: string;
  end_datetime: string;
  is_recurring?: boolean;
  slug?: string | null;
  speaker_id?: number | null;
  /** Left out, the server reads `speaker` when a speaker is set and `host` otherwise; the forms always send it. */
  presenter?: Presenter;
}

/**
 * The access card's Save. `slug` is left out when the address is locked; `banner_url: null` removes the banner.
 * `title_en` / `description_en`: left out = unchanged on the server; null or '' = cleared.
 */
export interface AccessBody {
  access_mode: 'open' | 'registration';
  slug?: string | null;
  speaker_id?: number | null;
  presenter?: Presenter;
  lead_pipeline_id: number;
  banner_url?: string | null;
  title_en?: string | null;
  description_en?: string | null;
}

/** What the host teacher or curator sees on their event: no personal data. */
export interface PublicSummary {
  open: boolean;
  access_mode: string | null;
  slug: string | null;
  registered: number;
  joined: number;
  recording_published: boolean;
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
  /** `created`, `tagged_existing` or `existing_client` once the lead was handled. */
  lead_outcome: string | null;
  lead_error: string | null;
  lead_attempts: number;
  amo_lead_id: number | null;
  utm: Record<string, string>;
}

export interface RecordingStatus {
  has_recording: boolean;
  recording_status: 'ready' | 'pending' | 'failed' | 'removed' | null;
  ready: boolean;
  duration_seconds: number | null;
  published: boolean;
  published_at: string | null;
  withdrawn_at: string | null;
  views: number;
}

const base = '/admin/open-webinars';

/** Registrations come in pages of this size until a page is shorter. */
export const REGISTRATIONS_PAGE = 100;

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

/** Active speakers; `includeId` keeps a webinar's own speaker in the list even after they were removed. */
export const listGuestSpeakers = (includeId?: number | null) =>
  run<GuestSpeaker[]>(api.get(`${base}/speakers`, includeId ? { params: { include_id: includeId } } : undefined), 'Failed to load the speakers');
export const createGuestSpeaker = (body: SpeakerInput) => run<GuestSpeaker>(api.post(`${base}/speakers`, body), 'Failed to add the speaker');
export const updateGuestSpeaker = (id: number, body: SpeakerInput) => run<GuestSpeaker>(api.put(`${base}/speakers/${id}`, body), 'Failed to save the speaker');
export const retireGuestSpeaker = (id: number) => run<{ ok: boolean }>(api.delete(`${base}/speakers/${id}`), 'Failed to remove the speaker');
/** Uploads a speaker's photo (PNG/JPEG/WebP, up to 5 MB, at least 200 px on the short side); the server crops it square and returns its stable relative path. */
export const uploadSpeakerPhoto = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return run<{ url: string }>(api.post(`${base}/speakers/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Failed to upload the photo');
};

export const getOpenAccess = (eventId: number) => run<OpenAccess>(api.get(`${base}/${eventId}`), 'Failed to load the public access');
export const saveOpenAccess = (eventId: number, body: AccessBody) =>
  run<{ event_id: number; access_mode: string; slug: string; banner_url: string | null }>(api.put(`${base}/${eventId}`, body), 'Failed to save the public access');
export const closeOpenAccess = (eventId: number) => run<{ ok: boolean }>(api.delete(`${base}/${eventId}`), 'Failed to close the public access');
export const preflightOpenAccess = (body: PreflightBody) => run<{ ok: true; slug: string }>(api.post(`${base}/preflight`, body), 'Failed to check the public access');
/** Uploads a banner (PNG/JPEG/WebP, up to 5 MB, at least 400 px wide) and returns its stable relative path. */
export const uploadBanner = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return run<{ url: string }>(api.post(`${base}/banner`, form, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Failed to upload the banner');
};
export const getPublicSummary = (eventId: number) =>
  run<PublicSummary>(api.get(`${base}/${eventId}/public-summary`, { cache: false } as never), 'Failed to load the public access');

export const getOverview = () => run<Overview>(api.get(`${base}/overview`, { cache: false } as never), 'Failed to load the webinars');
/** Sends every failed lead again: one webinar's (`eventId`), or all webinars'. */
export const retryFailedLeads = (eventId?: number) =>
  run<{ retried: number }>(api.post(`${base}/retry-failed`, eventId ? { event_id: eventId } : {}), 'Failed to retry');

export const listRegistrations = (eventId: number, page: { limit?: number; offset?: number } = {}) =>
  run<RegistrationRow[]>(
    api.get(`${base}/${eventId}/registrations`, { params: { limit: page.limit ?? REGISTRATIONS_PAGE, offset: page.offset ?? 0 }, cache: false } as never),
    'Failed to load the registrations',
  );
export const retryLead = (registrationId: number) => run<{ id: number; lead_state: string }>(api.post(`${base}/registrations/${registrationId}/retry`), 'Failed to retry');

export const getRecordingStatus = (eventId: number) => run<RecordingStatus>(api.get(`${base}/${eventId}/recording`), 'Failed to load the recording');
export const publishRecording = (eventId: number) => run<RecordingStatus>(api.post(`${base}/${eventId}/recording`), 'Failed to publish the recording');
export const withdrawRecording = (eventId: number) => run<RecordingStatus>(api.delete(`${base}/${eventId}/recording`), 'Failed to withdraw the recording');
