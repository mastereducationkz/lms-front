/**
 * «Try it on» for a locked achievement (owner, 2026-10-04): opens the orca builder already wearing
 * the achievement's rewards in try-on mode. A preview only — nothing is saved.
 */
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shirt } from 'lucide-react';
import { ORCA_SECTION_ID } from '@/components/mascot/KasatikSpotlight';
import { tryOnHref } from '@/components/mascot/tryOn';
import { rewardLabel } from '@/components/mascot/config';
import { useLocale, useT } from '@/lib/i18n/react';
import type { AchievementReward } from '@/services/api/achievementsUi';
import '@/lib/i18n/catalogs/studentHome';

export default function TryOnButton({ rewards, className = '' }: { rewards: AchievementReward[]; className?: string }) {
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();
  if (rewards.length === 0) return null;
  const names = rewards.map((r) => rewardLabel(r, locale));
  const parts = names.length > 1
    ? t('studentHome.achievements.listPair', { first: names.slice(0, -1).join(', '), last: names[names.length - 1] })
    : names[0];
  const go = (e: MouseEvent) => {
    // Cards and tiles are often clickable themselves — this button means «try it on», not «open».
    e.stopPropagation();
    navigate(tryOnHref(rewards, ORCA_SECTION_ID));
  };
  return (
    <button
      type="button"
      onClick={go}
      className={`inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand/10 ${className}`}
      data-tip="try-on"
      aria-label={t('studentHome.achievements.tryOnAria', { parts })}
    >
      <Shirt className="h-3.5 w-3.5" aria-hidden /> {t('studentHome.achievements.tryOn')}
    </button>
  );
}
