import { useState, type ReactNode } from 'react';
import {
  Check, Copy, Dices, ExternalLink, Eye, Lock, Pause, Play, Plus, Square, Timer, UserCheck, UserX, Users, Volume2, VolumeX,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LiveApi } from '../../lib/liveLesson/api';
import { chimeMuted, playChime, setChimeMuted } from '../../lib/liveLesson/chime';
import { TIMER_PRESETS, chatText, formatSeconds } from '../../lib/liveLesson/logic';
import type { LiveState, StartActivity } from '../../lib/liveLesson/types';
import ActivityComposer from './ActivityComposer';
import StaffActivity from './StaffActivity';
import { Countdown } from './parts';
import { LiveAvatar } from './orcas';
import StaffFun, { type RenderStar } from './StaffFun';
import type { LiveSocket } from '../../lib/liveLesson/useLiveLesson';

interface Props {
  state: LiveState;
  api: LiveApi;
  seconds: number | null;
  act: <T>(write: () => Promise<T>) => Promise<T>;
  presenterUrl: string;
  /** For the live reaction counter and the «lost» signal (owner, 2026-10-04). */
  socket?: LiveSocket | null;
  /** The lesson page's Star of the Week dialog; the Meet panel has none. */
  renderStar?: RenderStar;
}

/**
 * The teacher's live-lesson controls (owner, 2026-09-29), in the Meet side panel and on the lesson
 * page: the link for the Meet chat, who is here, the timer, the random picker, the question that is
 * open (close, «Show»), and a new question. Two drivers share one state; the last tap wins.
 */
