/**
 * Master League season themes (owner, 2026-11-02, docs/master-league/SEASON-STUDIO.md): the November
 * cohort plays FOOTBALL for ever, the December cohort is a STUDIO / album drop. A student is in the
 * League once in a lifetime, so each sees exactly one theme. The server names it (`theme` on
 * /master-league/me and /master-league/invitation, `league_theme` on /achievements/me); anything else,
 * a missing field included, is football, so this front end is safe before or after its backend.
 *
 * Studio words live next to the football ones under a `studio.` segment
 * (studentHome.league.studio.<rest>, studentHome.leagueInvite.studio.<rest>,
 * studentHome.achievement.<id>.studio.<field>, sharedUi.shareCard.proud.studio.<id>). A studio key
 * that is not written falls back to the football key, which is the shared, neutral wording.
 */
import { hasMessage, t, type Locale, type MessageKey, type Params, type TFunction } from './i18n';
import '@/lib/i18n/catalogs/sharedUi';
import '@/lib/i18n/catalogs/studentHome';

import type { LeagueTheme } from './leagueThemeName';

export { asLeagueTheme, LEAGUE_THEMES, type LeagueTheme } from './leagueThemeName';

const PREFIXES = ['studentHome.leagueInvite.', 'studentHome.league.', 'sharedUi.shareCard.proud.'];
const ACHIEVEMENT = /^(studentHome\.achievement\.[^.]+\.)([^.]+)$/;

/** Where a key's studio variant would live (whether or not it is written); null for a key with none. */
export function studioKeyOf(key: string): string | null {
  const m = ACHIEVEMENT.exec(key);
  if (m) return `${m[1]}studio.${m[2]}`;
  const prefix = PREFIXES.find((p) => key.startsWith(p));
  return prefix ? `${prefix}studio.${key.slice(prefix.length)}` : null;
}

/** The key to read for `theme`: the studio variant when it is written, else the key itself. Football is always the key itself. */
export function themedKey(key: MessageKey, theme: LeagueTheme | null | undefined): MessageKey {
  if (theme !== 'studio') return key;
  const studio = studioKeyOf(key);
  return studio && hasMessage(studio) ? studio : key;
}

/** `t` in a season's words. */
export function themedT(key: MessageKey, params: Params | undefined, locale: Locale | undefined, theme: LeagueTheme | null | undefined): string {
  return t(themedKey(key, theme), params, locale);
}

/** Wrap a translate function (useT, useLeagueT) so every key it reads follows the season. */
export function withTheme(tr: TFunction, theme: LeagueTheme | null | undefined): TFunction {
  return theme === 'studio' ? (key, params) => tr(themedKey(key, theme), params) : tr;
}

/**
 * Which season's words the server sent for a league achievement. The server renders the student's
 * season in English (lms-backend src/achievements/catalog.py), so its English title says it: a title
 * equal to the studio title is a studio one. Anything else, and every non-league achievement, is football.
 */
export function achievementTheme(a: { key: string; title?: string | null }): LeagueTheme {
  const key = `studentHome.achievement.${a.key}.studio.title`;
  return a.title && hasMessage(key) && t(key, undefined, 'en') === a.title ? 'studio' : 'football';
}

/** A group's name that never breaks at its hyphen («Off-Season» stays whole on a phone): non-breaking hyphens. */
export const unbreakable = (name: string): string => name.replace(/-/g, '‑');

/** The look a studio group gets, by the tail of its name («Master League Section.80» → section80). */
export type StudioGroupLook = 'offSeason' | 'section80' | 'studio';

export function studioGroupLook(groupTailName: string | null | undefined): StudioGroupLook {
  const k = (groupTailName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k === 'offseason') return 'offSeason';
  if (k === 'section80') return 'section80';
  return 'studio';
}
