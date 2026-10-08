import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import ConfirmDialog from '../../components/ConfirmDialog';
import { toast } from '../../components/Toast';
import AccessReviewRowView from '../../components/offboarding/AccessReviewRowView';
import { useOffboardLauncher } from '../../components/offboarding/useOffboardLauncher';
import { useAuth } from '../../contexts/AuthContext';
import { useOffboardingConfig } from '../../hooks/useOffboardingConfig';
import { POLL_MS, filterRows, uncheckedSources, type RowFilter } from '../../lib/accessReview';
import {
  clearContactDetails,
  getAccessReview,
  getAccessReviewHistory,
  runAccessReview,
  type AccessReview,
  type AccessReviewPage as ReviewData,
  type AccessReviewRow,
} from '../../services/api/accessReview';
import { formatDate, formatDateTime } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

const FILTERS: readonly RowFilter[] = ['open', 'kept', 'done', 'all'];

/**
 * Access review (SPEC §10, API.md §9): every account in the LMS, CRM, Support, IELTS, SAT,
 * Zitadel and Workspace that belongs to no active staff member, each kept with a reason or
 * offboarded; staff without a Workspace account; former staff whose contact details outlived
 * three years. The server builds it monthly or on «Run now»; this page shows and decides.
 */
export default function AccessReviewPage() {
  const t = useT();
  const { user } = useAuth();
  const config = useOffboardingConfig(user?.role);
  // `undefined` while loading; `null` when the endpoint is not there (not deployed, or switched off).
  const [data, setData] = useState<ReviewData | null | undefined>(undefined);
  const [history, setHistory] = useState<AccessReview[]>([]);
  const [reviewId, setReviewId] = useState<number | undefined>(undefined);
  const [filter, setFilter] = useState<RowFilter>('open');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState<AccessReviewRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getAccessReview(reviewId);
      setData(page);
      if (page) setHistory(await getAccessReviewHistory().catch(() => []));
    } catch (e) {
      setError((e instanceof Error && e.message) || t('offboarding.review.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [reviewId, t]);
  const launcher = useOffboardLauncher(undefined, () => load());

  useEffect(() => {
    if (config?.enabled) load();
  }, [config?.enabled, load]);

  // A review being built has no rows yet: ask again until it is ready.
  const building = data?.review?.status === 'building';
  useEffect(() => {
    if (!building) return;
    const timer = window.setTimeout(load, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [building, data, load]);

  const run = async () => {
    try {
      await runAccessReview();
      toast(t('offboarding.review.runStarted'), 'success');
      setReviewId(undefined);
      load();
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.review.actionFailed'), 'error');
    }
  };

  const replaceRow = (row: AccessReviewRow) =>
    setData((current) => (current ? { ...current, rows: current.rows.map((r) => (r.id === row.id ? row : r)) } : current));

  const clear = async () => {
    const row = clearing;
    setClearing(null);
    if (!row) return;
    try {
      replaceRow(await clearContactDetails(row.id));
      toast(t('offboarding.review.cleared'), 'success');
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.review.actionFailed'), 'error');
    }
  };

  if (config && !config.enabled) {
    return <p className="p-6 text-sm text-muted-foreground">{t('offboarding.page.disabled')}</p>;
  }

  const review = data?.review ?? null;
  const rows = filterRows(data?.rows ?? [], filter);
  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <Button variant="ghost" asChild className="-ml-2 w-fit pl-0 text-muted-foreground">
        <Link to="/admin/offboarding"><ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />{t('offboarding.record.back')}</Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            {t('offboarding.review.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('offboarding.review.subtitle')}</p>
        </div>
        {data !== null && (
          <div className="flex flex-wrap gap-2">
            {history.length > 1 && (
              <Select value={String(reviewId ?? review?.id ?? '')} onValueChange={(v) => setReviewId(Number(v))}>
                <SelectTrigger className="w-72" aria-label={t('offboarding.review.history')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {history.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {h.period} · {t(`offboarding.review.kind.${h.kind}`)} · {formatDate(h.started_at)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('offboarding.page.refresh')}
            </Button>
            <Button onClick={run} disabled={building}>
              <Play className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('offboarding.review.run')}
            </Button>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {data === null && <p className="text-sm text-muted-foreground">{t('offboarding.review.notReady')}</p>}
      {data && !review && <p className="text-sm text-muted-foreground">{t('offboarding.review.none')}</p>}

      {review && (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            {t('offboarding.review.header', {
              period: review.period,
              kind: t(`offboarding.review.kind.${review.kind}`),
              date: formatDateTime(review.finished_at ?? review.started_at),
            })}
            {review.status === 'ready' && <> · {t('offboarding.review.counts', review.counts)}</>}
          </p>
          {building && <p className="text-foreground">{t('offboarding.review.building')}</p>}
          {review.status === 'failed' && <p role="alert" className="text-destructive">{t('offboarding.review.failed', { error: review.error ?? '—' })}</p>}
          {uncheckedSources(review).map(({ system, source }) => (
            <p key={system} className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {source.error || t('offboarding.review.notChecked', { system: t(`offboarding.review.systemName.${system}`) })}
            </p>
          ))}
          {review.sources?.workspace?.uploaded_at && (
            <p className="text-xs text-muted-foreground">{t('offboarding.review.workspaceUploaded', { date: formatDate(review.sources.workspace.uploaded_at) })}</p>
          )}
        </div>
      )}

      {review?.status === 'ready' && (
        <>
          <div role="tablist" className="inline-flex gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={tabClass(filter === f)} onClick={() => setFilter(f)}>
                {t(`offboarding.review.filter.${f}`)}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('offboarding.review.empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('offboarding.review.system')}</TableHead>
                    <TableHead>{t('offboarding.review.account')}</TableHead>
                    <TableHead>{t('offboarding.review.why')}</TableHead>
                    <TableHead>{t('offboarding.review.decision')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <AccessReviewRowView
                      key={row.id}
                      row={row}
                      onChanged={replaceRow}
                      onOffboard={launcher.openTarget}
                      onClearContacts={setClearing}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {launcher.dialog}
      <ConfirmDialog
        open={clearing !== null}
        description={clearing ? t('offboarding.review.clearQuestion', { name: clearing.person?.name || clearing.account.name || clearing.account.key }) : undefined}
        confirmText={t('offboarding.review.clearContacts')}
        onConfirm={clear}
        onCancel={() => setClearing(null)}
      />
    </div>
  );
}
