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

export function addressProblem(value: string): string | null {
  const address = normaliseAddress(value);
  if (!address) return 'Enter the Workspace address';
  if (!address.endsWith(`@${WORKSPACE_DOMAIN}`)) return `Must end with @${WORKSPACE_DOMAIN}`;
  if (!MAILBOX.test(address.slice(0, -(WORKSPACE_DOMAIN.length + 1)))) return 'Not a valid mailbox name';
  return null;
}

export function nameProblem(label: string, value: string): string | null {
  const name = value.trim();
  if (!name) return `${label} is empty`;
  if (name.length > NAME_MAX) return `${label} is longer than ${NAME_MAX} characters`;
  if (!ENGLISH_NAME.test(name)) return `${label} must be written in English letters`;
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
export function draftIntent(draft: Draft, state: AccountState): Intent {
  const address = addressProblem(draft.email);
  if (address) return { kind: 'blocked', reason: address };
  switch (state.kind) {
    case 'taken':
      return { kind: 'blocked', reason: `Already connected to ${state.by}` };
    case 'unknown':
      return { kind: 'blocked', reason: 'Upload the Workspace users list first' };
    case 'suspended':
      return { kind: 'blocked', reason: 'This account is suspended in Google Workspace' };
    case 'exists':
      return { kind: 'connect' };
    case 'new': {
      const problem = nameProblem('First name', draft.firstName) ?? nameProblem('Last name', draft.lastName);
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
 * The message an admin copies and sends a teacher. The temporary password lives only in the
 * import file, so the admin fills it in; the LMS never stores or shows it.
 */
export function teacherInstructions(firstName: string, workspaceEmail: string): string {
  const name = firstName.trim();
  return [
    `Здравствуйте${name ? `, ${name}` : ''}!`,
    '',
    'Для ваших уроков создан рабочий Google-аккаунт Master Education:',
    `Адрес: ${workspaceEmail}`,
    'Временный пароль: ________',
    '',
    `1. До ближайшего урока откройте https://accounts.google.com, войдите как ${workspaceEmail} и задайте свой пароль. Пока вы ни разу не вошли, Google не считает вас сотрудником школы — и урок не запишется.`,
    `2. На урок заходите кнопкой «Join» в LMS: ссылка сама откроет Meet под рабочим аккаунтом. Если Google спросит, какой аккаунт использовать, выберите ${workspaceEmail}, а не личный.`,
    '3. Запись включается сама, нажимать ничего не нужно. Записи ваших уроков появятся в LMS в разделе Lesson Recordings.',
  ].join('\n');
}
