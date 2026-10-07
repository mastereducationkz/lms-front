import type { MessageKey } from './en';
import { common as enCommon } from './en/common';
import { activeLocale, intlLocale, type Locale } from './locale';
import { common as ruCommon } from './ru/common';
import type { Message, MessageTable, Params, PluralForms } from './types';

/**
 * The messages this page has loaded. Each area's catalog travels with the code that shows it:
 * src/lib/i18n/catalogs/<area>.ts registers both languages and is imported (for that effect) by
 * every file that names one of its keys, so a screen's copy downloads with the screen rather than
 * every visitor fetching every screen's text up front. ui-language.test.ts checks those imports.
 */
const CATALOGS: Record<Locale, Record<string, Message>> = { en: { ...enCommon }, ru: { ...ruCommon } };

export function registerMessages(en: MessageTable, ru: Readonly<Record<string, Message>>): void {
  Object.assign(CATALOGS.en, en);
  Object.assign(CATALOGS.ru, ru);
}

/** Whether `key` names a loaded message (for keys built from server data). */
export function hasMessage(key: string): key is MessageKey {
  return key in CATALOGS.en;
}

export type TFunction = (key: MessageKey, params?: Params) => string;

/**
 * The text for `key` in `locale` (the signed-in user's by default), with `{name}` placeholders
 * filled from `params`. A plural message picks its form from `params.count`. A key missing from
 * the Russian catalog falls back to English — the catalog test makes sure none is.
 */
export function t(key: MessageKey, params?: Params, locale: Locale = activeLocale()): string {
  const message = CATALOGS[locale][key] ?? CATALOGS.en[key];
  if (message === undefined) return key;
  const text = typeof message === 'string' ? message : pluralForm(message, Number(params?.count), locale);
  return params ? interpolate(text, params) : text;
}

/**
 * The form of `forms` that fits `count`, with `{count}` filled in — for code that keeps its own
 * forms: plural(5, { one: '{count} урок', few: '{count} урока', many: '{count} уроков', other: '{count} урока' }, 'ru').
 */
export function plural(count: number, forms: PluralForms, locale: Locale = activeLocale()): string {
  return interpolate(pluralForm(forms, count, locale), { count });
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function pluralForm(forms: PluralForms, count: number, locale: Locale): string {
  if (!Number.isFinite(count)) return forms.other;
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(intlLocale(locale));
    pluralRules.set(locale, rules);
  }
  return forms[rules.select(count)] ?? forms.other;
}

function interpolate(text: string, params: Params): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}
