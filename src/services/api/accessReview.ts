import { api } from './client';
import { toOffboardingError, type Actor, type OffboardingStatus } from './offboarding';

/**
 * The monthly access review (docs/offboarding/SPEC.md §10, API.md §9): accounts in every system
 * that belong to no active staff member. Admin-only and dark with the rest of offboarding. The
 * endpoints ship after the offboarding engine, so a 404 (not deployed yet, or switched off)
 * reads as "not available" rather than an error.
 */

const BASE = '/admin/offboarding/access-review';
const NO_CACHE = { cache: false } as never;

export type ReviewSystem = 'lms' | 'crm' | 'support' | 'ielts' | 'sat' | 'zitadel' | 'workspace';

export type ReviewCategory = 'orphan' | 'active_after_offboarding' | 'no_email' | 'no_workspace' | 'contacts_due';

export interface ReviewSource {
  checked: boolean;
  accounts: number;
  /** Why it was not checked ("SAT not checked: HTTP 503"): a warning, never a failure. */
  error: string | null;
  /** Workspace only: when the users CSV was uploaded. */
  uploaded_at?: string | null;
}

export interface AccessReview {
  id: number;
  /** YYYY-MM */
  period: string;
  kind: 'scheduled' | 'manual';
  /** `building`: rows are not there yet, poll. */
  status: 'building' | 'ready' | 'failed';
  started_at: string;
  finished_at: string | null;
  triggered_by: Actor | null;
  error?: string | null;
  sources: Partial<Record<ReviewSystem, ReviewSource>>;
  counts: { rows: number; open: number; kept: number; done: number };
}

export interface ReviewKeep {
  reason: string;
  at: string;
  by: Actor | null;
}

export interface AccessReviewRow {
  id: number;
  system: ReviewSystem;
  category: ReviewCategory;
  account: {
    /** Stable per system: an id, or the email for Workspace. */
    key: string;
    id: string | null;
    email: string | null;
    name: string | null;
    role: string | null;
    is_active: boolean;
    last_seen: string | null;
  };
  /** The LMS / CRM person the account maps to; null for a stranger. */
  person: { lms_user_id: number | null; crm_user_id: number | null; name: string } | null;
  /** English: why the account is listed. */
  why: string;
  /** What «Offboard» passes to the dialog; null when no LMS / CRM person owns the account. */
  offboard_target: { lms_user_id: number | null; crm_user_id: number | null } | null;
  /** That person's latest offboarding, live. */
  offboarding: { record_id: number; status: OffboardingStatus } | null;
  decision: null | 'keep' | 'contacts_cleared';
  keep: ReviewKeep | null;
  /** A keep that no longer applies because the account changed since. */
  previous_keep: ReviewKeep | null;
  /** `contacts_due` only: what is still stored, never the values. */
  contacts: {
    last_day: string;
    last_day_source: 'offboarding' | 'account_updated';
    personal_email: boolean;
    avatar: boolean;
    telegram: boolean;
    /** The CRM's contact fields still stored; null when the CRM was not asked or not reachable. */
    crm?: { phone: boolean; telegram: boolean; personal_email: boolean; other_text: boolean } | null;
    /** After clearing: the CRM fields that were cleared. */
    crm_cleared?: CrmContactField[] | null;
  } | null;
}

export type CrmContactField = 'phone' | 'telegram' | 'personal_email' | 'other_text';

export interface AccessReviewPage {
  /** null before the first review. */
  review: AccessReview | null;
  rows: AccessReviewRow[];
}

async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await request()).data;
  } catch (error) {
    throw toOffboardingError(error);
  }
}

/** The latest review (or an older one by id); null while the endpoint is not there. */
export async function getAccessReview(reviewId?: number): Promise<AccessReviewPage | null> {
  try {
    const params = reviewId != null ? { review_id: reviewId } : {};
    const data = (await api.get(BASE, { params, cache: false } as never)).data as Partial<AccessReviewPage>;
    return { review: data?.review ?? null, rows: Array.isArray(data?.rows) ? data.rows : [] };
  } catch (error) {
    const failure = toOffboardingError(error);
    if (failure.status === 404) return null;
    throw failure;
  }
}

/** Build a review now; it comes back `building` (409 access_review_running while one is). */
export async function runAccessReview(): Promise<AccessReview> {
  return (await call<{ review: AccessReview }>(() => api.post(`${BASE}/run`))).review;
}

/** Past reviews, newest first (the last 24). */
export async function getAccessReviewHistory(): Promise<AccessReview[]> {
  const data = await call<{ items?: AccessReview[] }>(() => api.get(`${BASE}/history`, NO_CACHE));
  return Array.isArray(data.items) ? data.items : [];
}

export function keepAccessReviewRow(rowId: number, reason: string): Promise<AccessReviewRow> {
  return call(() => api.post(`${BASE}/${rowId}/keep`, { reason }));
}

/** Forget the keep for that account. */
export function unkeepAccessReviewRow(rowId: number): Promise<AccessReviewRow> {
  return call(() => api.post(`${BASE}/${rowId}/unkeep`));
}

/**
 * `contacts_due` rows only: clears the stored personal email, avatar and Telegram link, and the
 * CRM's contact fields. 502 access_review_crm_unreachable: the LMS part is done, the CRM part is
 * not, and the row stays open to try again.
 */
export function clearContactDetails(rowId: number): Promise<AccessReviewRow> {
  return call(() => api.post(`${BASE}/${rowId}/clear-contacts`, { confirm: true }));
}
