import { api } from './client';
import { toOffboardingError } from './offboarding';

/**
 * The monthly access review (docs/offboarding/SPEC.md §10, phase 2). Its endpoints come after the
 * offboarding engine, so the page is built to show whatever rows the server returns and to read a
 * missing endpoint (404) as "not available yet" rather than an error.
 */

const BASE = '/admin/offboarding/access-review';
const NO_CACHE = { cache: false } as never;

export type ReviewKind = 'not_staff' | 'no_workspace' | 'contact_retention';
export type ReviewAction = 'keep' | 'offboard' | 'clear_contacts';

export interface AccessReviewRow {
  id: string | number;
  /** lms | crm | ielts | sat | support | zitadel | workspace */
  system: string;
  /** The sign-in: an email or a username. */
  account: string;
  name?: string | null;
  kind?: ReviewKind | string | null;
  /** The server's English explanation, shown when the kind is not one the catalog knows. */
  reason?: string | null;
  lms_user_id?: number | null;
  crm_user_id?: number | null;
  last_login?: string | null;
  /** «Keep» with its reason, remembered until the account changes. */
  decision?: { action: 'keep'; reason: string; by?: string | null; at?: string | null } | null;
  /** What may be done on the row; when absent, the kind decides. */
  actions?: ReviewAction[] | null;
}

export interface AccessReview {
  built_at?: string | null;
  rows: AccessReviewRow[];
}

/** The latest review, or null while the backend has none (endpoint not deployed yet). */
export async function getAccessReview(): Promise<AccessReview | null> {
  try {
    const data = (await api.get(BASE, NO_CACHE)).data as Partial<AccessReview> | AccessReviewRow[];
    if (Array.isArray(data)) return { rows: data };
    return { built_at: data?.built_at ?? null, rows: Array.isArray(data?.rows) ? data.rows : [] };
  } catch (error) {
    const failure = toOffboardingError(error);
    if (failure.status === 404) return null;
    throw failure;
  }
}

export async function keepAccessReviewRow(id: AccessReviewRow['id'], reason: string): Promise<void> {
  try {
    await api.post(`${BASE}/${encodeURIComponent(String(id))}/keep`, { reason });
  } catch (error) {
    throw toOffboardingError(error);
  }
}

export async function clearContactDetails(id: AccessReviewRow['id']): Promise<void> {
  try {
    await api.post(`${BASE}/${encodeURIComponent(String(id))}/clear-contacts`);
  } catch (error) {
    throw toOffboardingError(error);
  }
}

/** The actions a row offers: the server's list, or by kind (SPEC §10). */
export function rowActions(row: AccessReviewRow): ReviewAction[] {
  if (Array.isArray(row.actions)) return row.actions;
  if (row.kind === 'contact_retention') return ['clear_contacts'];
  const offboard: ReviewAction[] = row.lms_user_id != null || row.crm_user_id != null ? ['offboard'] : [];
  return ['keep', ...offboard];
}
