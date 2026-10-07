/**
 * «Share achievement» copy (owner, 2026-10-04): every word on the story card, in one place.
 * First person — the student is the one posting it — warm and confident, never shouty.
 * The card speaks the student's language (since Q27 anyone may pick Русский); the Russian lines
 * avoid first-person past-tense verbs, which would need the student's gender.
 */
import { activeLocale, formatDate, hasMessage, t, type Locale, type MessageKey } from '@/lib/i18n';
import { achievementField } from '@/lib/achievements';
import type { AchievementTier } from '@/services/api/achievementsUi';
import '@/lib/i18n/catalogs/sharedUi';
import '@/lib/i18n/catalogs/studentHome';

export type ShareKind = 'achievement' | 'star' | 'kasatik_lesson';
export type NameMode = 'short' | 'full' | 'none';
/** The card's colourway: brand blue, gold for the big moments, emerald for seasonal. */
export type CardAccent = 'blue' | 'gold' | 'emerald';

export interface CardText {
  pill: string;
  lead: string | null;
  title: string;
  line: string | null;
  accent: CardAccent;
}

/** One proud line per achievement, in the student's own voice (sharedUi.shareCard.proud.<key>); null for one without. */
export function proudLine(key: string, locale: Locale = activeLocale()): string | null {
  const id = `sharedUi.shareCard.proud.${key}`;
  return hasMessage(id) ? t(id, undefined, locale) : null;
}

export const TIER_PILL: Record<AchievementTier, MessageKey> = {
  earned: 'sharedUi.shareCard.pill.achievement',
  rare: 'sharedUi.shareCard.pill.rare',
  legendary: 'sharedUi.shareCard.pill.legendary',
  social: 'sharedUi.shareCard.pill.achievement',
  seasonal: 'sharedUi.shareCard.pill.seasonal',
};

const CHOSEN_BY: Record<string, MessageKey> = {
  teacher: 'sharedUi.shareCard.star.chosenByTeacher',
  curator: 'sharedUi.shareCard.star.chosenByCurator',
  admin: 'sharedUi.shareCard.star.chosenByTeacher',
};

/** What the card prints for a name: «short» = first word + the last word's initial («Аружан К.»).
 *  Names are typed free-form, so the preview shows exactly this and the student can switch. */
export function formatShareName(name: string | null | undefined, mode: NameMode): string | null {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (mode === 'none' || words.length === 0) return null;
  if (mode === 'full' || words.length === 1) return words.join(' ');
  return `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`;
}

export function achievementText(
  a: { key: string; title: string; tier: AchievementTier; description?: string | null },
  locale: Locale = activeLocale(),
): CardText {
  return {
    pill: t(TIER_PILL[a.tier] ?? 'sharedUi.shareCard.pill.achievement', undefined, locale),
    lead: t('sharedUi.shareCard.unlockedLead', undefined, locale),
    title: achievementField(a, 'title', locale),
    line: proudLine(a.key, locale) ?? achievementField(a, 'description', locale) ?? null,
    accent: a.tier === 'legendary' ? 'gold' : a.tier === 'seasonal' ? 'emerald' : 'blue',
  };
}

export function starText(s: { reason: string; awarded_by_role: string }, locale: Locale = activeLocale()): CardText {
  const reason = s.reason.trim().replace(/[.!…]+$/u, '');
  return {
    pill: t(CHOSEN_BY[s.awarded_by_role] ?? 'sharedUi.shareCard.star.chosenByTeacher', undefined, locale),
    lead: null,
    title: t('sharedUi.shareCard.star.title', undefined, locale),
    line: reason ? t('sharedUi.shareCard.star.reason', { reason }, locale) : null,
    accent: 'gold',
  };
}

export function crownText(c: { lesson_title: string | null; lesson_date: string | null }, locale: Locale = activeLocale()): CardText {
  const when = c.lesson_date ? formatDate(c.lesson_date, { day: 'numeric', month: 'short' }, locale) : null;
  return {
    pill: when ? t('sharedUi.shareCard.crown.pillDated', { date: when }, locale) : t('sharedUi.shareCard.crown.pill', undefined, locale),
    lead: t('sharedUi.shareCard.crown.lead', undefined, locale),
    title: t('sharedUi.shareCard.crown.title', undefined, locale),
    line: c.lesson_title?.trim() || null,
    accent: 'gold',
  };
}

/** The share-sheet caption that rides along with the image (some apps show it, Stories don't). */
export const shareCaption = (locale: Locale = activeLocale()) => t('sharedUi.shareCard.caption', undefined, locale);
export const tagPrompt = (locale: Locale = activeLocale()) => t('studentHome.share.tagPrompt', undefined, locale);

/** How a card left the device: the system share sheet, or saved as an image. */
export type ShareMethod = 'native' | 'download';

/** The dialog's buttons. [Share] wherever the device can share files (on a phone that sheet is
 *  where Instagram, WhatsApp and Snapchat live); [Save image] always. A computer's share sheet
 *  never offers a story, so there Save image comes first. */
export function shareButtons(env: { canShareFiles: boolean; isDesktop: boolean }): { share: boolean; primary: 'share' | 'save' } {
  return { share: env.canShareFiles, primary: env.canShareFiles && !env.isDesktop ? 'share' : 'save' };
}

/** iPhone / iPad (incl. iPadOS, which reports itself as a Mac with touch). */
export function isIOSDevice(nav: { userAgent: string; platform?: string; maxTouchPoints?: number }): boolean {
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
}

/** How [Save image] saves: on iOS a download of a blob can open a tab instead of saving, so it
 *  goes through the share sheet (its «Save Image» puts the card in Photos); elsewhere a download. */
export function saveMethod(env: { ios: boolean; canShareFiles: boolean }): 'sheet' | 'download' {
  return env.ios && env.canShareFiles ? 'sheet' : 'download';
}

export const desktopHint = (locale: Locale = activeLocale()) => t('studentHome.share.desktopHint', undefined, locale);

/** A share attempt's outcome, worded honestly: a closed sheet isn't an error, a failure isn't «cancelled». */
export function shareErrorMessage(error: unknown, locale: Locale = activeLocale()): string | null {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'AbortError') return null;
  if (name === 'NotAllowedError') return t('studentHome.share.blocked', undefined, locale);
  return t('studentHome.share.failed', undefined, locale);
}
