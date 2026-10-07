/**
 * Look Up's translation language: Russian (default) or Kazakh, the student's choice.
 * Kept on the account (users.ui_state.prefs, arrives with /auth/me) so it follows them to every
 * device; this browser's copy covers a save that hasn't reached the server.
 */
import { useCallback, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import type { LookupLang } from '../../../services/api/lookup';
import { saveLookupLang } from '../../../services/api/uiState';

const isLang = (value: unknown): value is LookupLang => value === 'ru' || value === 'kk';
const storageKey = (userId: string | number | undefined) => `lookup:lang:${userId ?? 'anon'}`;

function readStored(userId: string | number | undefined): string | null {
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/** The account's choice wins; then this browser's; then Russian. */
export function pickLookupLang(account: unknown, stored: unknown): LookupLang {
  if (isLang(account)) return account;
  if (isLang(stored)) return stored;
  return 'ru';
}

export function useLookupLang(): [LookupLang, (lang: LookupLang) => void] {
  const { user, updateUser } = useAuth();
  const account = user?.ui_state?.prefs?.lookup_lang;
  const [chosen, setChosen] = useState<LookupLang | null>(null);
  const lang = chosen ?? pickLookupLang(account, readStored(user?.id));

  const choose = useCallback(
    (next: LookupLang) => {
      setChosen(next);
      try {
        window.localStorage.setItem(storageKey(user?.id), next);
      } catch {
        /* storage blocked: the account alone remembers */
      }
      saveLookupLang(next)
        .then((state) => {
          if (user) updateUser({ ...user, ui_state: state });
        })
        .catch(() => {
          /* offline or an older server: this browser still remembers */
        });
    },
    [user, updateUser],
  );

  return [lang, choose];
}
