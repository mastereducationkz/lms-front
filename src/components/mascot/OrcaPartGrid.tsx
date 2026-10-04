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
  type LockedParts,
  type MascotCategory,
  type MascotConfig,
} from './config';

interface PartGridProps {
  tab: MascotCategory;
  config: MascotConfig;
  locked: LockedParts | null;
  onPick: (config: MascotConfig) => void;
}

function Tile({ label, option, active, isLocked, isReward, onClick }: {
  label: string; option: MascotConfig; active: boolean; isLocked: boolean; isReward: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={isLocked ? `${label} — locked, tap to try it on` : label}
      aria-label={isLocked ? `${label}, locked — try it on` : label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors ${
        active ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' : 'hover:bg-gray-50 dark:hover:bg-secondary'
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
      <span className="text-[10px] leading-tight text-center text-gray-600 dark:text-gray-400 line-clamp-2">{label}</span>
    </button>
  );
}

export default function OrcaPartGrid({ tab, config, locked, onPick }: PartGridProps) {
  const parts = CATEGORY_PARTS[tab].map((part, index) => ({ part, index }));
  const free = parts.filter(({ index }) => !isRewardPart(tab, index));
  const rewards = parts.filter(({ index }) => isRewardPart(tab, index));

  const tile = ({ part, index }: (typeof parts)[number]) => {
    const option = { ...config, [tab]: index };
    const isLocked = isLockedPart(tab, index, locked);
    return (
      <Tile
        key={part.key}
        label={part.label}
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
          <h4 className="mt-4 mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300 inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Earned with achievements
            <span className="font-normal text-muted-foreground">· tap a locked one to try it on</span>
          </h4>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">{rewards.map(tile)}</div>
        </>
      )}
    </div>
  );
}
