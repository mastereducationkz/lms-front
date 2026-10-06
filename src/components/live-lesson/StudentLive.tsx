import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, EyeOff, Hand, Loader2, Lock, Radio, Send, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LiveApi } from '../../lib/liveLesson/api';
import { correctIndices, mineAt, multiReady } from '../../lib/liveLesson/logic';
import type { ActivityView, LiveState, PopcheckItem } from '../../lib/liveLesson/types';
import { vibrate } from '../../lib/liveLesson/chime';
import { useAuth } from '../../contexts/AuthContext';
import Confetti from '../achievements/Confetti';
import { LiveAvatar } from './orcas';
import { ReactionLayer, Recap } from './funScreens';
import { HandAndLost, ReactionBar } from './StudentFun';
import type { LiveSocket } from '../../lib/liveLesson/useLiveLesson';
import type { Person } from '../../lib/liveLesson/types';
import { CloudView, Countdown, OptionRows, QuestionBody } from './parts';

interface Props {
  state: LiveState;
  api: LiveApi;
  seconds: number | null;
  act: <T>(write: () => Promise<T>) => Promise<T>;
  socket?: LiveSocket | null;
}

/**
 * A student's live page (owner, 2026-09-29): the question the teacher opened, their own answer,
 * and after «Show» the class totals. Who answered what is never on a student's screen.
 * Their own orca (owner, 2026-10-04) rides along: next to «Sent», waving when they're picked, and
 * cheering with a little confetti when a revealed answer of theirs is right.
 */
const MeContext = createContext<Person | null>(null);

export default function StudentLive({ state, api, seconds, act, socket }: Props) {
  const activity = state.activity;
  const { user } = useAuth();
  const me: Person | null = user ? { user_id: Number(user.id), name: user.name ?? null, mascot: user.mascot ?? null, avatar_url: user.avatar_url ?? null } : null;
  return (
    <MeContext.Provider value={me}>
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          {me ? <LiveAvatar person={me} size={32} /> : <Radio className="h-3.5 w-3.5" aria-hidden />}Live lesson
        </p>
        <Countdown seconds={seconds} paused={state.timer?.paused_left != null} onEnd={vibrate} />
      </div>
      {state.pick?.me && !state.pick.outcome && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {me ? <span className="live-orca-wiggle flex-none"><LiveAvatar person={me} size={52} /></span> : <Hand className="h-6 w-6 flex-none" aria-hidden />}
          <p className="text-base font-semibold">You've been picked. Your turn to answer.</p>
        </div>
      )}
      {state.recap && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <Recap recap={state.recap} />
        </section>
      )}
      {!activity ? (
        <Waiting />
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {activity.anonymous && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" aria-hidden />Anonymous: your teacher won't see who answered what
            </p>
          )}
          {activity.status === 'closed' && !activity.revealed && (
            <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Lock className="h-4 w-4" aria-hidden />Answers are closed. Wait for the results.
            </p>
          )}
          <ActivityBody key={activity.id} activity={activity} lessonId={state.lesson.id} api={api} act={act} />
          <Cheer key={`cheer-${activity.id}`} activity={activity} />
        </section>
      )}
      {/* Reactions rise in their own strip above the buttons: never over the question or the answers. */}
      <ReactionLayer socket={socket} eventId={state.lesson.id} size={36} placement="inline" />
      <ReactionBar state={state} api={api} me={me} />
      <HandAndLost state={state} api={api} />
    </div>
    </MeContext.Provider>
  );
}

/** A revealed answer of theirs was right: their orca cheers, with a short confetti burst, once. */
function Cheer({ activity }: { activity: ActivityView }) {
  const me = useContext(MeContext);
  const right = gotItRight(activity);
  const [burst, setBurst] = useState(false);
  useEffect(() => { if (right) setBurst(true); }, [right]);
  if (!right || !me) return null;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <span className="live-orca-wiggle"><LiveAvatar person={me} size={44} /></span>
      <p className="text-sm font-semibold">Nice one, you got it right!</p>
      {burst && <Confetti pieces={70} durationMs={1800} />}
    </div>
  );
}

function gotItRight(activity: ActivityView): boolean {
  if (!activity.revealed) return false;
  if (activity.kind === 'popcheck') {
    const mine = (activity.mine ?? {}) as Record<string, { correct: boolean | null }>;
    return Object.values(mine).some((m) => m?.correct === true);
  }
  if (activity.kind === 'mistake' && activity.results?.correct !== undefined) {
    const stored = activity.mine;
    const mine = Array.isArray(stored) ? (stored as number[]) : typeof stored === 'number' ? [stored] : [];
    const correct = correctIndices(activity.results.correct) ?? [];
    return mine.length > 0 && mine.length === correct.length && mine.every((i) => correct.includes(i));
  }
  return false;
}

