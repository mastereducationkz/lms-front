import { useState } from 'react';
import { BarChart3, Cloud, EyeOff, ListChecks, Loader2, Plus, RefreshCw, Target, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LiveApi } from '../../lib/liveLesson/api';
import { POLL_PRESETS, correctIndices } from '../../lib/liveLesson/logic';
import type { MistakePreview, PopcheckPreview, StartActivity } from '../../lib/liveLesson/types';
import { OptionRows, QuestionBody } from './parts';

type Tab = 'poll' | 'cloud' | 'popcheck' | 'mistake';

const TABS: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'poll', label: 'Poll', icon: BarChart3 },
  { key: 'cloud', label: 'Word cloud', icon: Cloud },
  { key: 'popcheck', label: 'Pop-check', icon: ListChecks },
  { key: 'mistake', label: 'Mistake', icon: Target },
];

interface Props {
  lessonId: number;
  api: LiveApi;
  /** Resolves true once started (a failure is shown by the caller). */
  start: (data: StartActivity) => Promise<boolean>;
  busy: boolean;
}

/** Starting a question (owner, 2026-09-29): poll presets in one tap, a typed poll or cloud, and a
 *  pop-check or «mistake of the day» the teacher previews first. No teacher prep. */
export default function ActivityComposer({ lessonId, api, start, busy }: Props) {
  const [tab, setTab] = useState<Tab>('poll');
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="New question">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-semibold',
              tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        ))}
      </div>
      {tab === 'poll' && <PollForm start={start} busy={busy} />}
      {tab === 'cloud' && <CloudForm start={start} busy={busy} />}
      {tab === 'popcheck' && <PopcheckForm lessonId={lessonId} api={api} start={start} busy={busy} />}
      {tab === 'mistake' && <MistakeForm lessonId={lessonId} api={api} start={start} busy={busy} />}
    </div>
  );
}

function Anonymous({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />
      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />Anonymous (nobody sees who answered what)
    </label>
  );
}

function StartButton({ disabled, busy, label, onClick }: { disabled?: boolean; busy: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled || busy} onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}{label}
    </button>
  );
}

const field = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring';

