/**
 * Student dashboard: the next achievement (with progress) and the latest unlock. Renders nothing
 * until the achievements answer arrives, or on any error — the dashboard never waits on it.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { achievementField, nextAchievement, recentlyUnlocked, TOTAL_LABEL } from '@/lib/achievements';
import { useLocale, useT } from '@/lib/i18n/react';
import { rewardLabel } from '@/components/mascot/config';
import { getMyAchievements, type MyAchievements } from '@/services/api/achievementsUi';
import { ProgressBar } from './AchievementCard';
import RewardPreview from './RewardPreview';
import TryOnButton from './TryOnButton';
import { tierStyle } from './tierStyle';
import '@/lib/i18n/catalogs/studentHome';

export function AchievementsTile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState<MyAchievements | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyAchievements()
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, []);

  if (!user || !data || data.achievements.length === 0) return null;
  const list = data.achievements;
  const next = nextAchievement(list);
  const latest = recentlyUnlocked(list, 1)[0];

  return (
    <Card className="mt-2">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden /> {t('studentHome.achievements.tileTitle', { progress: TOTAL_LABEL(list) })}
          </p>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => navigate('/achievements')}>
            {t('studentHome.achievements.seeAll')}
          </button>
        </div>
        <div className="mt-3 grid gap-4 @lg:grid-cols-2">
          {next && (
            <div className="flex flex-col items-start gap-1.5">
              <button
                type="button"
                onClick={() => navigate(`/achievements#${next.key}`)}
                className="flex self-stretch items-center gap-3 rounded-xl text-left hover:bg-muted/40 p-1 -m-1"
              >
                <RewardPreview code={user.mascot} userId={user.id} reward={next.rewards[0]} size={48} locked />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">{t('studentHome.achievements.nextUp')}</span>
                  <span className="block truncate font-medium">{achievementField(next, 'title', locale)}</span>
                  {next.progress && next.progress.target > 0 ? (
                    <span className="mt-1 block">
                      <ProgressBar current={next.progress.current} target={next.progress.target} barClass={tierStyle(next.tier).bar} />
                    </span>
                  ) : (
                    <span className="block truncate text-xs text-muted-foreground">{achievementField(next, 'how_to', locale)}</span>
                  )}
                </span>
              </button>
              {!next.secret && next.rewards.length > 0 && <TryOnButton rewards={next.rewards} className="ml-[60px]" />}
            </div>
          )}
          {latest && (
            <button
              type="button"
              onClick={() => navigate(`/achievements#${latest.key}`)}
              className="flex items-center gap-3 rounded-xl text-left hover:bg-muted/40 p-1 -m-1"
            >
              <RewardPreview code={user.mascot} userId={user.id} reward={latest.rewards[0]} size={48} />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t('studentHome.achievements.latestUnlock')}</span>
                <span className="block truncate font-medium">{achievementField(latest, 'title', locale)}</span>
                <span className="block truncate text-xs text-emerald-700 dark:text-emerald-400">
                  {latest.rewards.map((r) => rewardLabel(r, locale)).join(' + ') || t('studentHome.achievements.unlocked')}
                </span>
              </span>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
