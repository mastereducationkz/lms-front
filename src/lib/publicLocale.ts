import { useCallback, useState } from 'react';
import { deviceLocale, isLocale, rememberDeviceLocale, type Locale } from './i18n/locale';
import { t as translate, type TFunction } from './i18n/translate';

/**
 * The language of a page a visitor opens without signing in. The LMS's own rule (a role decides) does not
 * apply to someone who has no role: their last choice on this device wins, then their browser's language —
 * Russian for Russian and Kazakh browsers, which is most of the people these pages are for — else English.
 */
export function initialPublicLocale(): Locale {
  const remembered = deviceLocale();
  if (remembered) return remembered;
  const browser = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
  return browser.startsWith('ru') || browser.startsWith('kk') ? 'ru' : 'en';
}

export function usePublicLocale(): { locale: Locale; setLocale: (next: Locale) => void; t: TFunction } {
  const [locale, set] = useState<Locale>(initialPublicLocale);
  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    rememberDeviceLocale(next);
    set(next);
  }, []);
  const t = useCallback<TFunction>((key, params) => translate(key, params, locale), [locale]);
  return { locale, setLocale, t };
}
