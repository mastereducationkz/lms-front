import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import RecordingPanel from '../components/open-webinars/RecordingPanel';
import { answersSummary } from '../components/open-webinars/profileQuestions';
import { getOpenAccess, listRegistrations, retryFailedLeads, retryLead, type OpenAccess, type RegistrationRow } from '../services/api/openWebinars';
import { getEventDetails } from '../services/api/events';
import { LMS_ORIGIN } from '../lib/lessonLinks';
import { formatDateTime } from '../lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

/** Rows per request: the list is read in pages of this size until one comes back shorter. */
const PAGE = 100;

type Tile = { key: 'registered' | 'joined' | 'callbacks' | 'sent' | 'waiting' | 'failed' | 'students'; value: number };
type LeadKey = 'created' | 'tagged_existing' | 'existing_client' | 'pending' | 'failed' | 'skipped_student';

/** Where a person's lead stands, as one of the plain-language labels: a lead that was sent says what the CRM did with it. */
function leadKey(row: RegistrationRow): LeadKey {
  if (row.lead_state === 'skipped_student') return 'skipped_student';
  if (row.lead_state !== 'sent') return row.lead_state;
  return row.lead_outcome === 'tagged_existing' || row.lead_outcome === 'existing_client' ? row.lead_outcome : 'created';
}

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
  const [retryingAll, setRetryingAll] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // How many pages are on screen, so a reload after a retry shows the same rows, not just the first page.
  const pages = useRef(1);

  /** `count` pages from the start, each of PAGE rows, until a page comes back shorter. */
  const fetchPages = useCallback(async (count: number) => {
    const all: RegistrationRow[] = [];
    let more = false;
    for (let page = 0; page < count; page++) {
      const batch = await listRegistrations(id, { limit: PAGE, offset: all.length });
      all.push(...batch);
      more = batch.length === PAGE;
      if (!more) break;
    }
    return { all, more };
  }, [id]);

  const load = useCallback(async () => {
    try {
      const [a, r, e] = await Promise.all([getOpenAccess(id), fetchPages(pages.current), getEventDetails(id).catch(() => null)]);
      setAccess(a); setRows(r.all); setHasMore(r.more); setTitle(e?.title ?? '');
    } catch {
      setFailed(true);
    }
  }, [id, fetchPages]);
  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const batch = await listRegistrations(id, { limit: PAGE, offset: rows?.length ?? 0 });
      pages.current += 1;
      setRows((now) => [...(now ?? []), ...batch]);
      setHasMore(batch.length === PAGE);
    } catch {
      setNote(t('openWebinars.admin.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  };

  const retry = async (row: RegistrationRow) => {
    setRetrying(row.id);
    try { await retryLead(row.id); await load(); } finally { setRetrying(null); }
  };

  const retryAll = async () => {
    setRetryingAll(true);
    setNote(null);
    try {
      const { retried } = await retryFailedLeads(id);
      setNote(t('openWebinars.admin.retried', { n: retried }));
      await load();
    } catch (failure) {
      setNote(failure instanceof Error ? failure.message : t('openWebinars.error.generic'));
    } finally {
      setRetryingAll(false);
    }
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

      {(f.leads_failed > 0 || note) && (
        <div className="flex flex-wrap items-center gap-3">
          {f.leads_failed > 0 && <Button type="button" variant="outline" size="sm" onClick={retryAll} disabled={retryingAll}>{retryingAll ? t('openWebinars.admin.retrying') : t('openWebinars.admin.retryAll')}</Button>}
          {note && <span role="status" data-note className="text-sm text-muted-foreground">{note}</span>}
        </div>
      )}

      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('openWebinars.admin.regs.empty')}</p> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{(['name', 'contact', 'kind', 'when', 'joined', 'lead'] as const).map((c) => <th key={c} className="px-3 py-2.5 font-medium">{t(`openWebinars.admin.regs.col.${c}` as 'openWebinars.admin.regs.col.name')}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} data-row={r.id}>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{r.name}</span>
                    {r.answers && <span data-answers className="mt-0.5 block text-xs text-muted-foreground">{answersSummary(r.answers, t).join(' · ')}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.phone}{r.email && <><br />{r.email}</>}</td>
                  <td className="px-3 py-2.5">{t(`openWebinars.admin.regs.kind.${r.kind}` as 'openWebinars.admin.regs.kind.registration')}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(r.registered_at, undefined, locale)}</td>
                  <td className="px-3 py-2.5">{r.joined ? '✓' : ''}</td>
                  <td className="px-3 py-2.5">
                    {t(`openWebinars.admin.regs.lead.${leadKey(r)}` as 'openWebinars.admin.regs.lead.created')}
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
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span data-shown>{t('openWebinars.admin.regs.shown', { n: rows.length })}</span>
          {hasMore && <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>{loadingMore ? t('openWebinars.loading') : t('openWebinars.admin.regs.loadMore')}</Button>}
        </div>
      )}
    </div>
  );
}
