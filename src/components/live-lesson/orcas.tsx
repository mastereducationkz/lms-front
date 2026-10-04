/**
 * Orcas on live screens (owner, 2026-10-04): «who's here», who has answered, the picker landing on
 * someone, and who voted for what on a named reveal. The avatar module loads lazily, so the Meet
 * panel's small bundle only pays for it when an orca is actually drawn.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { capList, shuffleDelay, shuffleSequence } from '../../lib/liveLesson/orcas';
import type { Person } from '../../lib/liveLesson/types';

const UserAvatar = lazy(() => import('../mascot/UserAvatar'));

export function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** One student's orca (or photo). Everyone on a live screen is a student. */
export function LiveAvatar({ person, size = 28, className }: { person: Person; size?: number; className?: string }) {
  const placeholder = <span aria-hidden style={{ width: size, height: size }} className={cn('inline-block shrink-0 rounded-full bg-muted', className)} />;
  return (
    <Suspense fallback={placeholder}>
      <UserAvatar userId={person.user_id} name={person.name} mascot={person.mascot ?? null}
        avatarUrl={person.avatar_url ?? null} isStudent size={size} className={className} />
    </Suspense>
  );
}

/** Overlapping orcas with a «+N» pill; new faces pop in. */
export function OrcaStack({ people, size = 32, max = 12, pop = false, className }: {
  people: Person[]; size?: number; max?: number; pop?: boolean; className?: string;
}) {
  const { shown, more } = capList(people, max);
  if (!people.length) return null;
  const overlap = Math.round(size * 0.28);
  return (
    <div className={cn('flex items-center', className)} aria-label={`${people.length} student${people.length === 1 ? '' : 's'}`}>
      {shown.map((person, i) => (
        <span key={person.user_id} title={person.name ?? undefined} style={{ marginLeft: i ? -overlap : 0, zIndex: shown.length - i }}
          className={cn('relative rounded-full ring-2 ring-background', pop && 'live-orca-pop')}>
          <LiveAvatar person={person} size={size} />
        </span>
      ))}
      {more > 0 && (
        <span style={{ marginLeft: -overlap, height: size, minWidth: size, fontSize: Math.max(11, Math.round(size * 0.34)) }}
          className="relative z-0 inline-flex items-center justify-center rounded-full bg-muted px-1.5 font-semibold text-muted-foreground ring-2 ring-background">
          +{more}
        </span>
      )}
    </div>
  );
}

/** A row of orcas that gently bob: «who's here» on the presenter. */
export function OrcaStrip({ people, size = 44, max = 28 }: { people: Person[]; size?: number; max?: number }) {
  const { shown, more } = capList(people, max);
  return (
    <div className="flex flex-wrap items-end justify-center gap-2">
      {shown.map((person, i) => (
        <span key={person.user_id} title={person.name ?? undefined} className="live-orca-bob" style={{ animationDelay: `${(i % 7) * 0.35}s` }}>
          <LiveAvatar person={person} size={size} />
        </span>
      ))}
      {more > 0 && <span className="self-center text-xl font-semibold text-muted-foreground">+{more}</span>}
    </div>
  );
}

/**
 * The picker's moment: flash through the faces in the room, slowing down, then land big on the
 * picked student. Reduced motion lands straight away.
 */
export function PickReveal({ pickId, picked, room, size = 168, horizontal = false }: {
  pickId: number; picked: Person; room: Person[]; size?: number; horizontal?: boolean;
}) {
  const [shown, setShown] = useState<Person>(picked);
  const [landed, setLanded] = useState(true);
  useEffect(() => {
    if (reducedMotion()) { setShown(picked); setLanded(true); return undefined; }
    const byId = new Map(room.map((p) => [p.user_id, p]));
    byId.set(picked.user_id, picked);
    const seq = shuffleSequence(room.map((p) => p.user_id), picked.user_id, 14);
    let i = 0;
    let timer: number | undefined;
    setLanded(seq.length <= 1);
    const step = () => {
      setShown(byId.get(seq[i]) ?? picked);
      if (i >= seq.length - 1) { setLanded(true); return; }
      timer = window.setTimeout(() => { i += 1; step(); }, shuffleDelay(i, seq.length));
    };
    step();
    return () => window.clearTimeout(timer);
    // A new pick (id) restarts the shuffle; refreshed room lists don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickId]);
  return (
    <div className={cn('flex items-center', horizontal ? 'flex-row gap-5' : 'flex-col gap-3')}>
      <span className={cn('rounded-full ring-4 transition-shadow', landed ? 'live-orca-wiggle ring-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.55)]' : 'ring-transparent')}>
        <LiveAvatar person={shown} size={size} />
      </span>
      <span className={cn('text-4xl font-bold transition-opacity', landed ? 'opacity-100' : 'opacity-40')}>{shown.name}</span>
    </div>
  );
}
