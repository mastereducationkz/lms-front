import { Mic2, UserRound } from 'lucide-react';
import type { Locale } from '../../lib/i18n/locale';
import type { TFunction } from '../../lib/i18n/translate';
import type { PublicSpeaker } from '../../services/api/publicWebinars';
import { mediaUrl } from '../../lib/mediaUrl';
import { speakerIn } from './englishText';
import '@/lib/i18n/catalogs/openWebinars';

/**
 * Who is named on a public page. A guest speaker gets their profile (photo, organisation, bio); the event's host,
 * who is only ever named by their LMS display name, gets one plain «Host: <name>» line: no photo, no bio.
 * Nothing at all when nobody is named (`speaker: null`). In English the speaker's English name and bio are shown
 * when they were written, the original otherwise.
 */
export default function PresenterBlock({ speaker: original, locale, t }: { speaker: PublicSpeaker | null; locale: Locale; t: TFunction }) {
  if (!original) return null;
  const speaker = speakerIn(locale, original);
  // An uploaded photo is a path on the API host; an older speaker may still hold an absolute URL, which `mediaUrl` leaves alone.
  const photo = mediaUrl(speaker.photo_url);
  if (speaker.kind === 'host') {
    return (
      <p data-host-line className="mt-4 flex items-center gap-2 text-sm text-foreground">
        <UserRound className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
        {t('openWebinars.host', { name: speaker.name })}
      </p>
    );
  }
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl bg-muted/50 p-3" data-speaker>
      {photo ? (
        <img src={photo} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
      ) : (
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary/10 text-primary"><Mic2 className="h-5 w-5" aria-hidden /></span>
      )}
      <div className="min-w-0 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('openWebinars.speaker')}</p>
        <p className="font-semibold text-foreground">{speaker.name}{speaker.organisation ? `, ${speaker.organisation}` : ''}</p>
        {speaker.bio && <p className="mt-0.5 text-muted-foreground">{speaker.bio}</p>}
      </div>
    </div>
  );
}
