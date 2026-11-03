/**
 * Trial sign-up links (lms-backend src/trial_links): the login-free sign-up behind the QR code on a presentation
 * slide, and the staff page that makes links, runs presentations and reads the stats.
 *
 * The public half uses plain `fetch` like the open-webinar pages: a visitor is not signed in, and the axios client's
 * session handling has nothing to do for them.
 */
import { api } from './client';
import { PublicApiError } from './publicWebinars';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export type Interest = 'sat' | 'ielts' | 'nuet' | 'unsure';
export type Grade = '8' | '9' | '10' | '11' | '12' | 'graduated' | 'other';
export type SignupOutcome = 'created' | 'existing_account' | 'already_student' | 'phone_registered';
export type ClosedReason = 'signups_closed' | 'link_paused' | 'link_closed' | 'link_full';

export interface SchoolRef { id: number; name: string; city: string | null }

export interface PublicTrialLink {
  code: string;
  title: string;
  open: boolean;
  closed_reason: ClosedReason | null;
  /** Schools of the presentations running right now: one tap instead of a search. */
  schools_running: SchoolRef[];
  days: number;
  grades: Grade[];
  interests: Interest[];
  consent: { text_ru: string; text_en: string; policy_ready: boolean };
}

export interface SignupBody {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  grade: Grade;
  interests: Interest[];
  parent_phone?: string;
  school_id?: number;
  new_school?: { name: string; city: string };
  consent: boolean;
  lang: 'ru' | 'en';
  captcha_token?: string;
  utm?: Record<string, string>;
  referer?: string;
  /** Honeypot: a person never fills it. */
  tl_extra?: string;
}

