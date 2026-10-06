import { Flame, Heart, Laugh, Sparkles, ThumbsUp, Waves, type LucideIcon } from 'lucide-react';
import type { ReactionKind } from '../../lib/liveLesson/types';

// Staff and presenter screens draw reactions as icons, never as native emoji.
const ICON: Record<ReactionKind, LucideIcon> = {
  love: Heart, laugh: Laugh, fire: Flame, clap: ThumbsUp, mindblown: Sparkles, splash: Waves,
};

export function ReactionGlyph({ kind, className = 'h-3.5 w-3.5' }: { kind: ReactionKind; className?: string }) {
  const Icon = ICON[kind];
  return <Icon className={`inline-block shrink-0 align-[-0.125em] ${className}`} aria-hidden />;
}
