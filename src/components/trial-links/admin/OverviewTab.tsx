import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { NativeSelect } from '../../ui/native-select';
import { useLocale, useT } from '../../../lib/i18n/react';
import { formatDate, formatNumber } from '../../../lib/i18n/format';
import { getTrialStats, type FunnelBucket, type TrialLinkRow, type TrialStats } from '../../../services/api/trialLinks';
import { gradeLabel, interestLabel, pct } from './labels';
import '@/lib/i18n/catalogs/trialLinks';

export interface StatFilters { linkId: string; from: string; to: string }

export function FilterBar({ links, value, onChange }: { links: TrialLinkRow[]; value: StatFilters; onChange: (next: StatFilters) => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1">
        <Label className="text-xs">{t('trialLinks.present.link')}</Label>
        <NativeSelect value={value.linkId} onValueChange={(linkId) => onChange({ ...value, linkId })}>
          <option value="">{t('trialLinks.admin.allLinks')}</option>
          {links.map((l) => <option key={l.id} value={String(l.id)}>{l.title}</option>)}
        </NativeSelect>
      </div>
      <div className="w-40 space-y-1">
        <Label htmlFor="tl-from" className="text-xs">{t('trialLinks.admin.from')}</Label>
        <Input id="tl-from" type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-full" />
      </div>
      <div className="w-40 space-y-1">
        <Label htmlFor="tl-to" className="text-xs">{t('trialLinks.admin.to')}</Label>
        <Input id="tl-to" type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-full" />
      </div>
    </div>
  );
}

function Kpi({ label, value, previous, hint }: { label: string; value: number; previous?: number; hint?: string }) {
  const t = useT();
  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 shadow-sm" title={hint}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">{formatNumber(value)}</p>
      {previous !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">{t('trialLinks.admin.kpi.of', { pct: pct(value, previous) })}</p>
      )}
    </div>
  );
}

function BucketTable({ title, rows, first, firstLabel, withOpens }: {
  title: string; rows: (FunnelBucket & { opens?: number })[]; first: (i: number) => string; firstLabel: string; withOpens?: boolean;
}) {
  const t = useT();
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card shadow-sm">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t('trialLinks.admin.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">{firstLabel}</th>
                {withOpens && <th className="px-3 py-2 text-right font-medium">{t('trialLinks.admin.col.opens')}</th>}
                <th className="px-3 py-2 text-right font-medium">{t('trialLinks.admin.col.signups')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('trialLinks.admin.col.trials')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('trialLinks.admin.col.started')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('trialLinks.admin.col.converted')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[16rem] truncate px-4 py-2 text-foreground">{first(i)}</td>
                  {withOpens && <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.opens ?? 0}</td>}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.signups}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.trials}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.started}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.converted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Bars({ title, data, label }: { title: string; data: Record<string, number>; label: (k: string) => string }) {
  const t = useT();
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {entries.length === 0 ? <p className="text-sm text-muted-foreground">{t('trialLinks.admin.empty')}</p> : (
        <ul className="space-y-2">
          {entries.map(([k, v]) => (
            <li key={k} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-sm">
              <span className="truncate text-muted-foreground">{label(k)}</span>
              <span className="h-2.5 rounded-full bg-muted">
                <span className="block h-2.5 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
              </span>
              <span className="text-right font-medium tabular-nums">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function OverviewTab({ links }: { links: TrialLinkRow[] }) {
  const t = useT();
  const locale = useLocale();
  const [filters, setFilters] = useState<StatFilters>({ linkId: '', from: '', to: '' });
  const [stats, setStats] = useState<TrialStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    getTrialStats({ link_id: filters.linkId ? Number(filters.linkId) : undefined, date_from: filters.from || undefined, date_to: filters.to || undefined })
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [filters]);

  return (
    <div className="space-y-5">
      <FilterBar links={links} value={filters} onChange={setFilters} />
      {failed && <p className="text-sm text-red-600 dark:text-red-400">{t('trialLinks.admin.loadFailed')}</p>}
      {!stats && !failed && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-5">
            <Kpi label={t('trialLinks.admin.kpi.opens')} value={stats.opens} hint={t('trialLinks.admin.kpi.opensHint')} />
            <Kpi label={t('trialLinks.admin.kpi.signups')} value={stats.signups} previous={stats.opens} />
            <Kpi label={t('trialLinks.admin.kpi.trials')} value={stats.trials} previous={stats.signups} />
            <Kpi label={t('trialLinks.admin.kpi.started')} value={stats.started} previous={stats.trials} />
            <Kpi label={t('trialLinks.admin.kpi.converted')} value={stats.converted} previous={stats.trials} />
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground @4xl:flex">
            {[t('trialLinks.admin.kpi.opens'), t('trialLinks.admin.kpi.signups'), t('trialLinks.admin.kpi.trials'),
              t('trialLinks.admin.kpi.started'), t('trialLinks.admin.kpi.converted')].map((s, i, all) => (
              <span key={s} className="flex items-center gap-2">{s}{i < all.length - 1 && <ArrowRight className="h-3 w-3" aria-hidden />}</span>
            ))}
          </div>
          <div className="grid gap-4 @4xl:grid-cols-2">
            <BucketTable title={t('trialLinks.admin.bySchool')} firstLabel={t('trialLinks.admin.col.school')} rows={stats.by_school}
              first={(i) => stats.by_school[i].school_id ? stats.by_school[i].school : t('trialLinks.admin.unknownSchool')} />
            <BucketTable title={t('trialLinks.admin.byPresenter')} firstLabel={t('trialLinks.admin.col.presenter')} rows={stats.by_presenter}
              first={(i) => stats.by_presenter[i].presenter ?? t('trialLinks.admin.noPresenter')} />
          </div>
          <div className="grid gap-4 @5xl:grid-cols-[2fr_1fr]">
            <BucketTable title={t('trialLinks.admin.byDay')} firstLabel={t('trialLinks.admin.col.day')} rows={[...stats.by_day].reverse()} withOpens
              first={(i) => formatDate([...stats.by_day].reverse()[i].day, undefined, locale)} />
            <div className="space-y-4">
              <Bars title={t('trialLinks.admin.byGrade')} data={stats.grades} label={(k) => gradeLabel(t, k)} />
              <Bars title={t('trialLinks.admin.byInterest')} data={stats.interests} label={(k) => interestLabel(t, k)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
