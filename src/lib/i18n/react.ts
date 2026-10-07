import { useCallback, useContext } from 'react';
import AuthContext from '../../contexts/AuthContext';
import { activeLocale, localeForUser, type Locale } from './locale';
import { t, type TFunction } from './translate';

/** The signed-in user's UI language; re-renders the component when the user changes. */
export function useLocale(): Locale {
  const auth = useContext(AuthContext);
  return auth ? localeForUser(auth.user) : activeLocale();
}

/** `t` bound to the current user's language: `const t = useT(); t('settings.title')`. */
export function useT(): TFunction {
  const locale = useLocale();
  return useCallback<TFunction>((key, params) => t(key, params, locale), [locale]);
}
