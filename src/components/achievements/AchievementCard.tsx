/** One achievement as a card: reward preview, tier, how to earn it, progress or unlock date. */
import { forwardRef } from 'react';
import { CheckCircle2, HelpCircle } from 'lucide-react';
import { achievementField, tierLabel } from '@/lib/achievements';
import { activeLocale, formatDate, type Locale } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import { rewardLabel } from '@/components/mascot/config';
import type { Achievement } from '@/services/api/achievementsUi';
import RewardPreview from './RewardPreview';
import TryOnButton from './TryOnButton';
import { ShareAchievementButton } from '@/components/share/ShareButtons';
import { tierStyle } from './tierStyle';
import '@/lib/i18n/catalogs/studentHome';

interface AchievementCardProps {
  achievement: Achievement;
  code: string | null | undefined;
  userId: number | string;
  highlighted?: boolean;
  /** Section-specific id prefix, so a card that appears twice keeps one deep-link anchor. */
  anchor?: boolean;
}

export function ProgressBar({ current, target, barClass }: { current: number; target: number; barClass: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={current}
      >
        <div className={`h-full rounded-full ${barClass} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {Math.min(current, target)} / {target}
      </span>
    </div>
  );
}

export const formatUnlockDate = (iso: string | null, locale: Locale = activeLocale()) =>
  iso ? formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' }, locale) : '';

const AchievementCard = forwardRef<HTMLDivElement, AchievementCardProps>(function AchievementCard(
  { achievement: a, code, userId, highlighted = false, anchor = true },
  ref,
) {
  const t = useT();
  const locale = useLocale();
  const style = tierStyle(a.tier);
  const hidden = a.secret && !a.unlocked;
  const hint = achievementField(a, 'hint', locale);
  const reward = a.rewards[0] ?? null;
  return (
    <div
      ref={ref}
      id={anchor ? a.key : undefined}
      className={`scroll-mt-24 flex gap-4 rounded-2xl border bg-card p-4 transition-shadow ${style.card} ${
        highlighted ? 'ring-2 ring-offset-2 ring-brand dark:ring-offset-background' : ''
      } ${a.unlocked ? '' : 'opacity-[0.97]'}`}
    >
      {hidden ? (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-gray-400 dark:text-muted-foreground">
          <HelpCircle className="h-7 w-7" aria-hidden />
        </span>
      ) : (
        <RewardPreview code={code} userId={userId} reward={reward} size={64} locked={!a.unlocked} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}>
            {tierLabel(a.tier, locale)}
          </span>
          {a.unlocked && a.count > 1 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              ×{a.count}
            </span>
          )}
        </div>
        <p className={`mt-1 font-semibold ${a.unlocked ? 'text-foreground' : 'text-gray-700 dark:text-foreground'}`}>
          {hidden ? '???' : achievementField(a, 'title', locale)}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {hidden ? (hint ? t('studentHome.achievements.secretHint', { hint }) : t('studentHome.achievements.secret')) : a.unlocked ? achievementField(a, 'description', locale) || achievementField(a, 'how_to', locale) : achievementField(a, 'how_to', locale) || achievementField(a, 'description', locale)}
        </p>
        {!hidden && reward && (
          <p className="mt-1 text-xs text-muted-foreground">
            {a.unlocked ? t('studentHome.achievements.reward') : t('studentHome.achievements.unlocks')}: <span className="font-medium text-gray-700 dark:text-foreground">{a.rewards.map((r) => rewardLabel(r, locale)).join(' + ')}</span>
          </p>
        )}
        {a.unlocked ? (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {t('studentHome.achievements.unlockedOn', { date: formatUnlockDate(a.unlocked_at, locale) })}
          </p>
        ) : (
          a.progress && a.progress.target > 0 && !hidden && (
            <div className="mt-2">
              <ProgressBar current={a.progress.current} target={a.progress.target} barClass={style.bar} />
            </div>
          )
        )}
        {!a.unlocked && !hidden && a.rewards.length > 0 && <TryOnButton rewards={a.rewards} className="mt-2" />}
        <ShareAchievementButton achievement={a} className="-ml-2.5 mt-1" />
      </div>
    </div>
  );
});

export default AchievementCard;