function Waiting() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
      <Radio className="h-8 w-8 animate-pulse text-emerald-600 dark:text-emerald-400" aria-hidden />
      <p className="text-base font-semibold text-foreground">Waiting for the teacher's question</p>
      <p className="text-sm text-muted-foreground">Keep this page open. The question appears here by itself.</p>
    </div>
  );
}

function useSend(act: Props['act']) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (write: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await act(write);
    } catch (e) {
      setError((e as Error).message || 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, send };
}

function ActivityBody({ activity, lessonId, api, act }: { activity: ActivityView; lessonId: number; api: LiveApi; act: Props['act'] }) {
  const open = activity.status === 'open';
  const { busy, error, send } = useSend(act);
  const answer = (value: unknown, item?: number) => send(() => api.answer(lessonId, activity.id, value, item));
  const footer = error ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null;

  if (activity.kind === 'poll') {
    const mine = typeof activity.mine === 'number' ? [activity.mine] : [];
    return (
      <div className="space-y-3">
        {activity.prompt && <p className="text-lg font-semibold text-foreground">{activity.prompt}</p>}
        <OptionRows options={activity.options ?? []} selected={mine} disabled={!open || busy}
          onPick={open ? (i) => void answer(i) : undefined} counts={activity.results?.counts ?? null} />
        {open && mine.length > 0 && <Sent text="Sent. You can change your answer until the teacher closes it." />}
        {footer}
      </div>
    );
  }
  if (activity.kind === 'cloud') return <CloudAnswer activity={activity} open={open} busy={busy} onSend={(t) => answer(t)} footer={footer} />;
  if (activity.kind === 'popcheck') return <Popcheck activity={activity} open={open} busy={busy} onSend={answer} footer={footer} />;
  return <Mistake activity={activity} open={open} busy={busy} onSend={(v) => answer(v)} footer={footer} />;
}

function Sent({ text }: { text: string }) {
  const me = useContext(MeContext);
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
      {me ? <span className="live-orca-pop"><LiveAvatar person={me} size={24} /></span> : <CheckCircle2 className="h-4 w-4" aria-hidden />}{text}
    </p>
  );
}

function CloudAnswer({ activity, open, busy, onSend, footer }: {
  activity: ActivityView; open: boolean; busy: boolean; onSend: (text: string) => Promise<void>; footer: ReactNode;
}) {
  const [text, setText] = useState('');
  const mine = (activity.mine as { text: string; hidden: boolean }[] | null) ?? [];
  const left = 3 - mine.length;
  const submit = async () => {
    if (!text.trim()) return;
    await onSend(text.trim());
    setText('');
  };
  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold text-foreground">{activity.prompt}</p>
      {open && left > 0 && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 40))} maxLength={40} placeholder="A word or a short phrase"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden />}Send
          </button>
        </form>
      )}
      {mine.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Your answers{open && left > 0 ? ` · ${left} more allowed` : ''}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {mine.map((m, i) => (
              <span key={i} className={cn('rounded-full border border-border px-2.5 py-1 text-sm', m.hidden && 'text-muted-foreground line-through')}>{m.text}</span>
            ))}
          </div>
        </div>
      )}
      {activity.revealed && <CloudView groups={activity.results?.groups ?? []} />}
      {footer}
    </div>
  );
}

function Popcheck({ activity, open, busy, onSend, footer }: {
  activity: ActivityView; open: boolean; busy: boolean; onSend: (value: unknown, item?: number) => Promise<void>; footer: ReactNode;
}) {
  const items = activity.items ?? [];
  const done = items.filter((_, i) => mineAt(activity.mine, i) !== undefined).length;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-foreground">Homework pop-check</p>
        <p className="text-sm text-muted-foreground">{done} of {items.length} answered. Each answer is final once sent.</p>
      </div>
      {items.map((item, i) => (
        <PopcheckQuestion key={i} n={i} item={item} mine={mineAt(activity.mine, i)} open={open} busy={busy}
          revealed={activity.revealed} onSend={(v) => onSend(v, i)} />
      ))}
      {footer}
    </div>
  );
}

