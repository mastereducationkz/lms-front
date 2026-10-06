/**
 * A group's achievements for its teacher and curator (owner, 2026-10-04, S2b) — under the
 * leaderboard, which curators open at /curator/leaderboard and teachers at /attendance. The same
 * endpoint as the admin page, scoped to one group (the server checks it's theirs).
 */
import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Trophy } from 'lucide-react';
import { getAchievementsAnalytics, type AchievementsAnalytics } from '@/services/api/achievementsAnalytics';
import { formatPct, highlights, tr, type Lang } from '@/lib/achievementsAnalytics';
import RarityTable from './RarityTable';
import StarsByStaff from './StarsByStaff';
import { Empty, PersonRow, StatCard } from './parts';

const OPEN_KEY = 'group-achievements-open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

export default function GroupAchievementsPanel({ groupId, lang }: { groupId: number; lang: Lang }) {
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
          <span className="font-semibold text-foreground">{tr(lang, 'Достижения группы', 'Group achievements')}</span>
          {data && <span className="text-xs text-muted-foreground">· {data.summary.unlocks} {tr(lang, 'всего', 'earned')}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-border px-5 py-4">
          {failed ? (
            <Empty>{tr(lang, 'Не удалось загрузить достижения группы', 'Could not load the group achievements')}</Empty>
          ) : !data ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
                <StatCard label={tr(lang, 'Есть хотя бы одно', 'Earned at least one')} value={formatPct(data.summary.students_with_any_pct)}
                  hint={`${data.summary.students_with_any}/${data.summary.active_students} ${tr(lang, 'уч.', 'students')}`} accent="text-brand" />
                <StatCard label={tr(lang, 'В среднем на ученика', 'Average per student')} value={data.summary.avg_per_student}
                  hint={`${tr(lang, 'из', 'of')} ${data.summary.achievements_total}`} />
                <StatCard label={tr(lang, 'За 7 дней', 'Last 7 days')} value={data.summary.last_7_days}
                  hint={`${data.summary.last_30_days} ${tr(lang, 'за 30 дней', 'in 30 days')}`} />
                <StatCard label={tr(lang, 'В серии сейчас', 'On a streak now')} value={data.streaks.students_on_a_streak}
                  hint={`${tr(lang, 'рекорд', 'record')} ${data.streaks.best_longest} ${tr(lang, 'дн.', 'days')}`} accent="text-orange-600 dark:text-orange-400" />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{tr(lang, 'Больше всего достижений', 'Most achievements')}</p>
                  {top.length ? (
                    <div className="divide-y divide-border dark:divide-border">
                      {top.map((p, i) => <PersonRow key={p.id} person={p} rank={i + 1} lang={lang} />)}
                    </div>
                  ) : <Empty>{tr(lang, 'Пока никто ничего не получил', 'Nobody has earned anything yet')}</Empty>}
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{tr(lang, 'Самые редкие в группе', 'Rarest in this group')}</p>
                  {picks && picks.rarest.length ? picks.rarest.map((a) => (
                    <p key={a.key} className="flex justify-between py-1.5 text-sm">
                      <span className="text-foreground">{a.title}</span>
                      <span className="tabular-nums text-muted-foreground">{a.unlocked} · {formatPct(a.pct)}</span>
                    </p>
                  )) : <Empty>{tr(lang, 'Пока пусто', 'Nothing yet')}</Empty>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{tr(lang, 'Звезда недели', 'Star of the Week')}</p>
                <StarsByStaff stars={data.stars} lang={lang} />
              </div>
              <div>
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-medium text-brand hover:underline">
                  {showAll ? tr(lang, 'Скрыть все достижения', 'Hide every achievement') : tr(lang, 'Показать все достижения', 'Show every achievement')}
                </button>
                {showAll && <div className="mt-3"><RarityTable items={data.achievements} lang={lang} /></div>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
