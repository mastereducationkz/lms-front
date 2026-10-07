/**
 * The builder's part grid for one layer: free parts first, then the parts earned with
 * achievements. A locked one shows a lock; tapping it TRIES IT ON in the preview — the builder
 * explains how to earn it and won't save it (owner, 2026-10-04).
 */
import { Lock, Sparkles } from 'lucide-react';
import Orca from './Orca';
import {
  CATEGORY_PARTS,
  isLockedPart,
  isRewardPart,
  partLabel,
  type LockedParts,
  type MascotCategory,
  type MascotConfig,
} from './config';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

interface PartGridProps {
  tab: MascotCategory;
  config: MascotConfig;
  locked: LockedParts | null;
  onPick: (config: MascotConfig) => void;
}

function Tile({ label, option, active, isLocked, isReward, onClick }: {
  label: string; option: MascotConfig; active: boolean; isLocked: boolean; isReward: boolean; onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      title={isLocked ? t('studentHome.mascot.lockedTitle', { part: label }) : label}
      aria-label={isLocked ? t('studentHome.mascot.lockedAria', { part: label }) : label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors ${
        active ? 'bg-brand-surface ring-2 ring-ring' : 'hover:bg-muted'
      }`}
    >
      <span className={isLocked ? 'grayscale opacity-45' : ''}>
        <Orca config={option} size={56} title={label} />
      </span>
      {isLocked && (
        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-900/80 text-white flex items-center justify-center">
          <Lock className="w-3 h-3" />
        </span>
      )}
      {isReward && !isLocked && (
        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center shadow">
          <Sparkles className="w-3 h-3" />
        </span>
      )}
      <span className="text-[10px] leading-tight text-center text-muted-foreground line-clamp-2">{label}</span>
    </button>
  );
}

export default function OrcaPartGrid({ tab, config, locked, onPick }: PartGridProps) {
  const t = useT();
  const locale = useLocale();
  const parts = CATEGORY_PARTS[tab].map((part, index) => ({ part, index }));
  const free = parts.filter(({ index }) => !isRewardPart(tab, index));
  const rewards = parts.filter(({ index }) => isRewardPart(tab, index));

  const tile = ({ part, index }: (typeof parts)[number]) => {
    const option = { ...config, [tab]: index };
    const isLocked = isLockedPart(tab, index, locked);
    return (
      <Tile
        key={part.key}
        label={partLabel(tab, index, locale)}
        option={option}
        active={config[tab] === index}
        isLocked={isLocked}
        isReward={isRewardPart(tab, index)}
        onClick={() => onPick(option)}
      />
    );
  };

  return (
    <div role="tabpanel">
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">{free.map(tile)}</div>
      {rewards.length > 0 && (
        <>
          <h4 className="mt-4 mb-2 text-xs font-semibold text-gray-700 dark:text-foreground inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {t('studentHome.mascot.earnedWithAchievements')}
            <span className="font-normal text-muted-foreground">{t('studentHome.mascot.tapLockedToTry')}</span>
          </h4>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">{rewards.map(tile)}</div>
        </>
      )}
    </div>
  );
}
