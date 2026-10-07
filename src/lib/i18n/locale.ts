/**
 * Which language the UI speaks, and the one rule that decides it.
 *
 * Owner, 2026-10-07: every person sees ONE language. Curators and head curators read Russian —
 * their screens and their tour were built in Russian — and every other role (students, parents,
 * teachers, head teachers, admins) reads English. Nothing else in the app may look at a role to
 * pick a language: it asks `uiLocale` (or the `useLocale` hook, which asks it).
 *
 * A per-user language switch plugs in here: `userLanguagePreference` returns the user's own
 * choice once the backend stores one, and `uiLocale` lets that choice win over the role.
 */

export type Locale = 'en' | 'ru';

export const LOCALES: readonly Locale[] = ['en', 'ru'];

const RUSSIAN_UI_ROLES: ReadonlySet<string> = new Set(['curator', 'head_curator']);

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ru';
}

/** THE rule: the user's own choice first (none exists yet), then Russian for curator roles. */
export function uiLocale(role?: string | null, preference?: Locale | null): Locale {
  if (isLocale(preference)) return preference;
  return role && RUSSIAN_UI_ROLES.has(role) ? 'ru' : 'en';
}

/**
 * The user's own language choice. There is none yet, so this is always undefined; when users can
 * pick EN/RU, read the stored field here (e.g. `user.ui_language`) and every screen follows.
 */
export function userLanguagePreference(_user?: { role?: string | null } | null): Locale | undefined {
  return undefined;
}

/** The locale of a signed-in user (or English before anyone signs in). */
export function localeForUser(user?: { role?: string | null } | null): Locale {
  return uiLocale(user?.role, userLanguagePreference(user));
}

/**
 * The BCP 47 tag handed to Intl. English is en-GB, not en-US: day before month ("7 Oct 2026",
 * "07/10/2026") and a 24-hour clock ("19:00"), which is how Kazakhstan writes dates and lesson
 * times. en-US would print "Oct 7" and "7:00 PM" and turn 07/10 into July 10th.
 */
export function intlLocale(locale: Locale): 'en-GB' | 'ru-RU' {
  return locale === 'ru' ? 'ru-RU' : 'en-GB';
}

let active: Locale = 'en';

/**
 * The signed-in user's locale, for code that runs outside React (lib helpers, toasts, the error
 * screen). AuthProvider keeps it current; components should prefer `useLocale()`.
 */
export function activeLocale(): Locale {
  return active;
}

export function setActiveLocale(locale: Locale): void {
  active = locale;
}
