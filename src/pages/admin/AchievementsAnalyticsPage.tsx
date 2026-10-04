/**
 * «Достижения / Achievements» for admins and head roles (owner, 2026-10-04, S1–S4): how students
 * earn their Kasatik rewards across the school, or one group. Teachers and curators see their own
 * groups through the same endpoint (scoped on the server) in the leaderboard's group panel.
 */
import { useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAchievementsAnalytics, getShareStats, type AchievementsAnalytics, type ShareStats,
} from '@/services/api/achievementsAnalytics';
import { formatPct, highlights, langForRole, tr } from '@/lib/achievementsAnalytics';
import RarityTable from '@/components/achievements/analytics/RarityTable';
import { StreakHistogram, TrendChart } from '@/components/achievements/analytics/Charts';
import StarsByStaff from '@/components/achievements/analytics/StarsByStaff';
import { GroupsTable, ShareTotals, TopEarners } from '@/components/achievements/analytics/GroupsAndPeople';
import { Section, StatCard } from '@/components/achievements/analytics/parts';

const WEEK_OPTIONS = [8, 12, 26];

export default function AchievementsAnalyticsPage() {
  const { user } = useAuth();
  const lang = langForRole(user?.role);
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
      .catch(() => { if (alive) setError(tr(lang, 'Не удалось загрузить данные', 'Could not load the data')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [groupId, weeks, lang]);

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
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr(lang, 'Достижения', 'Achievements')}</h1>
            <p className="text-sm text-muted-foreground">
              {tr(lang, 'Как ученики зарабатывают награды для своего Касатика', 'How students earn rewards for their Kasatik')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={groupId ?? ''}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 max-w-[260px] rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-card px-3 text-sm"
            aria-label={tr(lang, 'Группа', 'Group')}
          >
            <option value="">{tr(lang, 'Все группы', 'All groups')}</option>
            {(data?.scope.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-200 dark:border-border p-0.5">
            {WEEK_OPTIONS.map((w) => (
              <button key={w} type="button" onClick={() => setWeeks(w)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${weeks === w ? 'bg-[#2563EB] text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                {w} {tr(lang, 'нед.', 'wk')}
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
            <StatCard label={tr(lang, 'Активные ученики', 'Active students')} value={s.active_students} />
            <StatCard label={tr(lang, 'Есть хотя бы одно', 'Earned at least one')} value={formatPct(s.students_with_any_pct)}
              hint={`${s.students_with_any} ${tr(lang, 'учеников', 'students')}`} accent="text-[#2563EB]" />
            <StatCard label={tr(lang, 'В среднем на ученика', 'Average per student')} value={s.avg_per_student}
              hint={`${tr(lang, 'из', 'of')} ${s.achievements_total}`} />
            <StatCard label={tr(lang, 'Получено за 7 дней', 'Unlocked in 7 days')} value={s.last_7_days}
              hint={`${s.last_30_days} ${tr(lang, 'за 30 дней', 'in 30 days')}`} />
            <StatCard label={tr(lang, 'Звезда недели', 'Star of the Week')} value={formatPct(data.stars.coverage_this_week_pct)}
              hint={tr(lang, `групп отмечено на этой неделе (${data.stars.groups_this_week}/${data.stars.groups_total})`,
                `of groups got one this week (${data.stars.groups_this_week}/${data.stars.groups_total})`)}
              accent="text-amber-600 dark:text-amber-400" />
          </div>
          {s.retro_unlocks > 0 && (
            <p className="text-xs text-muted-foreground">
              {tr(lang,
                `${s.retro_unlocks} достижений выдано при запуске (за то, что уже было сделано) — они учтены в «Получили», но не в «7/30 дней» и не в графике.`,
                `${s.retro_unlocks} achievements were granted at launch for work already done — counted in "Earned by", not in the 7/30-day columns or the trend.`)}
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            <Section className="lg:col-span-2" title={tr(lang, 'Новые достижения по неделям', 'Unlocks per week')}
              subtitle={tr(lang, 'Скользящие 7-дневные окна до сегодня · без выдачи при запуске', 'Rolling 7-day windows ending today · launch grants excluded')}>
              <TrendChart trend={data.trend} lang={lang} />
            </Section>
            <Section title={tr(lang, 'Самые редкие и самые частые', 'Rarest and most common')}>
              {picks && picks.rarest.length ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{tr(lang, 'Редкие', 'Rarest held')}</p>
                    {picks.rarest.map((a) => <p key={a.key} className="flex justify-between"><span>{a.title}</span><span className="tabular-nums text-muted-foreground">{formatPct(a.pct)}</span></p>)}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{tr(lang, 'Частые', 'Most common')}</p>
                    {picks.commonest.map((a) => <p key={a.key} className="flex justify-between"><span>{a.title}</span><span className="tabular-nums text-muted-foreground">{formatPct(a.pct)}</span></p>)}
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">{tr(lang, 'Пока пусто', 'Nothing yet')}</p>}
            </Section>
          </div>

          <Section title={tr(lang, 'Все достижения — сначала редкие', 'Every achievement — rarest first')}
            subtitle={tr(lang, 'Доля активных учеников, у которых оно есть', 'Share of active students who hold it')}>
            <RarityTable items={data.achievements} lang={lang} />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={data.scope.kind === 'group' ? tr(lang, 'Группа', 'Group') : tr(lang, 'Группы', 'Groups')}
              subtitle={tr(lang, 'Среднее число достижений на ученика · лучшие трое', 'Average badges per student · top three')}>
              <GroupsTable groups={data.groups} lang={lang} onPick={data.scope.kind === 'school' ? setGroupId : undefined} />
            </Section>
            <Section title={tr(lang, 'Больше всего достижений', 'Most achievements')}
              subtitle={tr(lang, 'Видно только сотрудникам', 'Visible to staff only')}>
              <TopEarners people={data.top_earners} lang={lang} />
            </Section>
          </div>

          <Section title={tr(lang, 'Звезда недели — кто отмечает', 'Star of the Week — who gives it')}
            subtitle={tr(lang, `Последние ${data.stars.weeks.length} недель · всего ${data.stars.total}`, `Last ${data.stars.weeks.length} weeks · ${data.stars.total} in total`)}>
            <StarsByStaff stars={data.stars} lang={lang} />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={tr(lang, 'Серии учебных дней', 'Learning-day streaks')}
              subtitle={tr(lang,
                `Сейчас в серии ${data.streaks.students_on_a_streak} уч. · в среднем ${data.streaks.avg_current} дн. · рекорд ${data.streaks.best_longest}`,
                `${data.streaks.students_on_a_streak} on a streak now · avg ${data.streaks.avg_current} days · record ${data.streaks.best_longest}`)}>
              <StreakHistogram streaks={data.streaks} lang={lang} />
            </Section>
            {shares && (
              <Section title={tr(lang, 'Делятся достижениями', 'Achievement sharing')}
                subtitle={tr(lang, 'Сторис, скачивания, ссылки и их просмотры', 'Stories, downloads, links and their views')}>
                <ShareTotals stats={shares} lang={lang} />
              </Section>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
