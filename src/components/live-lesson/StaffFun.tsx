/**
 * The teacher's side of the live lesson's fun layer (owner, 2026-10-04), in LiveControls (the Meet
 * panel and the lesson page): a live reaction counter with a pause switch, the private «lost»
 * count (fades after a minute), the raised-hand queue, «Kasatik of the lesson» and the closing
 * recap. Kept light for the Meet panel: emoji and lazy orcas only, no reaction art, no confetti.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Crown, Frown, Hand, Pause, PartyPopper, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LiveApi } from '../../lib/liveLesson/api';
import { lostShowing } from '../../lib/liveLesson/reactions';
import { useLiveEvent } from '../../lib/liveLesson/useLiveEvent';
import type { LiveSocket } from '../../lib/liveLesson/useLiveLesson';
import type { LiveState, Person, ReactionEvent, ReactionKind } from '../../lib/liveLesson/types';
import { LiveAvatar } from './orcas';

const EMOJI: Record<ReactionKind, string> = { love: '😍', laugh: '😂', fire: '🔥', clap: '👏', mindblown: '🤯', splash: '🌊' };
const AUTO: Record<string, string> = { focus: 'paused while a pop-check / mistake is open', timer: 'paused while the timer runs' };

export type RenderStar = (student: Person, groupId: number, close: () => void) => ReactNode;

interface Props {
  state: LiveState;
  api: LiveApi;
  act: <T>(write: () => Promise<T>) => Promise<T>;
  socket?: LiveSocket | null;
  /** The lesson page passes the Star of the Week dialog; the Meet panel can't (other auth). */
  renderStar?: RenderStar;
}

function useTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return now;
}

export default function StaffFun({ state, api, act, socket, renderStar }: Props) {
  const id = state.lesson.id;
  const now = useTick(1000);
  const [recent, setRecent] = useState<number[]>([]);
  const [lost, setLost] = useState<{ count: number; until: number } | null>(
    state.lost?.count ? { count: state.lost.count, until: Date.now() + 60_000 } : null);
  useLiveEvent<ReactionEvent>(socket, id, 'live:reaction', () => setRecent((r) => [...r.filter((t) => Date.now() - t < 60_000), Date.now()]));
  useLiveEvent<{ event_id: number; count: number; until: string }>(socket, id, 'live:lost',
    (p) => setLost({ count: p.count, until: Date.parse(p.until) }));
  const perMinute = recent.filter((t) => now - t < 60_000).length;
  const energy = state.energy;
  const status = state.reactions;
  const lostNow = lostShowing(lost, now);
  const run = (write: () => Promise<unknown>) => void act(write).catch(() => undefined);

  return (
    <section className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs">
          <p className="font-semibold uppercase tracking-wide text-muted-foreground">Reactions</p>
          <p className="truncate text-foreground">
            <b>{perMinute}</b>/min · <b>{energy?.total ?? 0}</b> total
            {energy?.top ? <span className="ml-1">{EMOJI[energy.top]} most</span> : null}
          </p>
          {status && !status.on && status.paused && status.paused !== 'teacher' && (
            <p className="text-[11px] text-muted-foreground">{AUTO[status.paused]}</p>
          )}
        </div>
        <button type="button" onClick={() => run(() => api.pauseReactions(id, !state.reactions_paused))}
          className="inline-flex flex-none items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted/60">
          {state.reactions_paused ? <><Play className="h-3.5 w-3.5" />Resume</> : <><Pause className="h-3.5 w-3.5" />Pause</>}
        </button>
      </div>

      <div className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-opacity duration-700',
        lostNow ? 'bg-amber-50 text-amber-900 opacity-100 dark:bg-amber-950/40 dark:text-amber-100' : 'opacity-0 h-0 overflow-hidden p-0')}
        aria-live="polite">
        <Frown className="h-5 w-5 shrink-0" aria-hidden /><b>{lostNow}</b> lost right now <span className="text-xs opacity-70">(anonymous)</span>
      </div>

      <HandQueue state={state} onCall={(userId) => run(() => api.callHand(id, userId))} />
      <CrownBlock state={state} api={api} run={run} renderStar={renderStar} />

      <button type="button" onClick={() => run(() => api.recap(id, !state.recap))}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15">
        <PartyPopper className="h-3.5 w-3.5" aria-hidden />{state.recap ? 'Hide the closing recap' : 'Show the closing recap'}
      </button>
    </section>
  );
}

function HandQueue({ state, onCall }: { state: LiveState; onCall: (userId: number) => void }) {
  const hands = state.hands ?? [];
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Hand className="h-3.5 w-3.5" aria-hidden />Hands up {hands.length ? `· ${hands.length}` : ''}
      </p>
      {hands.length === 0 ? <p className="text-xs text-muted-foreground">Nobody yet.</p> : (
        <ol className="mt-1 space-y-1">
          {hands.map((h, i) => (
            <li key={h.user_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="live-hand-wave inline-block"><LiveAvatar person={h} size={24} /></span>
                <span className="truncate">{h.name}</span>
              </span>
              <button type="button" onClick={() => onCall(h.user_id)}
                className="flex-none rounded-lg bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Call</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CrownBlock({ state, api, run, renderStar }: {
  state: LiveState; api: LiveApi; run: (write: () => Promise<unknown>) => void; renderStar?: RenderStar;
}) {
  const id = state.lesson.id;
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<number | ''>('');
  const [star, setStar] = useState(false);
  const candidates = state.room ?? [];
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api.crownSuggestion(id).then((s) => { if (alive && s.user_id && choice === '') setChoice(s.user_id); }).catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);
  const crowned = state.crowned ?? null;
  const groupId = state.group_ids?.[0];
  return (
    <div className="rounded-lg bg-amber-50/60 p-2 dark:bg-amber-950/20">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <Crown className="h-3.5 w-3.5" aria-hidden />Kasatik of the lesson
        </p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-primary">
          {crowned ? 'Change' : open ? 'Close' : 'Choose'}
        </button>
      </div>
      {crowned && (
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="relative"><LiveAvatar person={crowned} size={28} /><Crown aria-hidden className="absolute -top-2.5 left-1 h-3.5 w-3.5 fill-amber-400 text-amber-500" /></span>
          <span className="truncate font-semibold">{crowned.name}</span>
        </div>
      )}
      {open && (
        <div className="mt-2 flex gap-1.5">
          <select value={choice} onChange={(e) => setChoice(e.target.value ? Number(e.target.value) : '')}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs">
            <option value="">Pick a student…</option>
            {candidates.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
          </select>
          <button type="button" disabled={choice === ''}
            onClick={() => { if (choice !== '') { run(() => api.crown(id, choice)); setOpen(false); } }}
            className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Crown</button>
        </div>
      )}
      {open && <p className="mt-1 text-[11px] text-muted-foreground">Suggested from today's participation — change it if you like.</p>}
      {crowned && !open && (renderStar && groupId ? (
        <button type="button" onClick={() => setStar(true)} className="mt-1.5 text-xs font-semibold text-primary underline underline-offset-2">
          Also give Star of the Week?
        </button>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">Star of the Week: give it from the lesson page or the leaderboard.</p>
      ))}
      {star && crowned && groupId && renderStar?.(crowned, groupId, () => setStar(false))}
    </div>
  );
}
