import { Medal } from 'lucide-react';
import { cn } from '../../lib/utils';

const TONE = [
  'text-yellow-600 dark:text-yellow-400',
  'text-slate-500 dark:text-slate-300',
  'text-orange-700 dark:text-orange-400',
];
const LABEL = ['1st place', '2nd place', '3rd place'];

/**
 * Gold, silver or bronze for the top three of a leaderboard; `null` below that, so the caller
 * falls back to the plain rank number. A drawn icon, never the 🥇🥈🥉 emoji.
 */
export function RankMedal({ rank, className }: { rank: number; className?: string }) {
  if (rank < 1 || rank > 3) return null;
  return <Medal className={cn('h-4 w-4', TONE[rank - 1], className)} aria-label={LABEL[rank - 1]} role="img" />;
}

export default RankMedal;
