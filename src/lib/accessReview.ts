import type { AccessReview, AccessReviewRow, CrmContactField, ReviewSource, ReviewSystem } from '../services/api/accessReview';

/**
 * The access review page's rules (API.md §9), kept out of the components so they can be tested.
 * The server builds the rows and checks every action; these only decide what a row offers.
 */

export const REVIEW_SYSTEMS: readonly ReviewSystem[] = ['lms', 'crm', 'support', 'ielts', 'sat', 'zitadel', 'workspace'];

const STARTED: ReadonlySet<string> = new Set(['awaiting_confirmation', 'pending', 'blocked', 'completed']);

/**
 * Offboarding is under way (or done) for the person behind the row. An «active after
 * offboarding» row is listed BECAUSE its completed record did not keep the account off, so that
 * record does not count.
 */
export function offboardingStarted(row: Pick<AccessReviewRow, 'offboarding' | 'category'>): boolean {
  const status = row.offboarding?.status;
  if (!status || !STARTED.has(status)) return false;
  return !(row.category === 'active_after_offboarding' && status === 'completed');
}

/** Open: nobody decided and no offboarding started. Done: contacts cleared or offboarding started. */
export type RowState = 'open' | 'kept' | 'done';

export function rowState(row: Pick<AccessReviewRow, 'decision' | 'offboarding' | 'category'>): RowState {
  if (row.decision === 'contacts_cleared' || offboardingStarted(row)) return 'done';
  if (row.decision === 'keep') return 'kept';
  return 'open';
}

export type RowFilter = RowState | 'all';

export function filterRows(rows: AccessReviewRow[], filter: RowFilter): AccessReviewRow[] {
  return filter === 'all' ? rows : rows.filter((row) => rowState(row) === filter);
}

export type RowAction = 'keep' | 'unkeep' | 'offboard' | 'by_hand' | 'clear_contacts';

/**
 * What a row offers. Contacts rows only clear contacts. Everything else can be kept with a reason
 * (or un-kept), and offboarded when an LMS / CRM person owns the account; an account nobody owns
 * is switched off by hand in its own system. Once offboarding started, there is nothing to choose.
 */
export function rowActions(row: AccessReviewRow): RowAction[] {
  if (row.category === 'contacts_due') return row.decision === 'contacts_cleared' ? [] : ['clear_contacts'];
  if (offboardingStarted(row)) return [];
  if (row.decision === 'keep') return ['unkeep'];
  return ['keep', row.offboard_target ? 'offboard' : 'by_hand'];
}

/** Systems that were not checked this time, in a fixed order: shown as warnings, never failures. */
export function uncheckedSources(review: Pick<AccessReview, 'sources'>): Array<{ system: ReviewSystem; source: ReviewSource }> {
  return REVIEW_SYSTEMS
    .map((system) => ({ system, source: review.sources?.[system] }))
    .filter((entry): entry is { system: ReviewSystem; source: ReviewSource } => !!entry.source && !entry.source.checked);
}

const LMS_CONTACTS = ['personal_email', 'avatar', 'telegram'] as const;
const CRM_CONTACTS: readonly CrmContactField[] = ['phone', 'telegram', 'personal_email', 'other_text'];

/** What a contacts row still stores, per system (kinds only, never the values). */
export function storedContacts(contacts: NonNullable<AccessReviewRow['contacts']>): { lms: Array<(typeof LMS_CONTACTS)[number]>; crm: CrmContactField[] } {
  return {
    lms: LMS_CONTACTS.filter((field) => contacts[field]),
    crm: contacts.crm ? CRM_CONTACTS.filter((field) => contacts.crm![field]) : [],
  };
}

/** How long to wait before asking again while a review is building. */
export const POLL_MS = 4000;
