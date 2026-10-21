import { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { getPublicSummary, type PublicSummary } from '../../services/api/openWebinars';
import { LMS_ORIGIN } from '../../lib/lessonLinks';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

/**
 * What a host teacher or curator sees on their webinar when it is open to everyone: read-only, and no personal
 * data. Opening or closing it is a head's call (the edit page's Public access card), so nothing here changes it.
 * Says nothing when the webinar is not open, or when the server will not tell this person.
 */
export default function PublicAccessStrip({ eventId }: { eventId: number }) {
  const t = useT();
  const [summary, setSummary] = useState<PublicSummary | null>(null);

  useEffect(() => {
    let live = true;
    getPublicSummary(eventId).then((s) => live && setSummary(s)).catch(() => live && setSummary(null));
    return () => { live = false; };
  }, [eventId]);

  if (!summary?.open) return null;
  const url = summary.slug ? `${LMS_ORIGIN}/w/${summary.slug}` : null;
  return (
    <div data-public-strip className="mt-4 space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Globe2 className="h-3.5 w-3.5" aria-hidden />
        {t('openWebinars.admin.strip.title')} · {t(summary.access_mode === 'registration' ? 'openWebinars.admin.strip.registration' : 'openWebinars.admin.strip.open')}
      </p>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-primary underline-offset-4 hover:underline">{url}</a>}
      <p>{t('openWebinars.admin.strip.counts', { registered: summary.registered, joined: summary.joined })}</p>
      {summary.recording_published && <p>{t('openWebinars.admin.strip.recording')}</p>}
    </div>
  );
}
