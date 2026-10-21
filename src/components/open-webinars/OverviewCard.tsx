import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getOverview, retryFailedLeads, type Overview } from '../../services/api/openWebinars';
import { formatDateTime } from '../../lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

type Note = { kind: 'ok' | 'error'; text: string };

/**
 * Every webinar that is, or was, open to everyone: when, how it was open, how many registered and how many leads
 * failed to reach the CRM. Newest first; a row opens that webinar's registrations. «Retry all failed» sends every
 * failed lead of every webinar again, so nobody has to open them one by one.
 */
export default function OverviewCard() {
  const t = useT();
  const locale = useLocale();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const load = useCallback(async () => {
    try { setOverview(await getOverview()); setFailed(false); } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const retryAll = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { retried } = await retryFailedLeads();
      setNote({ kind: 'ok', text: t('openWebinars.admin.retried', { n: retried }) });
      await load();
    } catch (failure) {
      setNote({ kind: 'error', text: failure instanceof Error ? failure.message : t('openWebinars.error.generic') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-overview>
      <CardHeader>
        <CardTitle>{t('openWebinars.admin.overview.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('openWebinars.admin.overview.help')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {failed && <p role="alert" className="text-sm text-muted-foreground">{t('openWebinars.admin.overview.loadFailed')}</p>}
        {!failed && !overview && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('openWebinars.loading')}</p>}
        {overview && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={retryAll} disabled={busy || overview.failed_total === 0}>
                {busy ? t('openWebinars.admin.retrying') : t('openWebinars.admin.retryAll')}
              </Button>
              <span data-failed-total className="text-sm text-muted-foreground">
                {overview.failed_total > 0 ? t('openWebinars.admin.overview.failedTotal', { n: overview.failed_total }) : t('openWebinars.admin.overview.noFailed')}
              </span>
              {note && <span role={note.kind === 'error' ? 'alert' : 'status'} className={note.kind === 'error' ? 'text-sm text-red-600 dark:text-red-400' : 'text-sm text-green-700 dark:text-green-400'}>{note.text}</span>}
            </div>

            {overview.items.length === 0 ? <p className="text-sm text-muted-foreground">{t('openWebinars.admin.overview.empty')}</p> : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>{(['title', 'date', 'mode', 'registered', 'failed'] as const).map((c) => <th key={c} className="px-3 py-2.5 font-medium">{t(`openWebinars.admin.overview.col.${c}` as 'openWebinars.admin.overview.col.title')}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overview.items.map((w) => (
                      <tr key={w.event_id} data-event={w.event_id} onClick={() => navigate(`/admin/open-webinars/${w.event_id}`)} className="cursor-pointer hover:bg-muted/50">
                        <td className="px-3 py-2.5 font-medium">
                          <Link to={`/admin/open-webinars/${w.event_id}`} onClick={(e) => e.stopPropagation()} className="text-primary underline-offset-4 hover:underline">{w.title}</Link>
                          {!w.is_active && <span className="ml-2 text-xs font-normal text-muted-foreground">{t('openWebinars.admin.overview.cancelled')}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">{formatDateTime(w.start_datetime, undefined, locale)}</td>
                        <td className="px-3 py-2.5">{t(`openWebinars.admin.access.${w.access_mode}` as 'openWebinars.admin.access.open')}</td>
                        <td className="px-3 py-2.5 tabular-nums">{w.registered}</td>
                        <td className={`px-3 py-2.5 tabular-nums ${w.leads_failed > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{w.leads_failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
