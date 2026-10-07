/**
 * Rules for Admin → Recordings Rollout, kept pure so they are testable without a DOM.
 *
 * They mirror lms-backend `src/services/teacher_onboarding.py`, which re-checks everything:
 * the page only uses them to say, row by row, what will happen before anyone presses a button.
 *
 *  - an address that exists in the uploaded Workspace users list is **connected**;
 *  - an address that does not exist becomes a row in the **Google import** — never the other
 *    way round, because Google's upload overwrites an account whose address already exists;
 *  - without an uploaded users list neither is allowed.
 */
import { activeLocale, t, type Locale, type MessageKey } from './i18n';
import '@/lib/i18n/catalogs/workspace';

export const WORKSPACE_DOMAIN = 'mastereducation.kz';
export const NAME_MAX = 60;

const MAILBOX = /^[a-z0-9]+([._-][a-z0-9]+)*$/;
const ENGLISH_NAME = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

export interface DirectoryAccount {
  email: string;
  first_name: string;
  last_name: string;
  org_unit: string | null;
  suspended: boolean;
  /** null when the downloaded list had no "Last Sign In" column. */
  signed_in: boolean | null;
}

export interface Draft {
  email: string;
  firstName: string;
  lastName: string;
}

export type AccountState =
  | { kind: 'unknown' }
  | { kind: 'new' }
  | { kind: 'exists'; signedIn: boolean | null; orgUnit: string | null }
  | { kind: 'suspended' }
  | { kind: 'taken'; by: string };

export type Intent =
  | { kind: 'import' }
  | { kind: 'connect' }
  | { kind: 'blocked'; reason: string };

export function normaliseAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function addressProblem(value: string, locale: Locale = activeLocale()): string | null {
  const address = normaliseAddress(value);
  if (!address) return t('workspace.rollout.addressEmpty', undefined, locale);
  if (!address.endsWith(`@${WORKSPACE_DOMAIN}`)) return t('workspace.rollout.addressDomain', { domain: WORKSPACE_DOMAIN }, locale);
  if (!MAILBOX.test(address.slice(0, -(WORKSPACE_DOMAIN.length + 1)))) return t('workspace.rollout.addressInvalid', undefined, locale);
  return null;
}

/** Which name a problem is about: each one is its own sentence (Russian agrees «Имя»/«Фамилия»). */
export type NameField = 'first' | 'last';

const NAME_PROBLEM: Record<NameField, Record<'empty' | 'tooLong' | 'latin', MessageKey>> = {
  first: { empty: 'workspace.rollout.firstNameEmpty', tooLong: 'workspace.rollout.firstNameTooLong', latin: 'workspace.rollout.firstNameLatin' },
  last: { empty: 'workspace.rollout.lastNameEmpty', tooLong: 'workspace.rollout.lastNameTooLong', latin: 'workspace.rollout.lastNameLatin' },
};

export function nameProblem(field: NameField, value: string, locale: Locale = activeLocale()): string | null {
  const name = value.trim();
  if (!name) return t(NAME_PROBLEM[field].empty, undefined, locale);
  if (name.length > NAME_MAX) return t(NAME_PROBLEM[field].tooLong, { max: NAME_MAX }, locale);
  if (!ENGLISH_NAME.test(name)) return t(NAME_PROBLEM[field].latin, undefined, locale);
  return null;
}

/**
 * What the users list says about an address.
 * `connected` maps addresses other LMS teachers are already connected to → their names.
 */
export function accountState(
  address: string,
  directory: Map<string, DirectoryAccount> | null,
  connected: Map<string, string>,
): AccountState {
  const key = normaliseAddress(address);
  const owner = connected.get(key);
  if (owner) return { kind: 'taken', by: owner };
  if (!directory) return { kind: 'unknown' };
  const account = directory.get(key);
  if (!account) return { kind: 'new' };
  if (account.suspended) return { kind: 'suspended' };
  return { kind: 'exists', signedIn: account.signed_in, orgUnit: account.org_unit };
}

/** What pressing the buttons would do with this pending teacher. */
export function draftIntent(draft: Draft, state: AccountState, locale: Locale = activeLocale()): Intent {
  const address = addressProblem(draft.email, locale);
  if (address) return { kind: 'blocked', reason: address };
  switch (state.kind) {
    case 'taken':
      return { kind: 'blocked', reason: t('workspace.rollout.alreadyConnected', { name: state.by }, locale) };
    case 'unknown':
      return { kind: 'blocked', reason: t('workspace.rollout.uploadListFirst', undefined, locale) };
    case 'suspended':
      return { kind: 'blocked', reason: t('workspace.rollout.suspended', undefined, locale) };
    case 'exists':
      return { kind: 'connect' };
    case 'new': {
      const problem = nameProblem('first', draft.firstName, locale) ?? nameProblem('last', draft.lastName, locale);
      return problem ? { kind: 'blocked', reason: problem } : { kind: 'import' };
    }
  }
}

/** Ids of rows whose address is also chosen for another row. */
export function duplicateAddresses(rows: Array<{ id: number; email: string }>): Set<number> {
  const byAddress = new Map<string, number[]>();
  for (const row of rows) {
    const key = normaliseAddress(row.email);
    if (!key) continue;
    byAddress.set(key, [...(byAddress.get(key) ?? []), row.id]);
  }
  return new Set([...byAddress.values()].filter((ids) => ids.length > 1).flat());
}

/** Hours since the users list was uploaded, or null when it never was. */
export function directoryAgeHours(uploadedAt: string | null, now: Date = new Date()): number | null {
  if (!uploadedAt) return null;
  const at = new Date(uploadedAt).getTime();
  return Number.isNaN(at) ? null : Math.max(0, (now.getTime() - at) / 3_600_000);
}

/**
 * The message an admin copies and sends a teacher, in the admin's language (the teacher's LMS
 * speaks the same one). The temporary password lives only in the import file, so the admin fills
 * it in; the LMS never stores or shows it.
 */
export function teacherInstructions(firstName: string, workspaceEmail: string, locale: Locale = activeLocale()): string {
  const name = firstName.trim();
  const email = { email: workspaceEmail };
  return [
    name ? t('workspace.instructions.greetingNamed', { name }, locale) : t('workspace.instructions.greeting', undefined, locale),
    '',
    t('workspace.instructions.intro', undefined, locale),
    t('workspace.instructions.address', email, locale),
    t('workspace.instructions.password', undefined, locale),
    '',
    t('workspace.instructions.signIn', email, locale),
    t('workspace.instructions.join', email, locale),
    t('workspace.instructions.recording', undefined, locale),
  ].join('\n');
}
