/**
 * The CRM writes a Master League squad's weekly schedule in Russian («Пн, Ср 18:00; Сб 11:00», crm-master
 * src/master_league/invitations.py). An English reader gets it in English; a Russian reader gets it as
 * written. This file only parses that text, so it is on the Russian-text allowlist
 * (src/test/ui-language.allowlist.ts); nothing here is shown in Russian by itself.
 */
import { activeLocale, t, type Locale } from './i18n';
import '@/lib/i18n/catalogs/studentHome';

const DAYS_EN: Record<string, string> = { Пн: 'Mon', Вт: 'Tue', Ср: 'Wed', Чт: 'Thu', Пт: 'Fri', Сб: 'Sat', Вс: 'Sun' };
const TO_BE_CONFIRMED = 'Расписание уточняется';

/**
 * The CRM writes a squad's schedule in Russian, «Пн, Ср 18:00; Сб 11:00»; an English reader gets
 * «Mon, Wed 18:00; Sat 11:00». Russian stays as written. Anything unrecognised is left alone.
 */
export function localizeSchedule(text: string, locale: Locale = activeLocale()): string {
  const trimmed = (text || '').trim();
  if (locale === 'ru') return trimmed || t('studentHome.leagueInvite.scheduleTbc', undefined, 'ru');
  if (!trimmed || trimmed === TO_BE_CONFIRMED) return t('studentHome.leagueInvite.scheduleTbc', undefined, 'en');
  return trimmed.replace(/(?<![\p{L}])(Пн|Вт|Ср|Чт|Пт|Сб|Вс)(?![\p{L}])/gu, (day) => DAYS_EN[day]);
}

/** One chip per day-group of the schedule: «Mon, Wed 18:00», «Sat 11:00». */
export function scheduleChips(text: string, locale: Locale = activeLocale()): string[] {
  return localizeSchedule(text, locale).split(';').map((s) => s.trim()).filter(Boolean);
}
