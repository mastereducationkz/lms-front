/**
 * «Достижения / Achievements» for admins and head roles (owner, 2026-10-04, S1–S4): how students
 * earn their Kasatik rewards across the school, or one group. Teachers and curators see their own
 * groups through the same endpoint (scoped on the server) in the leaderboard's group panel.
 */
import { useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import {
  getAchievementsAnalytics, getShareStats, type AchievementsAnalytics, type ShareStats,
} from '@/services/api/achievementsAnalytics';
import { formatPct, highlights } from '@/lib/achievementsAnalytics';
import { useT } from '@/lib/i18n/react';
import RarityTable from '@/components/achievements/analytics/RarityTable';
import { StreakHistogram, TrendChart } from '@/components/achievements/analytics/Charts';
import StarsByStaff from '@/components/achievements/analytics/StarsByStaff';
import { GroupsTable, ShareTotals, TopEarners } from '@/components/achievements/analytics/GroupsAndPeople';
import { Section, StatCard } from '@/components/achievements/analytics/parts';

const WEEK_OPTIONS = [8, 12, 26];

export default function AchievementsAnalyticsPage() {
  const t = useT();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState(12);
  const [data, setData] = useState<AchievementsAnalytics | null>(null);
  const [shares, setShares] = useState<ShareStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getAchievementsAnalytics({ groupId, weeks })
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(t('achievements.analytics.loadFailed')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [groupId, weeks, t]);

  useEffect(() => {
    let alive = true;
    getShareStats().then((s) => { if (alive) setShares(s); });
    return () => { alive = false; };
  }, []);

  const s = data?.summary;
  const picks = data ? highlights(data.achievements, 3) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-solid text-brand-solid-foreground shadow-sm">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('achievements.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('achievements.analytics.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={groupId ?? ''}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 max-w-[260px] rounded-lg border border-border dark:border-border bg-card dark:bg-card px-3 text-sm"
            aria-label={t('achievements.analytics.group')}
          >
            <option value="">{t('achievements.analytics.allGroups')}</option>
            {(data?.scope.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-border dark:border-border p-0.5">
            {WEEK_OPTIONS.map((w) => (
              <button key={w} type="button" onClick={() => setWeeks(w)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${weeks === w ? 'bg-brand-solid text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                {t('achievements.analytics.weeksOption', { weeks: w })}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {loading && !data ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data && s ? (
        <>
          <div className={`grid grid-cols-2 gap-3 lg:grid-cols-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <StatCard label={t('achievements.analytics.activeStudents')} value={s.active_students} />
            <StatCard label={t('achievements.earnedAny')} value={formatPct(s.students_with_any_pct)}
              hint={t('achievements.analytics.students', { count: s.students_with_any })} accent="text-brand" />
            <StatCard label={t('achievements.avgPerStudent')} value={s.avg_per_student}
              hint={t('achievements.outOf', { total: s.achievements_total })} />
            <StatCard label={t('achievements.analytics.unlocked7Days')} value={s.last_7_days}
              hint={t('achievements.in30Days', { count: s.last_30_days })} />
            <StatCard label={t('achievements.star.title')} value={formatPct(data.stars.coverage_this_week_pct)}
              hint={t('achievements.analytics.starCoverage', { given: data.stars.groups_this_week, total: data.stars.groups_total })}
              accent="text-amber-600 dark:text-amber-400" />
          </div>
          {s.retro_unlocks > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('achievements.analytics.retroNote', { count: s.retro_unlocks })}
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            <Section className="lg:col-span-2" title={t('achievements.analytics.trendTitle')}
              subtitle={t('achievements.analytics.trendSubtitle')}>
              <TrendChart trend={data.trend} />
            </Section>
            <Section title={t('achievements.analytics.rarestAndCommonest')}>
              {picks && picks.rarest.length ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{t('achievements.analytics.rarestHeld')}</p>
                    {picks.rarest.map((a) => <p key={a.key} className="flex justify-between"><span>{a.title}</span><span className="tabular-nums text-muted-foreground">{formatPct(a.pct)}</span></p>)}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{t('achievements.analytics.commonest')}</p>
                    {picks.commonest.map((a) => <p key={a.key} className="flex justify-between"><span>{a.title}</span><span className="tabular-nums text-muted-foreground">{formatPct(a.pct)}</span></p>)}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">{t('achievements.nothingYet')}</p>}
            </Section>
          </div>

          <Section title={t('achievements.analytics.everyTitle')}
            subtitle={t('achievements.analytics.everySubtitle')}>
            <RarityTable items={data.achievements} />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={data.scope.kind === 'group' ? t('achievements.analytics.group') : t('achievements.analytics.groups')}
              subtitle={t('achievements.analytics.groupsSubtitle')}>
              <GroupsTable groups={data.groups} onPick={data.scope.kind === 'school' ? setGroupId : undefined} />
            </Section>
            <Section title={t('achievements.mostAchievements')}
              subtitle={t('achievements.analytics.staffOnly')}>
              <TopEarners people={data.top_earners} />
            </Section>
          </div>

          <Section title={t('achievements.analytics.starsTitle')}
            subtitle={t('achievements.analytics.starsSubtitle', { weeks: data.stars.weeks.length, total: data.stars.total })}>
            <StarsByStaff stars={data.stars} />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={t('achievements.analytics.streaksTitle')}
              subtitle={t('achievements.analytics.streaksSubtitle', {
                onStreak: data.streaks.students_on_a_streak, avg: data.streaks.avg_current, best: data.streaks.best_longest,
              })}>
              <StreakHistogram streaks={data.streaks} />
            </Section>
            {shares && (
              <Section title={t('achievements.analytics.sharingTitle')}
                subtitle={t('achievements.analytics.sharingSubtitle')}>
                <ShareTotals stats={shares} />
              </Section>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