function PopcheckQuestion({ n, item, mine, open, busy, revealed, onSend }: {
  n: number; item: PopcheckItem; mine?: { value: unknown; correct: boolean | null }; open: boolean; busy: boolean;
  revealed: boolean; onSend: (value: unknown) => Promise<void>;
}) {
  const q = item.question;
  const [picked, setPicked] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const sent = mine !== undefined;
  const value = mine?.value;
  const chosen = sent ? (Array.isArray(value) ? (value as number[]) : typeof value === 'number' ? [value] : []) : picked;
  const correct = revealed ? correctIndices(item.key?.correct) : undefined;
  const toggle = (i: number) => setPicked((prev) => (q.kind === 'multi'
    ? (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]) : [i]));
  const ready = q.kind === 'text' ? typed.trim().length > 0 : q.kind === 'multi' ? multiReady(picked, q.select_count) : picked.length === 1;
  const submit = () => onSend(q.kind === 'text' ? typed.trim() : q.kind === 'multi' ? picked : picked[0]);
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question {n + 1}</p>
      <QuestionBody question={q} gapText={q.kind === 'gap' && chosen.length ? q.options?.[chosen[0]]?.text : null} />
      <div className="mt-3">
        {q.kind === 'text' ? (
          sent ? <p className="rounded-lg bg-muted px-3 py-2 text-base">{String(value ?? '')}</p> : (
            <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!open} inputMode="text" placeholder="Your answer"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none focus:ring-2 focus:ring-ring" />
          )
        ) : (
          <OptionRows options={q.options ?? []} selected={chosen} rich correct={correct}
            onPick={!sent && open ? toggle : undefined} disabled={sent || !open} />
        )}
        {q.kind === 'multi' && !sent && q.select_count ? <p className="mt-1 text-xs text-muted-foreground">Choose {q.select_count}.</p> : null}
      </div>
      {!sent && open && (
        <button type="button" disabled={!ready || busy} onClick={() => void submit()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden />}Send answer
        </button>
      )}
      {sent && !revealed && <div className="mt-2"><Sent text="Sent" /></div>}
      {revealed && sent && (
        <p className={cn('mt-2 inline-flex items-center gap-1.5 text-sm font-semibold', mine?.correct ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          {mine?.correct ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
          {mine?.correct ? 'Right' : 'Not quite'}
        </p>
      )}
      {revealed && q.kind === 'text' && Array.isArray(item.key?.correct) && (
        <p className="mt-1 text-sm text-foreground">Right answer: <b>{(item.key?.correct as string[]).join(' or ')}</b></p>
      )}
      {revealed && item.key?.explanation && <Explanation text={item.key.explanation} />}
    </div>
  );
}

function Explanation({ text }: { text: string }) {
  return (
    <div className="mt-2 rounded-lg bg-muted/60 p-3 text-sm text-foreground">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why</p>
      <QuestionBody question={{ kind: 'text', text, passage: null, options: null, select_count: null, media_url: null }} />
    </div>
  );
}

function Mistake({ activity, open, busy, onSend, footer }: {
  activity: ActivityView; open: boolean; busy: boolean; onSend: (value: unknown) => Promise<void>; footer: ReactNode;
}) {
  const q = activity.question;
  const multi = activity.mode === 'multi';
  const [picked, setPicked] = useState<number[]>([]);
  if (!q) return null;
  const stored = activity.mine;
  const mine = Array.isArray(stored) ? (stored as number[]) : typeof stored === 'number' ? [stored] : [];
  const selected = multi && open ? (picked.length ? picked : mine) : mine;
  const correct = activity.results?.correct !== undefined ? correctIndices(activity.results.correct) : undefined;
  const pick = (i: number) => {
    if (!multi) { void onSend(i); return; }
    setPicked((prev) => { const base = prev.length ? prev : mine; return base.includes(i) ? base.filter((x) => x !== i) : [...base, i]; });
  };
  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold text-foreground">Mistake of the day</p>
      <QuestionBody question={q} />
      <OptionRows options={q.options ?? []} selected={selected} rich onPick={open ? pick : undefined} disabled={!open || busy}
        correct={activity.revealed ? correct : undefined} counts={activity.revealed ? activity.results?.counts ?? null : null} />
      {multi && open && (
        <button type="button" disabled={busy || !multiReady(selected, q.select_count)} onClick={() => void onSend(selected)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          <Send className="h-4 w-4" aria-hidden />Send answer
        </button>
      )}
      {open && mine.length > 0 && <Sent text="Sent. You can change it until the teacher closes it." />}
      {activity.revealed && activity.results?.explanation && <Explanation text={activity.results.explanation} />}
      {footer}
    </div>
  );
}
