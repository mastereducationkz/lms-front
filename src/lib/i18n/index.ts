/**
 * The app's one translation layer (owner, 2026-10-07: one language per role, a per-user switch
 * later). Plain functions only, safe to import from any lib module or test; the React hooks live
 * in ./react. A file that shows an area's keys also imports that area's catalog for its effect:
 * `import '@/lib/i18n/catalogs/settings';` (ui-language.test.ts checks it).
 *
 *   t('settings.title')                         → "Settings" / «Настройки»
 *   t('common.lessons', { count: 5 })           → "5 lessons" / «5 уроков»
 *   formatDate(iso) / formatTime / formatDateTime / formatNumber
 *   uiLocale(role)                              → the rule: curators read Russian, everyone else English
 */
export { activeLocale, deviceLocale, intlLocale, isLocale, localeForUser, LOCALES, rememberDeviceLocale, setActiveLocale, uiLocale, userLanguagePreference, type Locale } from './locale';
export { hasMessage, plural, t, type TFunction } from './translate';
export { DATE, DATE_TIME, formatDate, formatDateTime, formatNumber, formatTime, TIME, type DateInput } from './format';
export type { MessageKey } from './en';
export type { Params, PluralForms } from './types';
