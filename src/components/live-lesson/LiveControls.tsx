import { useState, type ReactNode } from 'react';
import {
  Check, Copy, Dices, ExternalLink, Eye, Lock, Pause, Play, Plus, Square, Timer, UserCheck, UserX, Users, Volume2, VolumeX,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LiveApi } from '../../lib/liveLesson/api';
import { chimeMuted, playChime, setChimeMuted } from '../../lib/liveLesson/chime';
import { TIMER_PRESETS, formatSeconds } from '../../lib/liveLesson/logic';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/chatLive';
import type { LiveState, StartActivity } from '../../lib/liveLesson/types';
import ActivityComposer from './ActivityComposer';
import StaffActivity from './StaffActivity';
import { Countdown } from './parts';
import { LiveAvatar } from './orcas';
import StaffFun, { type RenderStar } from './StaffFun';
import type { LiveAct, LiveSocket, WriteOptions } from '../../lib/liveLesson/useLiveLesson';
import { ConnectionNote, LiveConnectionContext, useWriteFailure, type LiveConnection } from './connection';

interface Props {
  state: LiveState;
  api: LiveApi;
  seconds: number | null;
  act: LiveAct;
  presenterUrl: string;
  /** Reconnecting / offline, and when the last good refresh started (useLiveLesson). */
  connection?: LiveConnection;
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
export default function LiveControls(props: Props) {
  const connection = props.connection ?? { reconnecting: false, error: null, syncedAt: 0 };
  return (
    <LiveConnectionContext.Provider value={connection}>
      <Controls {...props} connection={connection} />
    </LiveConnectionContext.Provider>
  );
}

function Controls({ state, api, seconds, act, presenterUrl, socket, renderStar, connection }: Props & { connection: LiveConnection }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const failure = useWriteFailure();
  const id = state.lesson.id;
  // A blip is waited out quietly (act); what still fails is said plainly and clears on the next
  // good refresh. Writes that aren't safe to send twice say how to see that they landed.
  const run = async (write: () => Promise<unknown>, options?: WriteOptions): Promise<boolean> => {
    setBusy(true);
    failure.clear();
    try {
      await act(write, options);
      return true;
    } catch (e) {
      failure.fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const activity = state.activity;
  const before = { activity: activity?.id ?? null, pick: state.pick?.id ?? null, timer: state.timer };
  // A new question closes the open one: a second send would reopen it as yet another.
  const start = (data: StartActivity) => run(() => api.start(id, data), {
    landed: (fresh) => fresh.activity != null && fresh.activity.id !== before.activity && fresh.activity.kind === data.kind,
  });
  const timer = (action: 'start' | 'pause' | 'resume' | 'add' | 'stop', secs?: number, attach?: boolean) => {
    // Pause, resume and stop are the same twice over; a start restarts the clock and +30 s adds again.
    const landed: WriteOptions['landed'] = action === 'start'
      ? (fresh) => fresh.timer != null && fresh.timer.total === secs && fresh.timer.ends_at !== (before.timer?.ends_at ?? null)
      : action === 'add'
        ? (fresh) => (fresh.timer?.total ?? 0) >= (before.timer?.total ?? 0) + 30
        : undefined;
    return run(() => api.timer(id, action, secs, attach), { landed });
  };
  // Every pick is a turn (and a skip picks again): a second send would pick a second student.
  const pick = () => run(() => api.pick(id), { landed: (fresh) => fresh.pick != null && fresh.pick.id !== before.pick });
  const outcome = (pickId: number, value: 'answered' | 'no_answer' | 'skipped') => run(() => api.pickOutcome(id, pickId, value),
    value === 'skipped' ? { landed: (fresh) => fresh.pick == null || fresh.pick.id !== pickId } : undefined);

  return (
    <div className="space-y-3 text-foreground">
      <LinkRow link={state.link} presenterUrl={presenterUrl} />
      {state.presence && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden />
          <span><b className="text-foreground">{state.presence.here}</b> {t('chatLive.live.presence', { roster: state.presence.roster, inMeet: state.presence.in_meet, onPage: state.presence.on_page })}</span>
        </p>
      )}
      <ConnectionNote reconnecting={connection.reconnecting} error={failure.text ?? connection.error} />

      <TimerBlock state={state} seconds={seconds} busy={busy}
        onTimer={(action, secs, attach) => void timer(action, secs, attach)} />

      <PickerBlock state={state} busy={busy} onPick={() => void pick()}
        onOutcome={(value) => state.pick && void outcome(state.pick.id, value)} />

      <StaffFun state={state} api={api} act={act} socket={socket} renderStar={renderStar} />

      {activity && (
        <section className="space-y-2 rounded-xl border border-border p-3">
          <StaffActivity activity={activity} onHide={(answerId, hidden) => void run(() => api.hide(id, answerId, hidden))} />
          <div className="flex gap-2">
            {activity.status === 'open' && (
              <button type="button" disabled={busy} onClick={() => void run(() => api.close(id, activity.id))}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40">
                <Lock className="h-3.5 w-3.5" aria-hidden />{t('chatLive.live.closeAnswers')}
              </button>
            )}
            {!activity.revealed && (
              <button type="button" disabled={busy} onClick={() => void run(() => api.reveal(id, activity.id))}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                <Eye className="h-3.5 w-3.5" aria-hidden />{t('chatLive.live.showResults')}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {activity?.status === 'open' ? t('chatLive.live.nextQuestion') : t('chatLive.live.newQuestion')}
        </h3>
        <ActivityComposer lessonId={id} api={api} start={start} busy={busy} />
      </section>
    </div>
  );
}

function LinkRow({ link, presenterUrl }: { link: string; presenterUrl: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // What the teacher pastes into the Meet chat, in their own language (logic.chatText is the English one).
  const text = t('chatLive.live.chatText', { link });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Meet's panel frame may refuse the clipboard: select a hidden field instead.
      const area = document.createElement('textarea');
      area.value = text;
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
      <p className="text-[11px] text-muted-foreground">{t('chatLive.live.studentsAnswerAt')}</p>
      <p className="select-all break-all text-sm font-semibold">{link.replace(/^https:\/\//, '')}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => void copy()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold hover:bg-muted">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? t('common.copied') : t('chatLive.live.copyForChat')}
        </button>
        <a href={presenterUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold hover:bg-muted">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />{t('chatLive.live.presenterView')}
        </a>
      </div>
    </div>
  );
}

function TimerBlock({ state, seconds, busy, onTimer }: {
  state: LiveState; seconds: number | null; busy: boolean;
  onTimer: (action: 'start' | 'pause' | 'resume' | 'add' | 'stop', seconds?: number, attach?: boolean) => void;
}) {
  const t = useT();
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
          <Timer className="h-3.5 w-3.5" aria-hidden />{t('chatLive.live.timer')}
        </h3>
        <button type="button" onClick={toggleMute} aria-label={muted ? t('chatLive.live.chimeOff') : t('chatLive.live.chimeOn')} title={muted ? t('chatLive.live.chimeOff') : t('chatLive.live.chimeOn')}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      {timer ? (
        <div className="flex flex-wrap items-center gap-2">
          <Countdown seconds={seconds} paused={paused} onEnd={playChime} />
          {timer.activity_id && <span className="text-[11px] text-muted-foreground">{t('chatLive.live.closesQuestion')}</span>}
          <div className="ml-auto flex gap-1">
            <IconButton label={paused ? t('chatLive.live.resume') : t('chatLive.live.pause')} disabled={busy} onClick={() => onTimer(paused ? 'resume' : 'pause')}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </IconButton>
            <IconButton label={t('chatLive.live.add30')} disabled={busy} onClick={() => onTimer('add')}><Plus className="h-3.5 w-3.5" /><span className="text-[11px]">{t('chatLive.live.secondsShort', { count: 30 })}</span></IconButton>
            <IconButton label={t('chatLive.live.stop')} disabled={busy} onClick={() => onTimer('stop')}><Square className="h-3.5 w-3.5" /></IconButton>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1">
            {TIMER_PRESETS.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => onTimer('start', s, !keepOpen)}
                className="rounded-lg border border-border px-1 py-1.5 text-xs font-semibold tabular-nums hover:bg-muted disabled:opacity-40">
                {s < 60 ? t('chatLive.live.secondsShort', { count: s }) : s % 60 === 0 ? t('chatLive.live.minutesShort', { count: s / 60 }) : formatSeconds(s)}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="decimal" placeholder={t('chatLive.live.minutesPlaceholder')}
              className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring" />
            <button type="button" disabled={busy || !(customSeconds >= 5 && customSeconds <= 3600)} onClick={() => onTimer('start', customSeconds, !keepOpen)}
              className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-40">{t('chatLive.live.start')}</button>
          </div>
          {state.activity?.status === 'open' && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
              {t('chatLive.live.keepOpen')}
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
  const t = useT();
  const pick = state.pick;
  const waiting = pick && !pick.outcome;
  return (
    <section className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Dices className="h-3.5 w-3.5" aria-hidden />{t('chatLive.live.randomStudent')}
        </h3>
        <button type="button" disabled={busy} onClick={onPick}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">{t('chatLive.live.pick')}</button>
      </div>
      {pick && (
        <div className="mt-2">
          <p className={cn('flex items-center gap-2 text-base font-semibold', !waiting && 'text-muted-foreground')}>
            <LiveAvatar person={pick} size={28} className={waiting ? 'live-orca-wiggle' : undefined} />{pick.name}
          </p>
          {waiting ? (
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              <OutcomeButton disabled={busy} onClick={() => onOutcome('answered')}><UserCheck className="h-3.5 w-3.5" />{t('chatLive.live.outcome.answered')}</OutcomeButton>
              <OutcomeButton disabled={busy} onClick={() => onOutcome('no_answer')}><UserX className="h-3.5 w-3.5" />{t('chatLive.live.outcome.didnt')}</OutcomeButton>
              <OutcomeButton disabled={busy} onClick={() => onOutcome('skipped')}><Dices className="h-3.5 w-3.5" />{t('chatLive.live.outcome.skip')}</OutcomeButton>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">{pick.outcome === 'answered' ? t('chatLive.live.outcome.answered') : pick.outcome === 'no_answer' ? t('chatLive.live.outcome.didntAnswer') : ''}</p>
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
