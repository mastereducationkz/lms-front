/**
 * The login-free API of open webinars (lms-backend src/public_webinars/routes/public.py).
 *
 * Plain `fetch`, not the app's axios client: nobody here is signed in, and the client's session
 * handling (cookies, refresh, redirects to /login) has nothing to do for a visitor.
 */
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export type WebinarState = 'upcoming' | 'live' | 'ended';
export type AccessMode = 'open' | 'registration';

export interface PublicSpeaker {
  name: string;
  organisation: string | null;
  bio: string | null;
  photo_url: string | null;
}

export interface PublicWebinar {
  slug: string;
  title: string;
  description: string | null;
  access_mode: AccessMode;
  starts_at: string;
  ends_at: string;
  join_opens_at: string;
  state: WebinarState;
  join_url: string | null;
  registration_open: boolean;
  speaker: PublicSpeaker | null;
  recording_slug: string | null;
  consent: { text_ru: string; text_en: string; policy_version: string; policy_ready: boolean };
}

export interface JoinInfo {
  title: string;
  slug: string;
  name: string;
  state: WebinarState;
  starts_at: string;
  ends_at: string;
  join_opens_at: string;
  join_url: string | null;
  recording_slug: string | null;
}

export interface ContactBody {
  name: string;
  phone: string;
  email?: string;
  consent: boolean;
  utm?: Record<string, string>;
  referer?: string;
  /** The hidden honeypot: a person never fills it. Named so that no browser autofill or password manager knows it. */
  ow_extra?: string;
}

/** A refusal with the backend's stable `reason_code`, so the page can say it in the visitor's language. */
export class PublicApiError extends Error {
  constructor(public status: number, public code: string | null, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new PublicApiError(0, 'network', 'network');
  }
  if (!response.ok) {
    let code: string | null = null;
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      code = typeof body?.reason_code === 'string' ? body.reason_code : null;
      detail = typeof body?.detail === 'string' ? body.detail : detail;
    } catch {
      /* a non-JSON error body: keep the status */
    }
    throw new PublicApiError(response.status, code, detail);
  }
  return response.json() as Promise<T>;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const getPublicWebinar = (slug: string) => call<PublicWebinar>(`/public/webinars/${encodeURIComponent(slug)}`);

export const registerForWebinar = (slug: string, body: ContactBody) =>
  call<{ join_code: string; join_path: string }>(`/public/webinars/${encodeURIComponent(slug)}/register`, post(body));

export const getJoinInfo = (code: string) => call<JoinInfo>(`/public/webinars/join/${encodeURIComponent(code)}`);

export const requestConsultation = (webinarSlug: string, body: ContactBody) =>
  call<{ ok: boolean }>('/public/leads', post({ ...body, webinar_slug: webinarSlug }));

export interface PublicRecording {
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  duration_seconds: number | null;
  speaker: PublicSpeaker | null;
  url: string;
  poster_url: string | null;
  consent: PublicWebinar['consent'];
}

export const getPublicRecording = (slug: string) => call<PublicRecording>(`/public/recordings/${encodeURIComponent(slug)}`);

export const getPrivacyPolicy = () => call<{ text: string; version: string; updated_at: string | null }>('/public/policy');
