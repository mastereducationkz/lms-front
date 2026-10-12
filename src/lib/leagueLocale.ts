import { userLanguagePreference, type Locale } from './i18n';

/**
 * The language of the Master League's own words (owner, 2026-10-13): Russian for a student who never
 * chose a language, English for one who did choose English. The same rule the backend applies to every
 * League message (lms-backend `src/master_league/digest.py` DEFAULT_LANG, and the invitation's bell,
 * push, Telegram and e-mail), so the page a student opens from a notice speaks the notice's language.
 * The rest of the app keeps the role's default (`uiLocale`).
 */
export const LEAGUE_DEFAULT_LOCALE: Locale = 'ru';

export function leagueLocale(user?: { ui_language?: string | null } | null): Locale {
  return userLanguagePreference(user) ?? LEAGUE_DEFAULT_LOCALE;
}
