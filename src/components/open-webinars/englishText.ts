import type { Locale } from '../../lib/i18n/locale';
import type { PublicSpeaker } from '../../services/api/publicWebinars';

/** The English text when the visitor reads English and someone wrote one; otherwise the original. */
export function inLocale(locale: Locale, original: string, english?: string | null): string;
export function inLocale(locale: Locale, original: string | null, english?: string | null): string | null;
export function inLocale(locale: Locale, original: string | null, english?: string | null): string | null {
  return locale === 'en' && english?.trim() ? english : original;
}

/** A speaker's name and bio as the visitor's language has them; the rest is the same in both. */
export const speakerIn = (locale: Locale, speaker: PublicSpeaker): PublicSpeaker => ({
  ...speaker,
  name: inLocale(locale, speaker.name, speaker.name_en),
  bio: inLocale(locale, speaker.bio, speaker.bio_en),
});
