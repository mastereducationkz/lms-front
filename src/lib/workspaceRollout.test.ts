import { describe, expect, it } from 'vitest';
import {
  accountState,
  addressProblem,
  directoryAgeHours,
  draftIntent,
  duplicateAddresses,
  nameProblem,
  teacherInstructions,
  type DirectoryAccount,
} from './workspaceRollout';

const account = (email: string, extra: Partial<DirectoryAccount> = {}): DirectoryAccount => ({
  email, first_name: '', last_name: '', org_unit: '/Teachers', suspended: false, signed_in: true, ...extra,
});
const directory = new Map([
  ['nuray@mastereducation.kz', account('nuray@mastereducation.kz', { signed_in: false })],
  ['old@mastereducation.kz', account('old@mastereducation.kz', { suspended: true })],
]);
const draft = (email: string, firstName = 'Nuray', lastName = 'Kobeisin') => ({ email, firstName, lastName });

describe('addresses and names', () => {
  it('accepts only our domain and a plain mailbox', () => {
    expect(addressProblem(' Nuray@MasterEducation.kz ')).toBeNull();
    expect(addressProblem('nuray@gmail.com')).toMatch(/mastereducation\.kz/);
    expect(addressProblem('nu ray@mastereducation.kz')).toMatch(/mailbox/);
    expect(addressProblem('')).toMatch(/Enter/);
  });

  it('asks for English names', () => {
    expect(nameProblem('First name', 'Yernur')).toBeNull();
    expect(nameProblem('Last name', "O'Brien-Smith")).toBeNull();
    expect(nameProblem('First name', 'Ернур')).toMatch(/English/);
    expect(nameProblem('Last name', '  ')).toMatch(/empty/);
  });
});

describe('what the users list says', () => {
  it('tells an existing account from a new one, and knows nothing without a list', () => {
    const none = new Map<string, string>();
    expect(accountState('NURAY@mastereducation.kz', directory, none)).toEqual(
      { kind: 'exists', signedIn: false, orgUnit: '/Teachers' },
    );
    expect(accountState('miras@mastereducation.kz', directory, none)).toEqual({ kind: 'new' });
    expect(accountState('old@mastereducation.kz', directory, none)).toEqual({ kind: 'suspended' });
    expect(accountState('nuray@mastereducation.kz', null, none)).toEqual({ kind: 'unknown' });
    expect(accountState('nuray@mastereducation.kz', directory, new Map([['nuray@mastereducation.kz', 'Aisha']])))
      .toEqual({ kind: 'taken', by: 'Aisha' });
  });
});

describe('what the buttons would do', () => {
  const none = new Map<string, string>();
  const intent = (email: string, first = 'Nuray', last = 'Kobeisin', dir = directory) =>
    draftIntent(draft(email, first, last), accountState(email, dir, none));

  it('connects an existing account and imports a new one', () => {
    expect(intent('nuray@mastereducation.kz')).toEqual({ kind: 'connect' });
    expect(intent('nuray.kobeisin@mastereducation.kz')).toEqual({ kind: 'import' });
  });

  it('never imports an existing address and never guesses without a list', () => {
    expect(intent('nuray.kobeisin@mastereducation.kz', 'Nuray', 'Kobeisin', null as never)).toMatchObject(
      { kind: 'blocked', reason: expect.stringMatching(/users list/) },
    );
    expect(intent('old@mastereducation.kz')).toMatchObject({ kind: 'blocked' });
  });

  it('only a new account needs English names', () => {
    expect(intent('nuray.kobeisin@mastereducation.kz', 'Нурай')).toMatchObject(
      { kind: 'blocked', reason: expect.stringMatching(/English/) },
    );
    expect(intent('nuray@mastereducation.kz', 'Нурай')).toEqual({ kind: 'connect' });
  });
});

describe('helpers', () => {
  it('flags every row that shares an address', () => {
    expect([...duplicateAddresses([
      { id: 1, email: 'miras@mastereducation.kz' },
      { id: 2, email: ' MIRAS@mastereducation.kz' },
      { id: 3, email: 'aida@mastereducation.kz' },
      { id: 4, email: '' },
    ])].sort()).toEqual([1, 2]);
  });

  it('measures how old the users list is', () => {
    expect(directoryAgeHours(null)).toBeNull();
    expect(directoryAgeHours('2026-09-14T10:00:00Z', new Date('2026-09-14T13:00:00Z'))).toBe(3);
  });

  it('writes instructions with the address and a blank for the password', () => {
    const text = teacherInstructions('Nuray', 'nuray@mastereducation.kz');
    expect(text).toContain('Здравствуйте, Nuray!');
    expect(text).toContain('Адрес: nuray@mastereducation.kz');
    expect(text).toContain('Временный пароль: ________');
  });
});