export default function LiveControls({ state, api, seconds, act, presenterUrl, socket, renderStar }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = state.lesson.id;
  const run = async (write: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await act(write);
      return true;
    } catch (e) {
      setError((e as Error).message || 'That did not work. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const activity = state.activity;
  const start = (data: StartActivity) => run(() => api.start(id, data));

  return (
    <div className="space-y-3 text-foreground">
      <LinkRow link={state.link} presenterUrl={presenterUrl} />
      {state.presence && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden />
          <span><b className="text-foreground">{state.presence.here}</b> of {state.presence.roster} here · {state.presence.in_meet} in Meet · {state.presence.on_page} on the live page</span>
        </p>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      <TimerBlock state={state} seconds={seconds} busy={busy}
        onTimer={(action, secs, attach) => void run(() => api.timer(id, action, secs, attach))} />

      <PickerBlock state={state} busy={busy} onPick={() => void run(() => api.pick(id))}
        onOutcome={(outcome) => state.pick && void run(() => api.pickOutcome(id, state.pick!.id, outcome))} />

      <StaffFun state={state} api={api} act={act} socket={socket} renderStar={renderStar} />

      {activity && (
        <section className="space-y-2 rounded-xl border border-border p-3">
          <StaffActivity activity={activity} onHide={(answerId, hidden) => void run(() => api.hide(id, answerId, hidden))} />
          <div className="flex gap-2">
            {activity.status === 'open' && (
              <button type="button" disabled={busy} onClick={() => void run(() => api.close(id, activity.id))}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40">
                <Lock className="h-3.5 w-3.5" aria-hidden />Close answers
              </button>
            )}
            {!activity.revealed && (
              <button type="button" disabled={busy} onClick={() => void run(() => api.reveal(id, activity.id))}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                <Eye className="h-3.5 w-3.5" aria-hidden />Show results
              </button>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {activity?.status === 'open' ? 'Next question (closes the open one)' : 'New question'}
        </h3>
        <ActivityComposer lessonId={id} api={api} start={start} busy={busy} />
      </section>
    </div>
  );
}

function LinkRow({ link, presenterUrl }: { link: string; presenterUrl: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(chatText(link));
    } catch {
      // Meet's panel frame may refuse the clipboard: select a hidden field instead.
      const area = document.createElement('textarea');
      area.value = chatText(link);
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch { /* shown below anyway */ }
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl bg-muted/60 p-2.5">
      <p className="text-[11px] text-muted-foreground">Students answer at</p>
      <p className="select-all break-all text-sm font-semibold">{link.replace(/^https:\/\//, '')}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => void copy()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold hover:bg-muted">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy for chat'}
        </button>
        <a href={presenterUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold hover:bg-muted">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />Presenter view
        </a>
      </div>
    </div>
  );
}

function TimerBlock({ state, seconds, busy, onTimer }: {
  state: LiveState; seconds: number | null; busy: boolean;
  onTimer: (action: 'start' | 'pause' | 'resume' | 'add' | 'stop', seconds?: number, attach?: boolean) => void;
}) {
  const [custom, setCustom] = useState('');
  const [keepOpen, setKeepOpen] = useState(false);
  const [muted, setMuted] = useState(chimeMuted());
  const timer = state.timer;
  const paused = timer?.paused_left != null;
  const toggleMute = () => { setChimeMuted(!muted); setMuted(!muted); };
  const customSeconds = Math.round(Number(custom.replace(',', '.')) * 60);
  return (
    <section className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Timer className="h-3.5 w-3.5" aria-hidden />Timer
        </h3>
        <button type="button" onClick={toggleMute} aria-label={muted ? 'Chime off' : 'Chime on'} title={muted ? 'Chime off' : 'Chime on'}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      {timer ? (
        <div className="flex flex-wrap items-center gap-2">
          <Countdown seconds={seconds} paused={paused} onEnd={playChime} />
          {timer.activity_id && <span className="text-[11px] text-muted-foreground">closes the question</span>}
          <div className="ml-auto flex gap-1">
            <IconButton label={paused ? 'Resume' : 'Pause'} disabled={busy} onClick={() => onTimer(paused ? 'resume' : 'pause')}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </IconButton>
            <IconButton label="Add 30 seconds" disabled={busy} onClick={() => onTimer('add')}><Plus className="h-3.5 w-3.5" /><span className="text-[11px]">30s</span></IconButton>
            <IconButton label="Stop" disabled={busy} onClick={() => onTimer('stop')}><Square className="h-3.5 w-3.5" /></IconButton>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1">
            {TIMER_PRESETS.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => onTimer('start', s, !keepOpen)}
                className="rounded-lg border border-border px-1 py-1.5 text-xs font-semibold tabular-nums hover:bg-muted disabled:opacity-40">
                {s < 60 ? `${s}s` : formatSeconds(s).replace(/:00$/, ' min')}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="decimal" placeholder="Minutes"
              className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring" />
            <button type="button" disabled={busy || !(customSeconds >= 5 && customSeconds <= 3600)} onClick={() => onTimer('start', customSeconds, !keepOpen)}
              className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-40">Start</button>
          </div>
          {state.activity?.status === 'open' && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
              Don't close answers when time is up
            </label>
          )}
        </div>
      )}
    </section>
  );
}

function PickerBlock({ state, busy, onPick, onOutcome }: {
  state: LiveState; busy: boolean; onPick: () => void; onOutcome: (outcome: 'answered' | 'no_answer' | 'skipped') => void;
}) {
  const pick = state.pick;
  const waiting = pick && !pick.outcome;
  return (
    <section className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Dices className="h-3.5 w-3.5" aria-hidden />Random student
        </h3>
        <button type="button" disabled={busy} onClick={onPick}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">Pick</button>
      </div>
      {pick && (
        <div className="mt-2">
          <p className={cn('flex items-center gap-2 text-base font-semibold', !waiting && 'text-muted-foreground')}>
            <LiveAvatar person={pick} size={28} className={waiting ? 'live-orca-wiggle' : undefined} />{pick.name}
          </p>
          {waiting ? (
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              <OutcomeButton disabled={busy} onClick={() => onOutcome('answered')}><UserCheck className="h-3.5 w-3.5" />Answered</OutcomeButton>
              <OutcomeButton disabled={busy} onClick={() => onOutcome('no_answer')}><UserX className="h-3.5 w-3.5" />Didn't</OutcomeButton>
              <OutcomeButton disabled={busy} onClick={() => onOutcome('skipped')}><Dices className="h-3.5 w-3.5" />Skip</OutcomeButton>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">{pick.outcome === 'answered' ? 'Answered' : pick.outcome === 'no_answer' ? "Didn't answer" : ''}</p>
          )}
        </div>
      )}
    </section>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border px-1.5 py-1 hover:bg-muted disabled:opacity-40">{children}</button>
  );
}

function OutcomeButton({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-1 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-40">{children}</button>
  );
}
