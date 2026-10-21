import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Video } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { getRecordingStatus, publishRecording, withdrawRecording, type RecordingStatus } from '../../services/api/openWebinars';
import { LMS_ORIGIN } from '../../lib/lessonLinks';
import { formatDate } from '../../lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

/** The webinar's recording on the admin's page: nothing is public until a staff member publishes it, and it can be withdrawn. */
export default function RecordingPanel({ eventId, slug }: { eventId: number; slug: string | null }) {
  const t = useT();
  const locale = useLocale();
  const [rec, setRec] = useState<RecordingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => getRecordingStatus(eventId).then(setRec).catch(() => setError(t('openWebinars.admin.loadFailed'))), [eventId, t]);
  useEffect(() => { void load(); }, [load]);
  if (!rec) return error ? <p className="text-sm text-red-600">{error}</p> : null;

  const act = async (run: (id: number) => Promise<RecordingStatus>) => {
    setBusy(true); setError(null);
    try { setRec(await run(eventId)); } catch (failure) { setError(failure instanceof Error ? failure.message : t('openWebinars.error.generic')); } finally { setBusy(false); }
  };
  const link = slug ? `${LMS_ORIGIN}/r/${slug}` : null;
  const when = (iso: string | null) => (iso ? formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric' }, locale) : '');

  let line: string;
  if (!rec.has_recording) line = t('openWebinars.admin.rec.none');
  else if (rec.recording_status === 'pending') line = t('openWebinars.admin.rec.processing');
  else if (rec.recording_status === 'failed') line = t('openWebinars.admin.rec.failed');
  else if (rec.recording_status === 'removed') line = t('openWebinars.admin.rec.removed');
  else if (rec.published) line = t('openWebinars.admin.rec.published', { date: when(rec.published_at), views: rec.views });
  else if (rec.withdrawn_at) line = t('openWebinars.admin.rec.withdrawn', { date: when(rec.withdrawn_at) });
  else line = t('openWebinars.admin.rec.ready');

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* shown anyway */ }
  };

  return (
    <Card data-recording-panel>
      <CardContent className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Video className="h-4 w-4" aria-hidden />{t('openWebinars.admin.rec.title')}</h2>
        <p className="text-sm text-muted-foreground">{line}</p>
        {rec.ready && !rec.published && <p className="text-xs text-muted-foreground">{t('openWebinars.admin.rec.warn')}</p>}
        {rec.published && <p className="text-xs text-muted-foreground">{t('openWebinars.admin.rec.withdrawHelp')}</p>}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {rec.ready && !rec.published && (
            <Button type="button" onClick={() => act(publishRecording)} disabled={busy}>{rec.withdrawn_at ? t('openWebinars.admin.rec.publishAgain') : t('openWebinars.admin.rec.publish')}</Button>
          )}
          {rec.published && <Button type="button" variant="outline" onClick={() => act(withdrawRecording)} disabled={busy}>{t('openWebinars.admin.rec.withdraw')}</Button>}
          {rec.published && link && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={t('openWebinars.admin.rec.link')}>
                {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden />}
                {copied ? t('openWebinars.admin.access.copied') : t('openWebinars.admin.access.copy')}
              </Button>
              <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-primary underline-offset-4 hover:underline">{link}</a>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
