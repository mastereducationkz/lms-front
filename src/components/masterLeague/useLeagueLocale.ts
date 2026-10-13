/** The invitation's language: the student's own choice, else Russian (src/lib/leagueLocale.ts). */
import { useCallback, useContext } from 'react';
import AuthContext from '@/contexts/AuthContext';
import { t, type Locale, type TFunction } from '@/lib/i18n';
import { leagueLocale } from '@/lib/leagueLocale';

export function useLeagueLocale(): Locale {
  return leagueLocale(useContext(AuthContext)?.user);
}

/** `useT` for League screens: `const t = useLeagueT()`. */
export function useLeagueT(): TFunction {
  const locale = useLeagueLocale();
  return useCallback<TFunction>((key, params) => t(key, params, locale), [locale]);
}
