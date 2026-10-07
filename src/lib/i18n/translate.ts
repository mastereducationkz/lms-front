import { en, type MessageKey } from './en';
import { activeLocale, intlLocale, type Locale } from './locale';
import { ru } from './ru';
import type { Message, Params, PluralForms } from './types';

const CATALOGS: Record<Locale, Readonly<Record<string, Message>>> = { en, ru };

export type TFunction = (key: MessageKey, params?: Params) => string;

/**
 * The text for `key` in `locale` (the signed-in user's by default), with `{name}` placeholders
 * filled from `params`. A plural message picks its form from `params.count`. A key missing from
 * the Russian catalog falls back to English — the catalog test makes sure none is.
 */
export function t(key: MessageKey, params?: Params, locale: Locale = activeLocale()): string {
  const message = CATALOGS[locale][key] ?? en[key];
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
