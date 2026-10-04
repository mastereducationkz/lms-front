/**
 * The builder's part grid for one layer: free parts first, then the parts earned with
 * achievements — locked ones show a lock and, when tapped, how to earn them and the progress.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import Orca from './Orca';
import {
  CATEGORY_PARTS,
  isLockedPart,
  isRewardPart,
  rewardPart,
  type LockedParts,
  type MascotCategory,
  type MascotConfig,
} from './config';
import type { Achievement } from '../../services/api/achievements';

interface PartGridProps {
  tab: MascotCategory;
  config: MascotConfig;
  locked: LockedParts | null;
  achievements: Achievement[] | null;
  onPick: (config: MascotConfig) => void;
}

/** «Unlock: <title> — <how_to>» for a locked reward part, from the achievements API. */
export function unlockHint(category: MascotCategory, index: number, achievements: Achievement[] | null) {
  const reward = rewardPart(category, index);
  const a = reward ? achievements?.find((x) => x.key === reward.achievement) : undefined;
  if (!a) return { title: 'an achievement', howTo: null as string | null, progress: null, key: reward?.achievement ?? '' };
  return { title: a.title, howTo: a.how_to, progress: a.progress, key: a.key };
}

function Tile({ label, option, active, isLocked, isReward, onClick }: {
  label: string; option: MascotConfig; active: boolean; isLocked: boolean; isReward: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={isLocked ? `${label} — locked` : label}
      aria-label={isLocked ? `${label}, locked` : label}
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

export default function OrcaPartGrid({ tab, config, locked, achievements, onPick }: PartGridProps) {
  const [inspect, setInspect] = useState<{ tab: MascotCategory; index: number } | null>(null);
  const parts = CATEGORY_PARTS[tab].map((part, index) => ({ part, index }));
  const free = parts.filter(({ index }) => !isRewardPart(tab, index));
  const rewards = parts.filter(({ index }) => isRewardPart(tab, index));
  const shown = inspect && inspect.tab === tab ? inspect : null;
  const hint = shown ? unlockHint(tab, shown.index, achievements) : null;

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
        onClick={() => {
          if (isLocked) {
            setInspect({ tab, index });
          } else {
            setInspect(null);
            onPick(option);
          }
        }}
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
          </h4>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">{rewards.map(tile)}</div>
        </>
      )}
      {shown && hint && (
        <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm" role="status">
          <p className="font-medium text-gray-900 dark:text-white">
            <Lock className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            Unlock: {hint.title}
            {hint.howTo ? ` — ${hint.howTo}` : ''}
          </p>
          {!hint.howTo && hint.title === 'Secret achievement' && (
            <p className="text-xs text-muted-foreground mt-1">It's a secret — keep learning and you'll discover it.</p>
          )}
          {hint.progress && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-amber-100 dark:bg-amber-950 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${Math.min(100, Math.round((hint.progress.current / Math.max(1, hint.progress.target)) * 100))}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">
                {hint.progress.current} / {hint.progress.target}
              </span>
            </div>
          )}
          <Link to={hint.key ? `/achievements#${hint.key}` : '/achievements'} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
            See your achievements →
          </Link>
        </div>
      )}
    </div>
  );
}
