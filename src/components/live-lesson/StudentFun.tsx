/**
 * A student's fun controls in the live lesson (owner, 2026-10-04): six reactions previewed as THEIR
 * orca, a cooldown ring after a tap (the server drops extra taps quietly), the private «I'm lost»
 * signal that only the teacher sees as an anonymous count, and a raised hand with its place in line.
 */
import { useEffect, useState } from 'react';
import { Frown, Hand } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LiveApi } from '../../lib/liveLesson/api';
import { liveErrorText, withReconnect } from '../../lib/liveLesson/resilience';
import { cooldownLeft } from '../../lib/liveLesson/reactions';
import type { LiveState, Person, ReactionKind } from '../../lib/liveLesson/types';
import ReactionOrca, { REACTION_KINDS, REACTION_LABEL } from '../mascot/ReactionOrca';

const PAUSED_TEXT: Record<string, string> = {
  teacher: 'Your teacher paused reactions for now.',
  focus: 'Reactions are paused while you answer.',
  timer: 'Reactions are paused while the timer runs.',
};

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

/** A thin ring that drains while the button cools down. */
function Ring({ left, size }: { left: number; size: number }) {
  if (left <= 0) return null;
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <svg aria-hidden width={size} height={size} className="pointer-events-none absolute inset-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="3"
        className="text-primary" strokeDasharray={c} strokeDashoffset={c * (1 - left)} strokeLinecap="round" />
    </svg>
  );
}

export function ReactionBar({ state, api, me }: { state: LiveState; api: LiveApi; me: Person | null }) {
  const status = state.reactions ?? { on: true, paused: null };
  const [cool, setCool] = useState<{ until: number; total: number } | null>(null);
  const now = useNow(cool !== null);
  const left = cool ? cooldownLeft(cool.until, cool.total, now) : 0;
  useEffect(() => { if (cool && left <= 0) setCool(null); }, [cool, left]);
  const send = async (kind: ReactionKind) => {
    if (!status.on || left > 0) return;
    try {
      const result = await api.react(state.lesson.id, kind);
      // Accepted: a short ring so a hold-and-mash can't flood. Refused: the server's wait.
      const wait = result.accepted ? 1 : result.retry_in;
      if (wait > 0) setCool({ until: Date.now() + wait * 1000, total: wait * 1000 });
    } catch {
      /* a dropped reaction is fine */
    }
  };
  const size = 46;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="grid grid-cols-6 place-items-center gap-1">
        {REACTION_KINDS.map((kind) => (
          <button key={kind} type="button" onClick={() => void send(kind)} disabled={!status.on}
            aria-label={REACTION_LABEL[kind]} title={REACTION_LABEL[kind]}
            className={cn('relative rounded-full transition active:scale-90 disabled:opacity-40', left > 0 && 'opacity-70')}
            style={{ width: size, height: size }}>
            <ReactionOrca kind={kind} code={me?.mascot ?? null} userId={me?.user_id ?? null} size={size} />
            <Ring left={left} size={size} />
          </button>
        ))}
      </div>
      {!status.on && status.paused && <p className="mt-2 text-center text-xs text-muted-foreground">{PAUSED_TEXT[status.paused]}</p>}
    </div>
  );
}

export function HandAndLost({ state, api }: { state: LiveState; api: LiveApi }) {
  const mine = state.my_hand ?? null;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lostUntil, setLostUntil] = useState(0);
  const now = useNow(lostUntil > Date.now());
  const toggleHand = async () => {
    setBusy(true);
    setNote(null);
    try {
      // Up or down is the same twice over, so a blip is simply waited out.
      const result = await withReconnect(() => api.hand(state.lesson.id, !mine));
      if (result && !result.accepted) setNote(`You can raise your hand again in ${Math.ceil(result.retry_in)} s.`);
    } catch (e) {
      setNote(liveErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const sayLost = async () => {
    try {
      const result = await api.lost(state.lesson.id);
      setLostUntil(Date.now() + (result.accepted ? 30_000 : result.retry_in * 1000));
      setNote(result.accepted ? 'Your teacher sees that someone is lost (not who).' : null);
    } catch {
      /* nothing to do */
    }
  };
  const lostCooling = lostUntil > now;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void toggleHand()} disabled={busy}
          className={cn('inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
            mine ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100' : 'border-border bg-card text-foreground hover:bg-muted/60')}>
          <Hand className={cn('h-4 w-4', mine && 'live-hand-wave')} aria-hidden />
          {mine ? `Hand up · #${mine.position} in line` : 'Raise hand'}
        </button>
        <button type="button" onClick={() => void sayLost()} disabled={lostCooling}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/60 disabled:opacity-50">
          <Frown className="h-4 w-4" aria-hidden />I'm lost
        </button>
      </div>
      {mine && <p className="text-center text-xs text-muted-foreground">Tap again to lower your hand.</p>}
      {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
      <p className="text-center text-[11px] text-muted-foreground">«I'm lost» is private: only your teacher sees how many, never who.</p>
    </div>
  );
}