export interface SignupResult {
  outcome: SignupOutcome;
  email?: string;
  /** Only for an account created by this very request. */
  password?: string;
  name?: string;
  expires_at?: string;
  courses?: string[];
  /** `phone_registered`: the e-mail the earlier sign-up used, masked (`a***@gmail.com`). */
  masked_email?: string;
  added_courses?: string[];
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

const enc = encodeURIComponent;
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const getTrialLink = (code: string) => call<PublicTrialLink>(`/public/trial/${enc(code)}`);
export const recordTrialLinkOpen = (code: string, visitorKey: string) =>
  call<{ ok: boolean }>(`/public/trial/${enc(code)}/open`, post({ visitor_key: visitorKey }));
export const searchTrialSchools = (code: string, q: string) =>
  call<{ schools: SchoolRef[] }>(`/public/trial/${enc(code)}/schools?q=${enc(q)}`);
export const signUpForTrial = (code: string, body: SignupBody) =>
  call<SignupResult>(`/public/trial/${enc(code)}/signup`, post(body));

// ── staff ─────────────────────────────────────────────────────────────────────

export interface TrialLinkRow {
  id: number;
  code: string;
  title: string;
  url: string;
  is_active: boolean;
  closes_at: string | null;
  signup_cap: number | null;
  created_at: string;
  signups: number;
  opens: number;
  closed_reason: Exclude<ClosedReason, 'signups_closed'> | null;
}

export interface Presentation {
  id: number;
  link_id: number;
  school_id: number | null;
  school: string | null;
  presenter_id: number | null;
  presenter: string | null;
  started_at: string;
  ends_at: string;
  stopped_at: string | null;
  running: boolean;
  signups: number;
}

export interface StaffSchool { id: number; name: string; city: string | null; confirmed: boolean; signups: number; created_at: string }

export type LeadState = 'none' | 'off' | 'pending' | 'sent' | 'failed';

export interface SignupRow {
  id: number;
  created_at: string;
  link_id: number;
  link_title: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  grade: Grade;
  interests: Interest[];
  parent_phone: string | null;
  school_id: number | null;
  school: string | null;
  school_text: string | null;
  school_pending: boolean;
  presentation_id: number | null;
  presenter: string | null;
  outcome: SignupOutcome;
  user_id: number | null;
  got_trial: boolean;
  started: boolean;
  converted: boolean;
  lead_state: LeadState;
  lead_error: string | null;
  amo_lead_id: number | null;
}

export interface FunnelBucket { signups: number; trials: number; started: number; converted: number }

export interface TrialStats extends FunnelBucket {
  opens: number;
  outcomes: Record<SignupOutcome, number>;
  grades: Record<string, number>;
  interests: Record<string, number>;
  by_school: (FunnelBucket & { school_id: number | null; school: string })[];
  by_presenter: (FunnelBucket & { presenter: string | null })[];
  by_day: (FunnelBucket & { day: string; opens: number })[];
}

export interface TemplateItem { course_id: number; lesson_ids: number[]; course_title?: string | null }
export type Programme = 'sat' | 'ielts' | 'nuet';

export interface TrialLinkSettings {
  signups_open: boolean;
  leads_enabled: boolean;
  days: number;
  templates: Record<Programme, TemplateItem[]>;
  consent_text_ru: string;
  consent_text_en: string;
  policy_ready: boolean;
  missing_programmes: Programme[];
}

export interface SignupFilters {
  link_id?: number;
  school_id?: number;
  presentation_id?: number;
  presenter_id?: number;
  outcome?: SignupOutcome;
  date_from?: string;
  date_to?: string;
  q?: string;
}

const BASE = '/admin/trial-links';
const fresh = { cache: false } as never;

export const listTrialLinks = async () => (await api.get(`${BASE}/links`, fresh)).data.links as TrialLinkRow[];
export const createTrialLink = async (body: { title: string; closes_at?: string | null; signup_cap?: number | null }) =>
  (await api.post(`${BASE}/links`, body)).data as TrialLinkRow;
export const updateTrialLink = async (id: number, body: Partial<Pick<TrialLinkRow, 'title' | 'is_active' | 'closes_at' | 'signup_cap'>>) =>
  (await api.patch(`${BASE}/links/${id}`, body)).data as TrialLinkRow;

export const listPresentations = async (linkId?: number) =>
  (await api.get(`${BASE}/presentations`, { params: linkId ? { link_id: linkId } : {}, cache: false } as never)).data
    .presentations as Presentation[];
export const startPresentation = async (body: { link_id: number; school_id?: number; new_school?: { name: string; city: string } }) =>
  (await api.post(`${BASE}/presentations`, body)).data as Presentation;
export const stopPresentation = async (id: number) => (await api.post(`${BASE}/presentations/${id}/stop`)).data as Presentation;
export const getPresentationLive = async (id: number) => (await api.get(`${BASE}/presentations/${id}/live`, fresh)).data as Presentation;

export const listStaffSchools = async (q = '') =>
  (await api.get(`${BASE}/schools`, { params: { q }, cache: false } as never)).data.schools as StaffSchool[];
export const createStaffSchool = async (body: { name: string; city?: string }) =>
  (await api.post(`${BASE}/schools`, body)).data as StaffSchool;
export const updateStaffSchool = async (id: number, body: { name?: string; city?: string | null; confirmed?: boolean }) =>
  (await api.patch(`${BASE}/schools/${id}`, body)).data as StaffSchool;
export const mergeStaffSchool = async (id: number, intoId: number) =>
  (await api.post(`${BASE}/schools/${id}/merge`, { into_id: intoId })).data as { moved: number };

const clean = (filters: SignupFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const listSignups = async (filters: SignupFilters, page = 1, pageSize = 50) =>
  (await api.get(`${BASE}/signups`, { params: { ...clean(filters), page, page_size: pageSize }, cache: false } as never))
    .data as { total: number; page: number; page_size: number; items: SignupRow[] };
export const downloadSignupsXlsx = async (filters: SignupFilters): Promise<Blob> =>
  (await api.get(`${BASE}/signups.xlsx`, { params: clean(filters), responseType: 'blob', cache: false } as never)).data as Blob;
export const retrySignupLead = async (id: number) => (await api.post(`${BASE}/signups/${id}/retry-lead`)).data;

export const getTrialStats = async (filters: Pick<SignupFilters, 'link_id' | 'date_from' | 'date_to'>) =>
  (await api.get(`${BASE}/stats`, { params: clean(filters), cache: false } as never)).data as TrialStats;

export const getTrialLinkSettings = async () => (await api.get(`${BASE}/settings`, fresh)).data as TrialLinkSettings;
export const saveTrialLinkSettings = async (
  body: Partial<Pick<TrialLinkSettings, 'signups_open' | 'leads_enabled' | 'days' | 'consent_text_ru' | 'consent_text_en'>> & {
    templates?: Record<Programme, { course_id: number; lesson_ids: number[] }[]>;
  },
) => (await api.put(`${BASE}/settings`, body)).data as TrialLinkSettings;
