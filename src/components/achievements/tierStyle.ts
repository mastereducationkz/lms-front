/** Tier looks for achievement cards and chips (owner, 2026-10-04): legendary gets the gold glow. */
import type { AchievementTier } from '@/services/api/achievementsUi';

export interface TierStyle {
  card: string;
  badge: string;
  bar: string;
  ring: string;
}

export const TIER_STYLE: Record<AchievementTier, TierStyle> = {
  earned: {
    card: 'border-slate-200 dark:border-slate-700',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    bar: 'bg-slate-500',
    ring: 'ring-slate-300 dark:ring-slate-600',
  },
  rare: {
    card: 'border-sky-200 dark:border-sky-900',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    bar: 'bg-sky-500',
    ring: 'ring-sky-300 dark:ring-sky-700',
  },
  legendary: {
    card:
      'border-amber-300 dark:border-amber-500/60 bg-gradient-to-br from-amber-50/80 via-white to-white dark:from-amber-500/10 dark:via-card dark:to-card shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_10px_30px_-12px_rgba(245,158,11,0.55)]',
    badge: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950',
    bar: 'bg-gradient-to-r from-amber-500 to-yellow-400',
    ring: 'ring-amber-400',
  },
  social: {
    card: 'border-violet-200 dark:border-violet-900',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    bar: 'bg-violet-500',
    ring: 'ring-violet-300 dark:ring-violet-700',
  },
  seasonal: {
    card: 'border-emerald-200 dark:border-emerald-900',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-300 dark:ring-emerald-700',
  },
};

export const tierStyle = (tier: string): TierStyle => TIER_STYLE[tier as AchievementTier] ?? TIER_STYLE.earned;
