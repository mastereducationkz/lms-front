/**
 * The golden moment (owner, 2026-10-13): the header of the unlock celebration when «1500 Club» or
 * «Perfect» lands, the two rarest Master League unlocks. Navy and gold like the welcome scene, slow
 * rays behind the orca wearing its new reward, a pulsing gold glow and a few twinkling sparks. CSS
 * only; every animation stops for people who ask the system for reduced motion. The modal around it
 * (the list, «Wear it now», share) is the usual one in UnlockCelebration.
 */
import type { ElementType } from 'react';
import RewardPreview from '@/components/achievements/RewardPreview';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { achievementField } from '@/lib/achievements';
import { rewardLabel } from '@/components/mascot/config';
import { useLocale, useT } from '@/lib/i18n/react';
import type { Achievement, AchievementReward } from '@/services/api/achievementsUi';
import '@/lib/i18n/catalogs/studentHome';

/** Gold for the confetti: the League palette, no pink, no green. */
export const GOLDEN_CONFETTI = ['#F7C948', '#FFE07A', '#FFFFFF', '#E2A300', '#5B8DFF'];

export const MILESTONE_CSS = `
.ml-gold-rays{position:absolute;left:50%;top:40%;width:190%;aspect-ratio:1;transform:translate(-50%,-50%);
  background:repeating-conic-gradient(from 0deg,rgba(247,201,72,.26) 0 5deg,transparent 5deg 15deg);
  -webkit-mask-image:radial-gradient(circle,#000 0,transparent 62%);mask-image:radial-gradient(circle,#000 0,transparent 62%);
  animation:ml-gold-spin 48s linear infinite}
@keyframes ml-gold-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes ml-gold-glow{0%,100%{box-shadow:0 0 0 0 rgba(247,201,72,0),0 0 24px 2px rgba(247,201,72,.4)}
  50%{box-shadow:0 0 0 6px rgba(247,201,72,.16),0 0 42px 8px rgba(247,201,72,.7)}}
.ml-gold-glow{animation:ml-gold-glow 3.2s ease-in-out infinite}
@keyframes ml-gold-twinkle{0%,100%{opacity:.25;transform:scale(.7)}50%{opacity:1;transform:scale(1.15)}}
.ml-gold-twinkle{animation:ml-gold-twinkle 2.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){
  .ml-gold-rays,.ml-gold-glow,.ml-gold-twinkle{animation:none}
  .ml-gold-twinkle{opacity:.85;transform:none}
}
`;

/** Where the sparks sit round the orca (percent of the header) and when each starts to twinkle. */
const SPARKS: { left: string; top: string; size: number; delay: string }[] = [
  { left: '16%', top: '22%', size: 14, delay: '0s' },
  { left: '82%', top: '18%', size: 18, delay: '0.7s' },
  { left: '10%', top: '56%', size: 10, delay: '1.4s' },
  { left: '90%', top: '52%', size: 12, delay: '0.3s' },
  { left: '28%', top: '10%', size: 9, delay: '1.9s' },
  { left: '72%', top: '8%', size: 9, delay: '1.1s' },
];

function Spark({ left, top, size, delay }: (typeof SPARKS)[number]) {
  return (
    <svg
      aria-hidden
      viewBox="-10 -10 20 20"
      width={size}
      height={size}
      className="ml-gold-twinkle absolute"
      style={{ left, top, animationDelay: delay }}
    >
      <path d="M0 -9 Q0 0 9 0 Q0 0 0 9 Q0 0 -9 0 Q0 0 0 -9 Z" fill="#FFE07A" />
    </svg>
  );
}

interface HeaderProps {
  code: string | null | undefined;
  userId: number | string;
  /** The golden unlock this header is for. */
  achievement: Achievement;
  reward?: AchievementReward | null;
  /** The dialog's own title/description parts; the static review render passes plain elements. */
  Title?: ElementType;
  Description?: ElementType;
}

export default function LeagueMilestoneHeader({ code, userId, achievement, reward, Title = DialogTitle, Description = DialogDescription }: HeaderProps) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <style>{MILESTONE_CSS}</style>
      <div className="relative isolate overflow-hidden bg-[linear-gradient(160deg,#07122E_0%,#0B1B4D_45%,#14307A_100%)] px-6 pb-7 pt-9 text-center text-white">
        <div aria-hidden className="ml-gold-rays -z-10" />
        {SPARKS.map((s) => <Spark key={`${s.left}-${s.top}`} {...s} />)}
        <div className="relative mx-auto w-fit rounded-full bg-white/10 p-2 ring-4 ring-amber-300/80 ml-gold-glow">
          <RewardPreview code={code} userId={userId} reward={reward} size={136} />
        </div>
        <p className="relative mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">{t('studentHome.league.milestone.eyebrow')}</p>
        <Title className="relative mt-1 text-3xl font-extrabold leading-tight text-white">{achievementField(achievement, 'title', locale)}</Title>
        <Description className="relative mt-2 text-sm text-blue-100">
          {achievementField(achievement, 'description', locale)}
          {reward && (
            <span className="mt-3 block">
              <span className="inline-block rounded-2xl bg-white/10 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-white/15">
                {t('studentHome.achievements.celebration.newToWear', { part: rewardLabel(reward, locale) })}
              </span>
            </span>
          )}
        </Description>
      </div>
    </>
  );
}
