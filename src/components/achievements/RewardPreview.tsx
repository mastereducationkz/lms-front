/**
 * The student's orca wearing an achievement's reward. Parts the mascot module can't draw yet
 * (it's still shipping the new reward art) fall back to the current orca plus a gift badge.
 */
import { Gift, Lock } from 'lucide-react';
import Orca from '@/components/mascot/Orca';
import { parseMascot, resolveMascot } from '@/components/mascot/config';
import { withReward } from '@/lib/achievements';
import type { AchievementReward } from '@/services/api/achievementsUi';

interface RewardPreviewProps {
  code: string | null | undefined;
  userId: number | string;
  reward?: AchievementReward | null;
  size?: number;
  locked?: boolean;
  className?: string;
}

export default function RewardPreview({ code, userId, reward, size = 64, locked = false, className = '' }: RewardPreviewProps) {
  const dressed = reward ? parseMascot(withReward(code, userId, reward)) : null;
  const config = dressed ?? resolveMascot(code, userId);
  const badge = Math.max(18, Math.round(size * 0.34));
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Orca
        config={config}
        size={size}
        title={reward ? `Orca with ${reward.name}` : 'Your orca'}
        className={`rounded-full ${locked ? 'grayscale opacity-60' : ''}`}
      />
      {reward && !dressed && !locked && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-brand-solid text-brand-solid-foreground ring-2 ring-white dark:ring-card"
          style={{ width: badge, height: badge }}
        >
          <Gift style={{ width: badge * 0.55, height: badge * 0.55 }} />
        </span>
      )}
      {locked && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-gray-700 text-white ring-2 ring-white dark:ring-card"
          style={{ width: badge, height: badge }}
        >
          <Lock style={{ width: badge * 0.5, height: badge * 0.5 }} />
        </span>
      )}
    </span>
  );
}
