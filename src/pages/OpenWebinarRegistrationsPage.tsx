import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import RecordingPanel from '../components/open-webinars/RecordingPanel';
import { getOpenAccess, listRegistrations, retryLead, type OpenAccess, type RegistrationRow } from '../services/api/openWebinars';
import { getEventDetails } from '../services/api/events';
import { LMS_ORIGIN } from '../lib/lessonLinks';
import { formatDateTime } from '../lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

type Tile = { key: 'registered' | 'joined' | 'callbacks' | 'sent' | 'waiting' | 'failed' | 'students'; value: number };

/** One open webinar's funnel and everyone who left their details, with the delivery state of each lead. */
export default function OpenWebinarRegistrationsPage() {
  const { eventId = '' } = useParams();
  const id = Number(eventId);
  const t = useT();
  const locale = useLocale();
  const [title, setTitle] = useState('');
  const [access, setAccess] = useState<OpenAccess | null>(null);
  const [rows, setRows] = useState<RegistrationRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, r, e] = await Promise.all([getOpenAccess(id), listRegistrations(id), getEventDetails(id).catch(() => null)]);
      setAccess(a); setRows(r); setTitle(e?.title ?? '');
    } catch {
      setFailed(true);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const retry = async (row: RegistrationRow) => {
    setRetrying(row.id);
    try { await retryLead(row.id); await load(); } finally { setRetrying(null); }
  };

  if (failed) return <p className="p-6 text-sm text-muted-foreground">{t('openWebinars.admin.loadFailed')}</p>;
  if (!access || !rows) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('openWebinars.loading')}</p>;

  const f = access.funnel;
  const tiles: Tile[] = [
    { key: 'registered', value: f.registered }, { key: 'joined', value: f.joined }, { key: 'callbacks', value: f.consultation_requests },
    { key: 'sent', value: f.leads_sent }, { key: 'waiting', value: f.leads_pending }, { key: 'failed', value: f.leads_failed }, { key: 'students', value: f.existing_students },
  ];
  const publicUrl = access.slug ? `${LMS_ORIGIN}/w/${access.slug}` : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/admin/events/${id}/edit`} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" aria-hidden />{t('openWebinars.admin.regs.back')}</Link>
          <h1 className="text-xl font-bold sm:text-2xl">{t('openWebinars.admin.regs.title', { title })}</h1>
        </div>
        {publicUrl && <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"><ExternalLink className="h-4 w-4" aria-hidden />{t('openWebinars.admin.regs.page')}</a>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((tile) => (
          <Card key={tile.key} data-tile={tile.key}><CardContent className="p-4">
            <p className="text-2xl font-bold tabular-nums">{tile.value}</p>
            <p className="text-xs text-muted-foreground">{t(`openWebinars.admin.regs.funnel.${tile.key}` as 'openWebinars.admin.regs.funnel.sent')}</p>
          </CardContent></Card>
        ))}
      </div>

      <RecordingPanel eventId={id} slug={access.slug} />

      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('openWebinars.admin.regs.empty')}</p> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{(['name', 'contact', 'kind', 'when', 'joined', 'lead'] as const).map((c) => <th key={c} className="px-3 py-2.5 font-medium">{t(`openWebinars.admin.regs.col.${c}` as 'openWebinars.admin.regs.col.name')}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} data-row={r.id}>
                  <td className="px-3 py-2.5 font-medium">{r.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.phone}{r.email && <><br />{r.email}</>}</td>
                  <td className="px-3 py-2.5">{t(`openWebinars.admin.regs.kind.${r.kind}` as 'openWebinars.admin.regs.kind.registration')}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(r.registered_at, undefined, locale)}</td>
                  <td className="px-3 py-2.5">{r.joined ? '✓' : ''}</td>
                  <td className="px-3 py-2.5">
                    {r.lead_state === 'sent'
                      ? t(`openWebinars.admin.regs.lead.${r.lead_outcome === 'tagged_existing' ? 'tagged_existing' : 'created'}` as 'openWebinars.admin.regs.lead.created')
                      : t(`openWebinars.admin.regs.lead.${r.lead_state}` as 'openWebinars.admin.regs.lead.pending')}
                    {r.lead_state === 'failed' && (
                      <span className="ml-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => retry(r)} disabled={retrying === r.id}>{t('openWebinars.admin.regs.retry')}</Button>
                        {r.lead_error && <span className="mt-1 block max-w-xs text-xs text-red-600 dark:text-red-400">{r.lead_error}</span>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
