/**
 * A group's achievements for its teacher and curator (owner, 2026-10-04, S2b) — under the
 * leaderboard, which curators open at /curator/leaderboard and teachers at /attendance. The same
 * endpoint as the admin page, scoped to one group (the server checks it's theirs).
 */
import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Trophy } from 'lucide-react';
import { getAchievementsAnalytics, type AchievementsAnalytics } from '@/services/api/achievementsAnalytics';
import { formatPct, highlights } from '@/lib/achievementsAnalytics';
import { useT } from '@/lib/i18n/react';
import RarityTable from './RarityTable';
import StarsByStaff from './StarsByStaff';
import { Empty, PersonRow, StatCard } from './parts';
import '@/lib/i18n/catalogs/achievements';

const OPEN_KEY = 'group-achievements-open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

export default function GroupAchievementsPanel({ groupId }: { groupId: number }) {
  const t = useT();
  const [open, setOpen] = useState(readOpen);
  const [data, setData] = useState<AchievementsAnalytics | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setFailed(false);
    getAchievementsAnalytics({ groupId })
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [groupId, open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* per-viewer convenience only */ }
  };

  const group = data?.groups[0];
  const top = group?.top.length ? group.top : (data?.top_earners ?? []).slice(0, 3);
  const picks = data ? highlights(data.achievements, 3) : null;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card dark:bg-card shadow-sm">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="font-semibold text-foreground">{t('achievements.group.title')}</span>
          {data && <span className="text-xs text-muted-foreground">· {t('achievements.group.earned', { count: data.summary.unlocks })}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-border px-5 py-4">
          {failed ? (
            <Empty>{t('achievements.group.loadFailed')}</Empty>
          ) : !data ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
                <StatCard label={t('achievements.earnedAny')} value={formatPct(data.summary.students_with_any_pct)}
                  hint={t('achievements.group.studentsRatio', { with: data.summary.students_with_any, total: data.summary.active_students })} accent="text-brand" />
                <StatCard label={t('achievements.avgPerStudent')} value={data.summary.avg_per_student}
                  hint={t('achievements.outOf', { total: data.summary.achievements_total })} />
                <StatCard label={t('achievements.group.last7Days')} value={data.summary.last_7_days}
                  hint={t('achievements.in30Days', { count: data.summary.last_30_days })} />
                <StatCard label={t('achievements.group.onStreak')} value={data.streaks.students_on_a_streak}
                  hint={t('achievements.group.record', { days: data.streaks.best_longest })} accent="text-orange-600 dark:text-orange-400" />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t('achievements.mostAchievements')}</p>
                  {top.length ? (
                    <div className="divide-y divide-border dark:divide-border">
                      {top.map((p, i) => <PersonRow key={p.id} person={p} rank={i + 1} />)}
                    </div>
                  ) : <Empty>{t('achievements.nobodyYet')}</Empty>}
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t('achievements.group.rarest')}</p>
                  {picks && picks.rarest.length ? picks.rarest.map((a) => (
                    <p key={a.key} className="flex justify-between py-1.5 text-sm">
                      <span className="text-foreground">{a.title}</span>
                      <span className="tabular-nums text-muted-foreground">{a.unlocked} · {formatPct(a.pct)}</span>
                    </p>
                  )) : <Empty>{t('achievements.nothingYet')}</Empty>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t('achievements.star.title')}</p>
                <StarsByStaff stars={data.stars} />
              </div>
              <div>
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-medium text-brand hover:underline">
                  {showAll ? t('achievements.group.hideAll') : t('achievements.group.showAll')}
                </button>
                {showAll && <div className="mt-3"><RarityTable items={data.achievements} /></div>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
