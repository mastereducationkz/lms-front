import { useEffect, useState } from 'react';
import { Download, Loader2, RotateCw, Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { NativeSelect } from '../../ui/native-select';
import { toast } from '../../Toast';
import { cn } from '../../../lib/utils';
import { useLocale, useT } from '../../../lib/i18n/react';
import { formatDateTime } from '../../../lib/i18n/format';
import {
  downloadSignupsXlsx, listSignups, retrySignupLead, type SignupFilters, type SignupOutcome, type SignupRow, type TrialLinkRow,
} from '../../../services/api/trialLinks';
import { downloadBlob } from '../qr';
import { FilterBar, type StatFilters } from './OverviewTab';
import { OUTCOME_TONE, gradeLabel, interestLabel, leadLabel, outcomeLabel } from './labels';
import '@/lib/i18n/catalogs/trialLinks';

const OUTCOMES: SignupOutcome[] = ['created', 'existing_account', 'already_student', 'phone_registered'];
const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;

export default function SignupsTab({ links }: { links: TrialLinkRow[] }) {
  const t = useT();
  const locale = useLocale();
  const [stat, setStat] = useState<StatFilters>({ linkId: '', from: '', to: '' });
  const [outcome, setOutcome] = useState('');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: SignupRow[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => { setQ(query.trim()); setPage(1); }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  const filters: SignupFilters = {
    link_id: stat.linkId ? Number(stat.linkId) : undefined, date_from: stat.from || undefined, date_to: stat.to || undefined,
    outcome: (outcome || undefined) as SignupOutcome | undefined, q: q || undefined,
  };
  const key = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    listSignups(JSON.parse(key) as SignupFilters, page, PAGE_SIZE)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [key, page, reload]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      downloadBlob(await downloadSignupsXlsx(filters), `trial-signups-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast(t('trialLinks.admin.exportFailed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const retry = async (row: SignupRow) => {
    try {
      await retrySignupLead(row.id);
      setReload((n) => n + 1);
    } catch {
      toast(t('trialLinks.admin.saveFailed'), 'error');
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterBar links={links} value={stat} onChange={(next) => { setStat(next); setPage(1); }} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48 space-y-1">
            <Label className="text-xs">{t('trialLinks.admin.col.outcome')}</Label>
            <NativeSelect value={outcome} onValueChange={(v) => { setOutcome(v); setPage(1); }}>
              <option value="">{t('trialLinks.admin.allOutcomes')}</option>
              {OUTCOMES.map((o) => <option key={o} value={o}>{outcomeLabel(t, o)}</option>)}
            </NativeSelect>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('trialLinks.admin.search')} className="w-64 pl-9" />
          </div>
          <Button variant="outline" onClick={exportXlsx} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
            {t('trialLinks.admin.export')}
          </Button>
        </div>
      </div>

      {failed && <p className="text-sm text-red-600 dark:text-red-400">{t('trialLinks.admin.loadFailed')}</p>}
      {data && (
        <p className="text-xs text-muted-foreground">{t('trialLinks.admin.total', { count: data.total })}</p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              {(['date', 'name', 'contacts', 'school', 'grade', 'interests', 'outcome', 'progress', 'amo'] as const).map((c) => (
                <th key={c} className="px-3 py-2.5 text-left font-medium first:pl-4">{t(`trialLinks.admin.col.${c}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && !failed && (
              <tr><td colSpan={9} className="px-4 py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden /></td></tr>
            )}
            {data?.items.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-muted-foreground">{t('trialLinks.admin.empty')}</td></tr>
            )}
            {data?.items.map((r) => (
              <tr key={r.id} className="border-b border-border/60 align-top last:border-0">
                <td className="whitespace-nowrap py-2.5 pl-4 pr-3 text-xs text-muted-foreground">{formatDateTime(r.created_at, undefined, locale)}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{r.last_name} {r.first_name}</td>
                <td className="px-3 py-2.5">
                  <div className="text-foreground">{r.phone}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                  {r.parent_phone && <div className="text-xs text-muted-foreground">{t('trialLinks.admin.parent', { phone: r.parent_phone })}</div>}
                </td>
                <td className="max-w-[14rem] px-3 py-2.5">
                  <div className="text-foreground">{r.school ?? '—'}</div>
                  {r.school_pending && <div className="text-xs text-amber-700 dark:text-amber-400">{t('trialLinks.admin.pendingSchool')}</div>}
                  {r.presenter && <div className="text-xs text-muted-foreground">{t('trialLinks.present.by', { name: r.presenter })}</div>}
                </td>
                <td className="px-3 py-2.5">{gradeLabel(t, r.grade)}</td>
                <td className="px-3 py-2.5 text-xs">{r.interests.map((i) => interestLabel(t, i)).join(', ')}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', OUTCOME_TONE[r.outcome])}>
                    {outcomeLabel(t, r.outcome)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {r.got_trial ? (
                    <>
                      <div className={r.started ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>
                        {t(r.started ? 'trialLinks.admin.progress.started' : 'trialLinks.admin.progress.notStarted')}
                      </div>
                      {r.converted && <div className="font-semibold text-violet-700 dark:text-violet-400">{t('trialLinks.admin.progress.converted')}</div>}
                    </>
                  ) : '—'}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <span className={r.lead_state === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'} title={r.lead_error ?? undefined}>
                    {leadLabel(t, r.lead_state)}
                  </span>
                  {r.lead_state === 'failed' && (
                    <Button variant="ghost" size="sm" className="ml-1 h-6 px-1.5" onClick={() => retry(r)}>
                      <RotateCw className="mr-1 h-3 w-3" aria-hidden />{t('trialLinks.admin.lead.retry')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('trialLinks.admin.prev')}</Button>
          <span className="tabular-nums text-muted-foreground">{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t('trialLinks.admin.next')}</Button>
        </div>
      )}
    </div>
  );
}
