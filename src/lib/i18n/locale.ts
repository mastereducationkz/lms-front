/**
 * Which language the UI speaks, and the one rule that decides it.
 *
 * Owner, 2026-10-07: every person sees ONE language. Curators and head curators read Russian —
 * their screens and their tour were built in Russian — and every other role (students, parents,
 * teachers, head teachers, admins) reads English. Nothing else in the app may look at a role to
 * pick a language: it asks `uiLocale` (or the `useLocale` hook, which asks it).
 *
 * Since Q27 (2026-10-07) everyone may choose English or Русский in Settings
 * (`users.ui_language`); the choice wins over the role. Before anyone signs in, the sign-in and
 * reset pages use the language last used on this device (Q31). The backend applies the same rule
 * in lms-backend src/utils/ui_locale.py — keep the two in step.
 */

export type Locale = 'en' | 'ru';

export const LOCALES: readonly Locale[] = ['en', 'ru'];

const RUSSIAN_UI_ROLES: ReadonlySet<string> = new Set(['curator', 'head_curator']);

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ru';
}

/** THE rule: the user's own choice first, then Russian for curator roles, English for the rest. */
export function uiLocale(role?: string | null, preference?: Locale | null): Locale {
  if (isLocale(preference)) return preference;
  return role && RUSSIAN_UI_ROLES.has(role) ? 'ru' : 'en';
}

type LocaleUser = { role?: string | null; ui_language?: string | null };

/** The user's own language choice (Settings → Language), or undefined for the role's default. */
export function userLanguagePreference(user?: LocaleUser | null): Locale | undefined {
  const choice = user?.ui_language;
  return isLocale(choice) ? choice : undefined;
}

/** The locale of a signed-in user; before anyone signs in, this device's last one (or English). */
export function localeForUser(user?: LocaleUser | null): Locale {
  if (!user) return deviceLocale() ?? 'en';
  return uiLocale(user.role, userLanguagePreference(user));
}

const DEVICE_KEY = 'lms:ui-language';

/** The language last used on this device, for the pages shown before signing in (Q31). */
export function deviceLocale(): Locale | undefined {
  try {
    const stored = globalThis.localStorage?.getItem(DEVICE_KEY);
    return isLocale(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function rememberDeviceLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(DEVICE_KEY, locale);
  } catch {
    /* storage blocked: the sign-in page falls back to English */
  }
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
