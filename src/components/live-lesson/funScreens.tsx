/**
 * The big-screen side of the live lesson's fun layer (owner, 2026-10-04): reactions floating up as
 * each student's own orca, the answer race lane, the closing recap and «Kasatik of the lesson».
 * Used by the presenter and the student page — never by the Meet panel (keeps its bundle light).
 */
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { addReaction, emptyBubbles, prune, type BubbleState } from '../../lib/liveLesson/reactions';
import { useLiveEvent } from '../../lib/liveLesson/useLiveEvent';
import type { LiveSocket } from '../../lib/liveLesson/useLiveLesson';
import type { LiveRecap, Person, ReactionEvent } from '../../lib/liveLesson/types';
import ReactionOrca, { REACTION_EMOJI } from '../mascot/ReactionOrca';
import Confetti from '../achievements/Confetti';
import { LiveAvatar, reducedMotion } from './orcas';

/** Reactions rising across the screen; identical ones within a second merge into «🔥×7». */
export function ReactionLayer({ socket, eventId, size = 64 }: { socket?: LiveSocket | null; eventId: number; size?: number }) {
  const [state, setState] = useState<BubbleState>(emptyBubbles);
  useLiveEvent<ReactionEvent>(socket, eventId, 'live:reaction', (e) => setState((s) => addReaction(s, e, Date.now())));
  useEffect(() => {
    const tick = window.setInterval(() => setState((s) => prune(s, Date.now())), 500);
    return () => window.clearInterval(tick);
  }, []);
  const still = reducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {state.bubbles.map((b) => (
        <div key={b.id} className={cn('absolute bottom-6', !still && 'live-react-rise')} style={{ left: `${b.x}%` }}>
          <div className="relative">
            <ReactionOrca kind={b.kind} code={b.person?.mascot ?? null} userId={b.person?.user_id ?? null} size={size} />
            {b.count > 1 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-primary px-2 py-0.5 text-sm font-bold text-primary-foreground shadow">
                {REACTION_EMOJI[b.kind]}×{b.count}
              </span>
            )}
          </div>
        </div>
      ))}
      {state.overflow > 0 && (
        <span className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">
          +{state.overflow} reactions
        </span>
      )}
    </div>
  );
}

/**
 * The answer race: each orca swims in along a lane as its answer arrives, the first answer at the
 * finish. Who answered — never what.
 */
export function AnswerLane({ people, offered }: { people: Person[]; offered: number }) {
  const total = Math.max(offered, people.length, 1);
  const shown = people.slice(0, 30);
  return (
    <div className="relative mt-2 h-24 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-100 via-sky-200 to-sky-300 dark:from-sky-950 dark:via-sky-900 dark:to-sky-800">
      <div aria-hidden className="absolute inset-y-0 right-3 w-1.5 rounded bg-[repeating-linear-gradient(0deg,#fff_0_8px,#1e293b_8px_16px)]" />
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-white/60" />
      {shown.map((person, i) => {
        // First answer swims furthest; later ones line up behind it.
        const right = 2 + (i / total) * 88;
        return (
          <span key={person.user_id} title={person.name ?? undefined}
            className="live-orca-swim absolute top-1/2 -translate-y-1/2 transition-[right] duration-700"
            style={{ right: `${right}%`, zIndex: shown.length - i }}>
            <LiveAvatar person={person} size={56} />
          </span>
        );
      })}
      {people.length > shown.length && (
        <span className="absolute bottom-1 left-2 text-sm font-semibold text-sky-900 dark:text-sky-100">+{people.length - shown.length}</span>
      )}
    </div>
  );
}

/** A student's orca wearing the crown of «Kasatik of the lesson». */
export function CrownedOrca({ person, size = 160 }: { person: Person; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2" style={{ paddingTop: size * 0.34 }}>
      <span className="relative inline-block">
        <span aria-hidden className="absolute left-1/2 -translate-x-1/2 drop-shadow-lg" style={{ top: -size * 0.32, fontSize: size * 0.42 }}>👑</span>
        <span className="live-orca-wiggle inline-block rounded-full ring-4 ring-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.55)]">
          <LiveAvatar person={person} size={size} />
        </span>
      </span>
      <span className="text-center font-bold" style={{ fontSize: Math.max(16, size * 0.16) }}>{person.name}</span>
    </div>
  );
}

function Stat({ value, label, big }: { value: string | number; label: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn('font-bold tabular-nums', big ? 'text-6xl' : 'text-3xl')}>{value}</span>
      <span className={cn('text-muted-foreground', big ? 'text-xl' : 'text-sm')}>{label}</span>
    </div>
  );
}

/** The closing recap: what the class did, the energy, the top participants and the crown. */
export function Recap({ recap, big = false }: { recap: LiveRecap; big?: boolean }) {
  const energy = recap.energy;
  return (
    <div className={cn('flex flex-col items-center text-center', big ? 'gap-7' : 'gap-5')}>
      <Confetti pieces={big ? 160 : 90} durationMs={big ? 3200 : 2200} />
      <h2 className={cn('font-bold', big ? 'text-6xl' : 'text-2xl')}>What a lesson! 🎉</h2>
      <div className={cn('flex flex-wrap justify-center', big ? 'gap-16' : 'gap-8')}>
        <Stat big={big} value={recap.activities} label="activities" />
        <Stat big={big} value={recap.answers} label="answers" />
        <Stat big={big} value={energy.total ? `${energy.total}${energy.top ? ` ${REACTION_EMOJI[energy.top]}` : ''}` : 0} label="reactions" />
      </div>
      {recap.crowned && (
        <div className="flex flex-col items-center gap-3">
          <p className={cn('font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400', big ? 'text-2xl' : 'text-sm')}>Kasatik of the lesson</p>
          <CrownedOrca person={recap.crowned} size={big ? 168 : 104} />
        </div>
      )}
      {recap.top.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <p className={cn('inline-flex items-center gap-2 font-semibold text-muted-foreground', big ? 'text-xl' : 'text-sm')}>
            <Trophy className={big ? 'h-6 w-6' : 'h-4 w-4'} aria-hidden />Most active
          </p>
          <div className={cn('flex flex-wrap justify-center', big ? 'gap-10' : 'gap-5')}>
            {recap.top.map((p) => (
              <div key={p.user_id} className="flex flex-col items-center gap-1">
                <span className="live-orca-bob"><LiveAvatar person={p} size={big ? 104 : 56} /></span>
                <span className={big ? 'text-xl font-semibold' : 'text-xs font-semibold'}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
