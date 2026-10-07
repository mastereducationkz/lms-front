/** Groups by average achievements per student with their top earners, the school's top earners
 *  (staff-only ranking, S4) and the share totals when the share feature is deployed. */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { AnalyticsGroup, AnalyticsPerson, ShareStats } from '@/services/api/achievementsAnalytics';
import { filterGroups } from '@/lib/achievementsAnalytics';
import { useT } from '@/lib/i18n/react';
import { Empty, OrcaStack, PersonRow, StatCard } from './parts';

export function GroupsTable({ groups, onPick }: { groups: AnalyticsGroup[]; onPick?: (id: number) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterGroups(groups, query), [groups, query]);
  const best = groups.reduce((m, g) => Math.max(m, g.avg_achievements), 0) || 1;
  return (
    <div>
      {groups.length > 8 && (
        <label className="mb-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('achievements.analytics.findGroup')}
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
      )}
      {!shown.length ? (
        <Empty>{t('achievements.analytics.noGroups')}</Empty>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {shown.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={onPick ? () => onPick(g.id) : undefined}
              className={`flex w-full items-center gap-3 py-2.5 text-left ${onPick ? 'hover:bg-muted dark:hover:bg-secondary/40 rounded-lg px-1' : 'cursor-default'}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 w-28 rounded-full bg-muted dark:bg-secondary">
                    <div className="h-1.5 rounded-full bg-brand-solid" style={{ width: `${Math.round((g.avg_achievements / best) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t('achievements.analytics.groupStats', { avg: g.avg_achievements, students: g.students })}
                  </span>
                </div>
              </div>
              <OrcaStack people={g.top} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopEarners({ people }: { people: AnalyticsPerson[] }) {
  const t = useT();
  if (!people.length) return <Empty>{t('achievements.nobodyYet')}</Empty>;
  return (
    <div className="divide-y divide-border">
      {people.map((p, i) => (
        <PersonRow key={p.id} person={p} rank={i + 1} sub={(p.groups || []).join(', ')} />
      ))}
    </div>
  );
}

export function ShareTotals({ stats }: { stats: ShareStats }) {
  const t = useT();
  const m = stats.totals.by_method || {};
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label={t('achievements.analytics.shares')} value={stats.totals.shares} />
      <StatCard label={t('achievements.analytics.shareSheet')} value={m.native ?? 0} />
      <StatCard label={t('achievements.analytics.savedImage')} value={m.download ?? 0} />
    </div>
  );
}