function PollForm({ start, busy }: { start: Props['start']; busy: boolean }) {
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [anonymous, setAnonymous] = useState(false);
  const filled = options.map((o) => o.trim());
  const ready = filled.length >= 2 && filled.every(Boolean);
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">One tap, ask aloud or on your slide</p>
        <div className="grid grid-cols-3 gap-1.5">
          {POLL_PRESETS.map((p) => (
            <button key={p.key} type="button" disabled={busy}
              onClick={() => void start({ kind: 'poll', options: p.options, preset: p.key, anonymous, prompt: prompt.trim() || undefined })}
              className="rounded-lg border border-border bg-card px-2 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40">
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 border-t border-border pt-3">
        <p className="text-xs font-semibold text-muted-foreground">Or type your own</p>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={500} placeholder="Question (optional)" className={field} />
        {options.map((o, i) => (
          <div key={i} className="flex gap-1.5">
            <input value={o} maxLength={120} placeholder={`Option ${String.fromCharCode(65 + i)}`} className={field}
              onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} />
            {options.length > 2 && (
              <button type="button" aria-label="Remove option" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-lg px-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button type="button" onClick={() => setOptions((prev) => [...prev, ''])}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="h-3.5 w-3.5" aria-hidden />Add option</button>
        )}
        <Anonymous value={anonymous} onChange={setAnonymous} />
        <StartButton busy={busy} disabled={!ready} label="Start poll"
          onClick={() => void start({ kind: 'poll', prompt: prompt.trim() || undefined, options: filled, anonymous })} />
      </div>
    </div>
  );
}

function CloudForm({ start, busy }: { start: Props['start']; busy: boolean }) {
  const [prompt, setPrompt] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  return (
    <div className="space-y-2">
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={500} placeholder="e.g. One word for today's topic" className={field} />
      <p className="text-[11px] text-muted-foreground">Up to 3 answers each, 40 characters. Rude answers hide themselves (word list + AI check); you can hide or restore any entry.</p>
      <Anonymous value={anonymous} onChange={setAnonymous} />
      <StartButton busy={busy} disabled={!prompt.trim()} label="Start word cloud"
        onClick={() => void start({ kind: 'cloud', prompt: prompt.trim(), anonymous })} />
    </div>
  );
}

function Source({ fallback, start }: { fallback: boolean; start: string | null }) {
  if (!fallback || !start) return <p className="text-[11px] text-muted-foreground">From the homework due at this lesson</p>;
  const day = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">From the homework for {day}: nothing to ask in this lesson's</p>;
}

function PopcheckForm({ lessonId, api, start, busy }: Props) {
  const [preview, setPreview] = useState<PopcheckPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try { setPreview(await api.popcheckPreview(lessonId)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  const replace = async (index: number) => {
    if (!preview) return;
    setLoading(true);
    try {
      const more = await api.popcheckPreview(lessonId, preview.items.map((i) => i.ref), 1);
      if (!more.items.length) { setError('No other question left to swap in'); return; }
      setPreview({ ...preview, items: preview.items.map((it, i) => (i === index ? more.items[0] : it)) });
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  if (!preview) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">3 auto-checked questions from the course units of this lesson's homework. You see them first.</p>
        <StartButton busy={loading} label="Prepare pop-check" onClick={() => void load()} />
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }
  if (!preview.items.length) {
    return <Empty reason={preview.reason} onRetry={() => void load()} />;
  }
  return (
    <div className="space-y-2">
      <Source fallback={preview.fallback} start={preview.source_start} />
      {preview.items.map((item, i) => (
        <div key={`${item.ref.step_id}:${item.ref.question_id}`} className="rounded-lg border border-border p-2 text-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">Question {i + 1} · {item.source.title}</span>
            <button type="button" disabled={loading} onClick={() => void replace(i)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary disabled:opacity-40"><RefreshCw className="h-3 w-3" aria-hidden />Replace</button>
          </div>
          <QuestionBody question={item.question} />
          {item.question.options ? (
            <div className="mt-1.5"><OptionRows options={item.question.options} rich correct={correctIndices(item.key.correct)} /></div>
          ) : (
            <p className="mt-1 text-xs">Right answer: <b>{(item.key.correct as string[]).join(' or ')}</b></p>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <StartButton busy={busy} label="Start pop-check (3 min timer)"
        onClick={() => void start({ kind: 'popcheck', refs: preview.items.map((i) => i.ref), timer_seconds: 180 }).then((ok) => { if (ok) setPreview(null); })} />
    </div>
  );
}

function MistakeForm({ lessonId, api, start, busy }: Props) {
  const [preview, setPreview] = useState<MistakePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const load = async () => {
    setLoading(true);
    setError(null);
    try { setPreview(await api.mistakePreview(lessonId)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  if (!preview) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">The question your group got wrong most often in this homework's course units, asked again as a poll.</p>
        <StartButton busy={loading} label="Find the mistake" onClick={() => void load()} />
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }
  const poll = preview.poll;
  if (!poll) return <Empty reason={preview.reason} onRetry={() => void load()} />;
  return (
    <div className="space-y-2">
      <Source fallback={preview.fallback} start={preview.source_start} />
      <p className={cn('text-sm font-semibold', poll.stats.share_wrong >= 0.5 ? 'text-rose-600' : 'text-amber-700 dark:text-amber-400')}>
        {Math.round(poll.stats.share_wrong * 100)}% got it wrong ({poll.stats.wrong} of {poll.stats.answered})
      </p>
      <div className="rounded-lg border border-border p-2 text-sm">
        <QuestionBody question={poll.shown} />
        <div className="mt-1.5"><OptionRows options={poll.shown.options ?? []} rich correct={correctIndices(poll.correct)} /></div>
      </div>
      <Anonymous value={anonymous} onChange={setAnonymous} />
      <StartButton busy={busy} label="Ask it again"
        onClick={() => void start({ kind: 'mistake', ref: poll.ref, anonymous }).then((ok) => { if (ok) setPreview(null); })} />
    </div>
  );
}

function Empty({ reason, onRetry }: { reason: string | null; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
      <p>{reason ?? 'Nothing to ask yet.'}</p>
      <button type="button" onClick={onRetry} className="mt-1.5 inline-flex items-center gap-1 font-semibold text-primary">
        <RefreshCw className="h-3 w-3" aria-hidden />Check again
      </button>
    </div>
  );
}
